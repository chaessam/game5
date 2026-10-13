// 덱 대 덱 자동 대전(밸런스 측정). CLI(tools/balance.ts)와 브라우저 페이지(balance.html)가 함께 쓴다.
//
// 지표(기획서 12절 목표)
//   - 파워 지수: 이 덱의 피해를 몇 배로 해야 나머지 덱 전체 상대로 승률 50%가 되나(1.0 평균, 낮을수록 강함). 목표 0.85~1.15
//   - 카드 출전 승률: 무작위 덱 필드에서 그 카드가 들어간 덱의 평균 승률. 목표 0.44~0.58
//   - 전투 길이 중앙값 30~36박, 48박 시간 초과 8% 이하

import { DEFAULT_CONFIG, UNITS, UNIT_IDS, unitDef, type BalanceConfig } from '../engine/data';
import { applyStones, gcd } from '../engine/math';
import { runBattle } from '../engine/battle';
import { makeRng, randInt, shuffle, type Rng } from '../engine/rng';
import type { BoardUnit, FamilyId, RoleId, Star, StoneOp, TreasureId } from '../engine/types';
import type { DeckCard } from './decks';

interface Piece {
  c: number;
  s: Star;
  stones: StoneOp[];
  treasures: TreasureId[];
}

/** 같은 카드 1장을 더 찾는 데 드는 새로고침 골드(대략) — 성 올리기 실효 가격 */
const REROLL_TAX: Record<number, number> = { 1: 2, 2: 3, 3: 3.5, 4: 4, 5: 4.5 };

function costOf(c: number, cfg: BalanceConfig) {
  return unitDef(c, cfg).cost;
}
export function priceOf(c: number, s: Star, cfg: BalanceConfig = DEFAULT_CONFIG): number {
  const copies = 3 ** (s - 1);
  const cost = costOf(c, cfg);
  return copies * cost + (copies - 1) * REROLL_TAX[cost];
}

const toPiece = (x: DeckCard): Piece =>
  typeof x === 'number' ? { c: x, s: 1, stones: [], treasures: [] } : { c: x.c, s: 1, stones: x.stones ?? [], treasures: x.treasures ?? [] };

/** 예산 안에서 싼 카드부터 성을 올린다(3성은 1~2골드 카드만). */
export function buildComp(list: DeckCard[], slots: number, budget: number, cfg: BalanceConfig = DEFAULT_CONFIG) {
  const us = list.slice(0, slots).map(toPiece);
  let spent = us.reduce((a, u) => a + priceOf(u.c, u.s, cfg), 0);
  for (const target of [2, 3] as const) {
    const order = us.map((_, i) => i).sort((a, b) => costOf(us[a].c, cfg) - costOf(us[b].c, cfg) || a - b);
    for (const i of order) {
      const u = us[i];
      if (u.s !== target - 1) continue;
      if (target === 3 && costOf(u.c, cfg) > 2) continue;
      const d = priceOf(u.c, target, cfg) - priceOf(u.c, u.s, cfg);
      if (spent + d <= budget) {
        u.s = target;
        spent += d;
      }
    }
  }
  return { pieces: us, spent };
}

const numOf = (u: Piece) => {
  const r = applyStones(u.c, u.stones);
  return r.ok ? r.value : u.c;
};

/** 줄 나누기: 기사 → 체력 높은 순으로 앞줄, 하나쌤·힐러·헌터·마법사·닌자는 뒤로 */
function assignRows(us: Piece[], cfg: BalanceConfig): (0 | 1)[] {
  const n = us.length;
  const F = n >= 7 ? 4 : n >= 5 ? 3 : Math.ceil(n / 2);
  const role = (u: Piece) => unitDef(u.c, cfg).role;
  const score = (u: Piece) =>
    (role(u) === 'knight' ? 1e5 : 0) + unitDef(u.c, cfg).hp * u.s - (u.c === 1 ? 1e6 : 0) -
    (['healer', 'hunter', 'mage', 'ninja'].includes(role(u)) ? 400 : 0);
  const sorted = us.map((_, i) => i).sort((a, b) => score(us[b]) - score(us[a]));
  const knights = sorted.filter((i) => role(us[i]) === 'knight');
  const front = new Set(knights.slice(0, 5));
  for (const i of sorted) {
    if (front.size >= Math.max(F, Math.min(5, knights.length))) break;
    front.add(i);
  }
  for (const i of sorted) {
    if (n - front.size <= 5) break;
    front.add(i);
  }
  return us.map((_, i) => (front.has(i) ? 0 : 1));
}

type Pos = { row: 0 | 1; col: number };
function handshakeScore(us: Piece[], pos: Pos[]): number {
  let s = 0;
  for (let i = 0; i < us.length; i++) {
    for (let j = i + 1; j < us.length; j++) {
      if (Math.abs(pos[i].row - pos[j].row) + Math.abs(pos[i].col - pos[j].col) !== 1) continue;
      const g = gcd(numOf(us[i]), numOf(us[j]));
      if (g >= 2) s += g;
      if (us[i].c === 1 || us[j].c === 1) s += 4; // 하나쌤은 노래하는 이웃 옆에
    }
  }
  return s;
}

/** 배치 변형: 0번 = 손잡기 최적(언덕 오르기), 1번부터 = 줄 안에서 무작위 칸 */
export function placements(us: Piece[], nVar: number, seed: number, cfg: BalanceConfig = DEFAULT_CONFIG, restarts = 30): BoardUnit[][] {
  const rows = assignRows(us, cfg);
  const R = makeRng(seed);
  const randomPos = (): Pos[] => {
    const slots = [shuffle(R, [0, 1, 2, 3, 4]), shuffle(R, [0, 1, 2, 3, 4])];
    const ix = [0, 0];
    return us.map((_, i) => ({ row: rows[i], col: slots[rows[i]][ix[rows[i]]++] }));
  };
  let best: Pos[] = randomPos();
  let bestScore = -1;
  for (let t = 0; t < restarts; t++) {
    let p = randomPos();
    let sc = handshakeScore(us, p);
    for (let it = 0; it < 120; it++) {
      const i = randInt(R, us.length);
      const nc = randInt(R, 5);
      const q = p.map((x) => ({ ...x }));
      const j = q.findIndex((x, k) => k !== i && x.row === q[i].row && x.col === nc);
      if (j >= 0) q[j].col = q[i].col;
      q[i].col = nc;
      const s2 = handshakeScore(us, q);
      if (s2 >= sc) {
        p = q;
        sc = s2;
      }
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = p;
    }
  }
  const all = [best];
  for (let v = 1; v < nVar; v++) all.push(randomPos());
  return all.map((p) =>
    us.map((u, i) => ({ char: u.c, star: u.s, row: p[i].row, col: p[i].col, items: [...u.stones, ...u.treasures] })),
  );
}

export interface MatchStats {
  w: number;
  l: number;
  d: number;
  n: number;
  beats: number[];
  timeouts: number;
}

export function matchup(varsA: BoardUnit[][], varsB: BoardUnit[][], cfg: BalanceConfig, dmgA = 100): MatchStats {
  const st: MatchStats = { w: 0, l: 0, d: 0, n: 0, beats: [], timeouts: 0 };
  for (const a of varsA) {
    for (const b of varsB) {
      const r = runBattle(a, b, { config: cfg, dmgMultPct: [dmgA, 100] });
      if (r.winner === 0) st.w++;
      else if (r.winner === 1) st.l++;
      else st.d++;
      st.n++;
      st.beats.push(r.beats);
      if (r.timeout) st.timeouts++;
    }
  }
  return st;
}

export function median(a: number[]): number {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export interface PowerRow {
  deck: string;
  power: number; // 1.0 평균, 낮을수록 강함
  winRate: number; // 피해 배율 1배일 때 다른 덱 전체 상대 승률
}

export interface PowerReport {
  slots: number;
  budget: number;
  rows: PowerRow[];
  logSd: number;
  medianBeats: number;
  timeoutRate: number;
  reach36: number;
}

/** 대표 덱 파워 지수. 덱마다 배치 변형 nVar개끼리 모두 붙인다. 진(=배치 이점 없음) 동시 처리라 좌우 교대는 필요 없다. */
export function powerTable(
  decks: Record<string, DeckCard[]>,
  cfg: BalanceConfig = DEFAULT_CONFIG,
  slots = 8,
  budget = 50,
  nVar = 4,
  onProgress?: (done: number, total: number) => void,
): PowerReport {
  const names = Object.keys(decks).filter((n) => !(slots < 8 && n.startsWith('변신')));
  const vars: Record<string, BoardUnit[][]> = {};
  // 중반(8칸 미만)에는 5골드 카드가 거의 안 나오므로(레벨 6 확률 4%) 빼고 다음 카드로 채운다
  const midCards = (list: DeckCard[]) =>
    slots < 8 ? list.filter((x) => costOf(typeof x === 'number' ? x : x.c, cfg) < 5) : list;
  names.forEach((n, i) => (vars[n] = placements(buildComp(midCards(decks[n]), slots, budget, cfg).pieces, nVar, 7 + i, cfg)));
  const rows: PowerRow[] = [];
  const allBeats: number[] = [];
  let timeouts = 0;
  let total = 0;
  names.forEach((a, ai) => {
    const wr = (m: number, collect = false) => {
      let w = 0;
      let n = 0;
      for (const b of names) {
        if (b === a) continue;
        const r = matchup(vars[a], vars[b], cfg, m);
        w += r.w + 0.5 * r.d;
        n += r.n;
        if (collect) {
          allBeats.push(...r.beats);
          timeouts += r.timeouts;
          total += r.n;
        }
      }
      return w / n;
    };
    const base = wr(100, true);
    let lo = 10;
    let hi = 600;
    for (let i = 0; i < 9; i++) {
      const mid = Math.round(Math.sqrt(lo * hi));
      if (wr(mid) > 0.5) hi = mid;
      else lo = mid;
    }
    rows.push({ deck: a, power: Math.sqrt(lo * hi) / 100, winRate: base });
    onProgress?.(ai + 1, names.length);
  });
  const lg = rows.map((r) => Math.log(r.power));
  const mean = lg.reduce((x, y) => x + y, 0) / lg.length;
  const logSd = Math.sqrt(lg.reduce((x, y) => x + (y - mean) ** 2, 0) / lg.length);
  rows.sort((x, y) => x.power - y.power);
  return {
    slots, budget, rows, logSd,
    medianBeats: median(allBeats),
    timeoutRate: total ? timeouts / total : 0,
    reach36: allBeats.length ? allBeats.filter((b) => b >= 36).length / allBeats.length : 0,
  };
}

export interface CardRow {
  char: number;
  name: string;
  cost: number;
  role: RoleId;
  winRate: number;
  games: number;
  sangRate: number; // 박자 노래(몸풀기 제외)를 1번 이상 한 비율
  aliveRate: number;
}

export interface FieldReport {
  comps: number;
  battles: number;
  medianBeats: number;
  timeoutRate: number;
  reach36: number;
  cards: CardRow[];
  tiers: { key: string; winRate: number; n: number }[];
}

/** 무작위 덱 필드: 카드별 출전 승률, 노래 사용률, 가문·직업 단계별 승률 */
export function randomField(
  cfg: BalanceConfig = DEFAULT_CONFIG,
  opts: { comps?: number; opponents?: number; slots?: number; budget?: number; seed?: number } = {},
  onProgress?: (done: number, total: number) => void,
): FieldReport {
  const NC = opts.comps ?? 500;
  const OPP = opts.opponents ?? 40;
  const SLOTS = opts.slots ?? 8;
  const BUDGET = opts.budget ?? 50;
  const R: Rng = makeRng(opts.seed ?? 12345);
  const comps: BoardUnit[][] = [];
  while (comps.length < NC) {
    const pick = shuffle(R, UNIT_IDS.slice()).slice(0, SLOTS);
    const b = buildComp(pick, SLOTS, BUDGET, cfg);
    if (b.spent > BUDGET) continue;
    comps.push(placements(b.pieces, 1, comps.length + 1, cfg, 8)[0]);
  }
  const score = comps.map(() => ({ w: 0, n: 0 }));
  const beats: number[] = [];
  let timeouts = 0;
  const use: Record<number, { battles: number; sang: number; alive: number }> = {};
  UNIT_IDS.forEach((c) => (use[c] = { battles: 0, sang: 0, alive: 0 }));
  const tierAcc: Record<string, { w: number; n: number }> = {};
  const compTiers: string[][] = comps.map(() => []);
  for (let i = 0; i < NC; i++) {
    for (let k = 0; k < OPP; k++) {
      const j = randInt(R, NC);
      if (j === i) continue;
      const r = runBattle(comps[i], comps[j], { config: cfg });
      const w = r.winner === 'draw' ? 0.5 : r.winner === 0 ? 1 : 0;
      score[i].w += w;
      score[i].n++;
      score[j].w += 1 - w;
      score[j].n++;
      beats.push(r.beats);
      if (r.timeout) timeouts++;
      for (const f of r.fighters) {
        if (f.minion) continue;
        const u = use[f.char];
        u.battles++;
        if (f.stats.songs > 0) u.sang++;
        if (f.alive && f.hp > 0) u.alive++;
      }
      if (!compTiers[i].length) {
        const s = r.synergy[0];
        compTiers[i] = [
          ...(Object.keys(s.fam) as FamilyId[]).map((f) => `가문 ${f}${s.fam[f]}`),
          ...(Object.keys(s.role) as RoleId[]).map((x) => `직업 ${x}${s.role[x]}`),
        ];
      }
    }
    onProgress?.(i + 1, NC);
  }
  const wr = score.map((s) => (s.n ? s.w / s.n : 0.5));
  const card: Record<number, { w: number; n: number }> = {};
  UNIT_IDS.forEach((c) => (card[c] = { w: 0, n: 0 }));
  comps.forEach((cp, i) => {
    cp.forEach((u) => {
      card[u.char].w += wr[i];
      card[u.char].n++;
    });
    for (const key of compTiers[i]) {
      tierAcc[key] ??= { w: 0, n: 0 };
      tierAcc[key].w += wr[i];
      tierAcc[key].n++;
    }
  });
  const cards: CardRow[] = UNIT_IDS.map((c) => ({
    char: c,
    name: UNITS[c].name,
    cost: unitDef(c, cfg).cost,
    role: UNITS[c].role,
    winRate: card[c].n ? card[c].w / card[c].n : 0,
    games: card[c].n,
    sangRate: use[c].battles ? use[c].sang / use[c].battles : 0,
    aliveRate: use[c].battles ? use[c].alive / use[c].battles : 0,
  })).sort((a, b) => b.winRate - a.winRate);
  const tiers = Object.entries(tierAcc)
    .map(([key, v]) => ({ key, winRate: v.w / v.n, n: v.n }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    comps: NC,
    battles: beats.length,
    medianBeats: median(beats),
    timeoutRate: beats.length ? timeouts / beats.length : 0,
    reach36: beats.length ? beats.filter((b) => b >= 36).length / beats.length : 0,
    cards,
    tiers,
  };
}

export const TARGETS = {
  power: [0.85, 1.15] as const,
  cardWinRate: [0.44, 0.58] as const,
  medianBeats: [30, 36] as const,
  timeoutMax: 0.08,
};
