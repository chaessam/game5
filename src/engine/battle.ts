// 결정적 박자 전투 엔진. 같은 배치 = 같은 결과(무작위 없음). 모든 계산은 정수, 나머지는 버림.
//
// 한 박의 처리 순서 (기획서 2절)
//   0박: 시너지 계산 → 36 약수 금화 → 손잡기 방패 → 몸풀기 노래
//   1~48박:
//     ① 가문 박 효과(세모 방패 채우기, 다섯손 쌓기)
//     ② 노래할 친구 모으기 → 팀별 합창 인원 k와 배율
//     ③ 양 팀 노래를 '박 시작 상태' 기준으로 동시에 적용 (방패·회복 → 피해 → 멈춤·약하게)
//     ④ 기본 공격 동시 적용 (짝수 박 짝꿍 추가타, 뜨거운 박자)
//     ⑤ 쓰러짐 처리: 되살리기 → 부자 분열
//   멈춤·약하게 N박 = 다음 박부터 N박 동안. 끝나면 3박 면역.

import { DEFAULT_CONFIG, tierOf, unitDef, type BalanceConfig } from './data';
import { applyStones, familiesOf, gcd, splitPair } from './math';
import type {
  BattleEvent, BoardUnit, FamilyId, ItemId, RoleId, Star, StoneOp, TeamIndex, UnitStats, Winner,
} from './types';

const STONES: readonly ItemId[] = ['+1', '-1', 'x2', 'x3', '/2', '/3'];
const isStone = (i: ItemId): i is StoneOp => STONES.includes(i);

export interface Fighter {
  id: number;
  team: TeamIndex;
  /** 캐릭터 번호. 꼬마는 -1 */
  char: number;
  /** 지금 숫자(돌 적용 후) */
  num: number;
  star: Star;
  role: RoleId | null;
  minion: boolean;
  fams: FamilyId[];
  items: ItemId[];
  maxHp: number;
  hp: number;
  atk: number;
  shield: number;
  row: 0 | 1;
  col: number;
  alive: boolean;
  deathOrder: number;
  split: boolean;
  revived: boolean;
  stunFrom: number;
  stunUntil: number;
  weakFrom: number;
  weakUntil: number;
  stats: UnitStats;
}

export interface Synergy {
  fam: Record<FamilyId, number>;
  famCount: Record<FamilyId, number>;
  role: Record<RoleId, number>;
  roleCount: Record<RoleId, number>;
}

export interface BattleOptions {
  config?: BalanceConfig;
  log?: boolean;
  /** 팀별 피해 배율(%) — 밸런스 측정(파워 지수)용 */
  dmgMultPct?: [number, number];
}

export interface BattleResult {
  winner: Winner;
  beats: number;
  timeout: boolean;
  fighters: Fighter[];
  synergy: [Synergy, Synergy];
  /** 살아남은 친구 수(꼬마 제외) */
  survivors: [number, number];
  /** 쓰러뜨린 상대 친구 수(꼬마 제외) — 메달 계산용 */
  defeated: [number, number];
  events: BattleEvent[];
}

type Effect =
  | { kind: 'dmg'; src: Fighter; tgt: Fighter; amount: number }
  | { kind: 'heal' | 'shield'; src: Fighter; tgt: Fighter; amount: number }
  | { kind: 'stun' | 'weak'; src: Fighter; tgt: Fighter; beats: number }
  | { kind: 'revive'; src: Fighter };

const NEG = -1_000_000;

function newStats(): UnitStats {
  return { songs: 0, rehearsal: 0, songDamage: 0, basicDamage: 0, support: 0 };
}

/** 보드 입력 → 전투원. 돌이 잘못되면 오류. */
function makeFighters(board: readonly BoardUnit[], team: TeamIndex, cfg: BalanceConfig): Fighter[] {
  const seen = new Set<string>();
  return board.map((b, i) => {
    const key = `${b.row},${b.col}`;
    if (seen.has(key)) throw new Error(`팀 ${team}: ${key} 칸에 친구가 둘`);
    seen.add(key);
    if (b.col < 0 || b.col > 4) throw new Error(`칸 번호는 0~4: ${b.col}`);
    const def = unitDef(b.char, cfg);
    const items = (b.items ?? []).slice(0, 2);
    const stones = items.filter(isStone);
    const res = applyStones(b.char, stones);
    if (!res.ok) throw new Error(`팀 ${team} ${b.char}번: ${res.expr} — ${res.reason}`);
    const hp = def.hp * b.star;
    return {
      id: team * 100 + i,
      team,
      char: b.char,
      num: res.value,
      star: b.star,
      role: def.role,
      minion: false,
      fams: familiesOf(res.value),
      items,
      maxHp: hp,
      hp,
      atk: Math.floor((def.atk * b.star * cfg.atkPct) / 100),
      shield: 0,
      row: b.row,
      col: b.col,
      alive: true,
      deathOrder: -1,
      split: false,
      revived: false,
      stunFrom: NEG, stunUntil: NEG, weakFrom: NEG, weakUntil: NEG,
      stats: newStats(),
    };
  });
}

export function computeSynergy(fighters: readonly Fighter[], cfg: BalanceConfig = DEFAULT_CONFIG): Synergy {
  const famNums: Record<FamilyId, Set<number>> = { even: new Set(), tri: new Set(), five: new Set(), prime: new Set(), rich: new Set() };
  const roleChars: Record<RoleId, Set<number>> = { knight: new Set(), ninja: new Set(), hunter: new Set(), mage: new Set(), singer: new Set(), healer: new Set() };
  for (const f of fighters) {
    if (f.minion) continue;
    for (const fam of f.fams) famNums[fam].add(f.num);
    if (f.role) roleChars[f.role].add(f.char);
  }
  const fam = {} as Record<FamilyId, number>;
  const famCount = {} as Record<FamilyId, number>;
  for (const k of Object.keys(famNums) as FamilyId[]) {
    famCount[k] = famNums[k].size;
    fam[k] = tierOf(famCount[k], cfg.famTiers[k]);
  }
  const role = {} as Record<RoleId, number>;
  const roleCount = {} as Record<RoleId, number>;
  for (const k of Object.keys(roleChars) as RoleId[]) {
    roleCount[k] = roleChars[k].size;
    role[k] = tierOf(roleCount[k], cfg.roleTiers);
  }
  return { fam, famCount, role, roleCount };
}

const adjacent = (a: Fighter, b: Fighter) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
const byPos = (a: Fighter, b: Fighter) => a.row - b.row || a.col - b.col || a.id - b.id;

export function runBattle(boardA: readonly BoardUnit[], boardB: readonly BoardUnit[], opts: BattleOptions = {}): BattleResult {
  const cfg = opts.config ?? DEFAULT_CONFIG;
  const dmgMult = opts.dmgMultPct ?? [100, 100];
  const events: BattleEvent[] = [];
  const log = opts.log ? (e: BattleEvent) => events.push(e) : null;

  const teams: [Fighter[], Fighter[]] = [makeFighters(boardA, 0, cfg), makeFighters(boardB, 1, cfg)];
  const syn: [Synergy, Synergy] = [computeSynergy(teams[0], cfg), computeSynergy(teams[1], cfg)];
  const all = () => teams[0].concat(teams[1]);
  const isUp = (f: Fighter) => f.alive && f.hp > 0;
  const up = (t: TeamIndex) => teams[t].filter(isUp);
  const foesOf = (f: Fighter) => up((1 - f.team) as TeamIndex);
  const alliesOf = (f: Fighter) => up(f.team);
  let deathCounter = 0;
  let nextMinionId = [50, 150];
  const reviveUsed = [false, false];
  const fiveStacks = [0, 0];
  const defeated: [number, number] = [0, 0];
  let beat = 0;

  // ---------- 대상 고르기 ----------
  const colDist = (a: Fighter, b: Fighter) => Math.abs(a.col - b.col);
  function nearest(att: Fighter, list: Fighter[]): Fighter | null {
    let best: Fighter | null = null;
    for (const f of list) {
      if (!best) { best = f; continue; }
      const d = colDist(att, f) - colDist(att, best);
      if (d < 0 || (d === 0 && (f.col - best.col || f.id - best.id) < 0)) best = f;
    }
    return best;
  }
  /** 보통 대상: 앞줄 기사(도발) → 앞줄 → 뒷줄, 같은 줄에서는 내 세로줄에 가까운 칸 */
  function normalTarget(att: Fighter, foes: Fighter[]): Fighter | null {
    if (!foes.length) return null;
    const front = foes.filter((f) => f.row === 0);
    const taunt = front.filter((f) => !f.minion && f.role === 'knight');
    if (taunt.length) return nearest(att, taunt);
    if (front.length) return nearest(att, front);
    return nearest(att, foes);
  }
  /** 가장 먼 적부터: 뒷줄 먼 칸 → 앞줄 먼 칸 */
  function farthestOrder(att: Fighter, foes: Fighter[]): Fighter[] {
    const cmp = (a: Fighter, b: Fighter) => colDist(att, b) - colDist(att, a) || a.col - b.col || a.id - b.id;
    return foes.filter((f) => f.row === 1).sort(cmp).concat(foes.filter((f) => f.row === 0).sort(cmp));
  }
  function basicTarget(att: Fighter, foes: Fighter[]): Fighter | null {
    if (!foes.length) return null;
    if (!att.minion && att.role === 'ninja') {
      const back = foes.filter((f) => f.row === 1);
      return nearest(att, back.length ? back : foes);
    }
    if (!att.minion && att.role === 'hunter') return farthestOrder(att, foes)[0] ?? null;
    return normalTarget(att, foes);
  }
  /** 가장 아픈 친구(체력 비율이 낮은 순) */
  function mostHurt(list: Fighter[]): Fighter[] {
    return list.slice().sort((a, b) => a.hp * b.maxHp - b.hp * a.maxHp || byPos(a, b));
  }
  function frontRow(foes: Fighter[]): Fighter[] {
    const f = foes.filter((x) => x.row === 0);
    return (f.length ? f : foes.filter((x) => x.row === 1)).sort((a, b) => a.col - b.col || a.id - b.id);
  }

  // ---------- 피해 계산 ----------
  function reducePct(tgt: Fighter): number {
    const s = syn[tgt.team];
    let r = 0;
    if (!tgt.minion && tgt.role === 'knight') r += cfg.knightSelfReducePct[s.role.knight];
    else r += cfg.knightAllReducePct[s.role.knight];
    if (!tgt.minion && tgt.fams.includes('prime')) r += cfg.primeReducePct[s.fam.prime];
    return r;
  }
  function finalDamage(src: Fighter, tgt: Fighter, amount: number): number {
    const withMult = Math.floor((amount * dmgMult[src.team]) / 100);
    return Math.floor((withMult * (100 - reducePct(tgt))) / 100);
  }
  function applyDamage(src: Fighter, tgt: Fighter, amount: number, basic: boolean) {
    if (!isUp(tgt) || amount <= 0) return;
    const d = finalDamage(src, tgt, amount);
    const absorbed = Math.min(tgt.shield, d);
    tgt.shield -= absorbed;
    tgt.hp -= d - absorbed;
    if (basic) src.stats.basicDamage += d;
    else src.stats.songDamage += d;
    log?.({ beat, type: 'damage', src: src.id, tgt: tgt.id, amount: d, absorbed, basic });
  }
  function applyHeal(src: Fighter, tgt: Fighter, amount: number) {
    if (!isUp(tgt) || amount <= 0) return;
    const h = Math.min(tgt.maxHp - tgt.hp, amount);
    if (h <= 0) return;
    tgt.hp += h;
    src.stats.support += h;
    log?.({ beat, type: 'heal', src: src.id, tgt: tgt.id, amount: h });
  }
  function applyShield(src: Fighter, tgt: Fighter, amount: number) {
    if (!isUp(tgt) || amount <= 0) return;
    tgt.shield += amount;
    src.stats.support += amount;
    log?.({ beat, type: 'shield', src: src.id, tgt: tgt.id, amount });
  }
  function applyCC(src: Fighter, tgt: Fighter, kind: 'stun' | 'weak', n: number) {
    if (!isUp(tgt) || n <= 0) return;
    const fromKey = kind === 'stun' ? 'stunFrom' : 'weakFrom';
    const untilKey = kind === 'stun' ? 'stunUntil' : 'weakUntil';
    const until = tgt[untilKey];
    if (beat > until && beat <= until + cfg.ccImmuneBeats) return; // 면역
    if (beat > until) tgt[fromKey] = beat + 1;
    tgt[untilKey] = Math.max(until, beat + n);
    log?.({ beat, type: kind, src: src.id, tgt: tgt.id, beats: n });
  }
  const stunned = (f: Fighter) => beat >= f.stunFrom && beat <= f.stunUntil;
  const weakened = (f: Fighter) => beat >= f.weakFrom && beat <= f.weakUntil;

  // ---------- 노래 ----------
  /** 한 노래 안에서 여러 번 때릴 때 쓰는 예상 체력(다른 노래와는 공유하지 않음 = 동시) */
  function predictor() {
    const left = new Map<Fighter, number>();
    const get = (t: Fighter) => left.get(t) ?? t.hp + t.shield;
    return {
      get,
      alive: (t: Fighter) => get(t) > 0,
      hit: (src: Fighter, t: Fighter, amount: number) => left.set(t, get(t) - finalDamage(src, t, amount)),
    };
  }
  function lowest(list: Fighter[], p: ReturnType<typeof predictor>): Fighter | null {
    let best: Fighter | null = null;
    for (const f of list) {
      if (!p.alive(f)) continue;
      if (!best || p.get(f) < p.get(best) || (p.get(f) === p.get(best) && byPos(f, best) < 0)) best = f;
    }
    return best;
  }

  /** 노래 하나의 효과 목록. M = 피해 배율(%), H = 방패·회복 배율(%) */
  function songEffects(u: Fighter, M: number, H: number, rehearsal: boolean): Effect[] {
    const out: Effect[] = [];
    const n = u.num;
    const s = u.star;
    const foes = foesOf(u);
    const allies = alliesOf(u);
    const dmg = (tgt: Fighter | null, base: number) => {
      if (tgt) out.push({ kind: 'dmg', src: u, tgt, amount: Math.floor((base * M) / 100) });
    };
    const support = (tgt: Fighter | null, base: number, heal: boolean) => {
      if (tgt) out.push({ kind: heal && !rehearsal ? 'heal' : 'shield', src: u, tgt, amount: Math.floor((base * H) / 100) });
    };
    const cc = (tgt: Fighter | null, kind: 'stun' | 'weak', beats: number) => {
      if (tgt && !rehearsal && beats > 0) out.push({ kind, src: u, tgt, beats });
    };
    if (u.minion) {
      dmg(normalTarget(u, foes), n * cfg.minionSongCoef);
      return out;
    }
    const def = unitDef(u.char, cfg);
    const c = def.coef;
    const p = predictor();
    const hitPred = (tgt: Fighter | null, base: number) => {
      if (!tgt) return;
      const amount = Math.floor((base * M) / 100);
      p.hit(u, tgt, amount);
      out.push({ kind: 'dmg', src: u, tgt, amount });
    };
    switch (def.skill) {
      case 'conductor':
        break; // 지휘는 노래 모으기 단계에서 처리
      case 'twinHeal':
        mostHurt(allies).slice(0, 2).forEach((t) => support(t, n * c * s, true));
        break;
      case 'ding':
        dmg(normalTarget(u, foes), n * c * s);
        break;
      case 'shell':
        allies.filter((a) => a !== u && adjacent(a, u)).forEach((a) => support(a, n * c * s, false));
        break;
      case 'starfish': {
        const t = foes.slice().sort((a, b) => b.hp - a.hp || byPos(a, b))[0] ?? null;
        dmg(t, n * c * s);
        cc(t, 'stun', Math.floor(n / (def.ccDiv ?? 5)));
        break;
      }
      case 'honey': {
        const h = mostHurt(allies);
        const spoon = Math.floor((n * c * s * H) / 100);
        [3, 2, 1].forEach((k, i) => {
          if (h[i]) out.push({ kind: rehearsal ? 'shield' : 'heal', src: u, tgt: h[i], amount: spoon * k });
        });
        break;
      }
      case 'rainbowArrows':
        for (let i = 0; i < 7; i++) hitPred(farthestOrder(u, foes).find(p.alive) ?? null, n * c * s);
        break;
      case 'slap8': {
        let last: Fighter | null = null;
        for (let i = 0; i < 8; i++) {
          const t = lowest(foes, p);
          if (!t) break;
          hitPred(t, n * c * s);
          last = t;
        }
        cc(last, 'weak', Math.floor(n / (def.ccDiv ?? 4)));
        break;
      }
      case 'foxfire': {
        let idx = 0;
        for (let i = 0; i < n; i++) {
          const alive = foes.filter(p.alive);
          const row = frontRow(alive);
          if (!row.length) break;
          hitPred(row[idx % row.length], c * s);
          idx++;
        }
        break;
      }
      case 'strike': {
        const cols = new Map<number, Fighter[]>();
        for (const f of foes) cols.set(f.col, [...(cols.get(f.col) ?? []), f]);
        const best = [...cols.keys()].sort(
          (a, b) => cols.get(b)!.length - cols.get(a)!.length || Math.abs(a - u.col) - Math.abs(b - u.col) || a - b,
        )[0];
        if (best !== undefined) cols.get(best)!.forEach((f) => dmg(f, n * c * s));
        break;
      }
      case 'twinBlade':
        for (let i = 0; i < 2; i++) hitPred(lowest(foes, p), n * c * s);
        break;
      case 'clockStop':
        frontRow(foes).forEach((f) => cc(f, 'stun', Math.floor(n / (def.ccDiv ?? 6))));
        support(u, n * c * s, false);
        break;
      case 'baker': {
        const breads = new Map<Fighter, number>();
        allies.forEach((a) => breads.set(a, 1));
        let rest = 13 - allies.length;
        const h = mostHurt(allies);
        for (let i = 0; rest > 0 && h.length; i++, rest--) breads.set(h[i % h.length], (breads.get(h[i % h.length]) ?? 0) + 1);
        const per = Math.floor((n * c * s * H) / 100);
        for (const [a, k] of breads) out.push({ kind: rehearsal ? 'shield' : 'heal', src: u, tgt: a, amount: per * k });
        break;
      }
      case 'ricecake':
        frontRow(foes).forEach((f) => dmg(f, n * c * s));
        support(u, n * (def.coef2 ?? 0) * s, false);
        break;
      case 'halfPlane':
        farthestOrder(u, foes).slice(0, 4).forEach((f, i) => dmg(f, Math.floor((n * c * s) / 2 ** i)));
        break;
      case 'cicada':
        foes.forEach((f) => {
          dmg(f, n * c * s);
          cc(f, 'weak', Math.floor(n / (def.ccDiv ?? 6)));
        });
        break;
      case 'truck':
        frontRow(foes).forEach((f) => dmg(f, n * c * s));
        allies.forEach((a) => support(a, n * (def.coef2 ?? 0) * s, false));
        break;
      case 'riddle':
        foes.forEach((f) => {
          dmg(f, n * c * s);
          cc(f, 'stun', Math.floor(n / (def.ccDiv ?? 10)));
        });
        break;
      case 'dice':
        for (const pip of [1, 2, 3, 4, 5, 6, 6]) hitPred(lowest(foes, p), pip * n * c * s);
        break;
      case 'noon':
        foes.forEach((f) => dmg(f, n * c * s));
        allies.forEach((a) => support(a, n * c * s, true));
        break;
      case 'bingo': {
        const front = foes.filter((f) => f.row === 0);
        const back = foes.filter((f) => f.row === 1);
        (back.length > front.length ? back : front).forEach((f) => dmg(f, n * c * s));
        break;
      }
      case 'perfectBlades':
        // 칼 × 숫자 × 3 ÷ 4 — 마지막에 한 번 나눈다
        for (const blade of [1, 2, 4, 7, 14]) {
          const t = lowest(foes, p);
          if (!t) break;
          const amount = Math.floor((blade * n * c * s * M) / 400);
          p.hit(u, t, amount);
          out.push({ kind: 'dmg', src: u, tgt: t, amount });
        }
        break;
      case 'fullMoon':
        allies.forEach((a) => support(a, n * c * s, true));
        if (!rehearsal) out.push({ kind: 'revive', src: u });
        break;
      case 'dragon':
        foes.forEach((f) => dmg(f, n * c * s));
        break;
    }
    return out;
  }

  /** 효과를 동시에 적용: 방패·회복 → 피해 → 멈춤·약하게. 되살리기 요청은 돌려준다. */
  function applyEffects(effects: Effect[]): Fighter[] {
    const revives: Fighter[] = [];
    for (const e of effects) {
      if (e.kind === 'heal') applyHeal(e.src, e.tgt, e.amount);
      else if (e.kind === 'shield') applyShield(e.src, e.tgt, e.amount);
    }
    for (const e of effects) if (e.kind === 'dmg') applyDamage(e.src, e.tgt, e.amount, false);
    for (const e of effects) {
      if (e.kind === 'stun' || e.kind === 'weak') applyCC(e.src, e.tgt, e.kind, e.beats);
      else if (e.kind === 'revive') revives.push(e.src);
    }
    return revives;
  }

  // ---------- 쓰러짐 ----------
  function processDeaths(revivers: Fighter[]) {
    const newly: Fighter[] = [];
    for (const f of all().sort((a, b) => a.id - b.id)) {
      if (f.alive && f.hp <= 0) {
        f.alive = false;
        f.hp = 0;
        f.shield = 0;
        f.deathOrder = deathCounter++;
        if (!f.minion) defeated[(1 - f.team) as TeamIndex]++;
        newly.push(f);
        log?.({ beat, type: 'death', unit: f.id });
      }
    }
    // 되살리기(전투당 팀마다 1번): 가장 먼저 쓰러진 친구(꼬마·분열한 친구 제외)
    for (const r of revivers) {
      if (reviveUsed[r.team] || !isUp(r)) continue;
      const target = teams[r.team]
        .filter((f) => !f.alive && !f.minion && !f.split && !f.revived)
        .sort((a, b) => a.deathOrder - b.deathOrder)[0];
      if (!target) continue;
      reviveUsed[r.team] = true;
      target.alive = true;
      target.revived = true;
      target.hp = Math.floor(target.maxHp / 2);
      target.stunUntil = target.weakUntil = NEG;
      if (!target.minion) defeated[(1 - target.team) as TeamIndex]--;
      log?.({ beat, type: 'revive', src: r.id, tgt: target.id, hp: target.hp });
    }
    // 부자 분열(분신 주머니 포함)
    for (const f of newly) {
      if (f.alive || f.minion) continue;
      const richOn = f.fams.includes('rich') && syn[f.team].fam.rich > 0;
      const bag = f.items.includes('bag');
      if (!richOn && !bag) continue;
      const pair = splitPair(f.num);
      if (!pair) continue;
      const [pn, pd] = richOn ? cfg.richPower[syn[f.team].fam.rich] : cfg.richPower[1];
      f.split = true;
      const ids: number[] = [];
      for (const m of pair) {
        const minion: Fighter = {
          id: nextMinionId[f.team]++,
          team: f.team,
          char: -1,
          num: m,
          star: 1,
          role: null,
          minion: true,
          fams: [],
          items: [],
          maxHp: Math.floor((f.maxHp * pn) / pd),
          hp: Math.floor((f.maxHp * pn) / pd),
          atk: Math.floor((f.atk * pn) / pd),
          shield: 0,
          row: f.row,
          col: f.col,
          alive: true,
          deathOrder: -1,
          split: true,
          revived: false,
          stunFrom: NEG, stunUntil: NEG, weakFrom: NEG, weakUntil: NEG,
          stats: newStats(),
        };
        teams[f.team].push(minion);
        ids.push(minion.id);
      }
      log?.({ beat, type: 'split', unit: f.id, minions: ids });
    }
  }

  const winnerNow = (): Winner | null => {
    const a = up(0).length;
    const b = up(1).length;
    if (!a && !b) return 'draw';
    if (!a) return 1;
    if (!b) return 0;
    return null;
  };

  // ---------- 0박 ----------
  for (const t of [0, 1] as TeamIndex[]) {
    // 36 약수 금화
    for (const u of teams[t]) {
      if (unitDef(u.char, cfg).skill !== 'dragon') continue;
      const nums = new Set(teams[t].filter((x) => x !== u && x.num !== u.num && u.num % x.num === 0).map((x) => x.num));
      const coins = Math.min(cfg.coinMax, nums.size);
      u.maxHp += coins * cfg.coinHp;
      u.hp += coins * cfg.coinHp;
      u.atk += coins * cfg.coinAtk;
      log?.({ beat: 0, type: 'coins', unit: u.id, coins, nums: [...nums].sort((a, b) => a - b) });
    }
    // 손잡기
    const hs = new Map<Fighter, number>();
    const us = teams[t];
    for (let i = 0; i < us.length; i++) {
      for (let j = i + 1; j < us.length; j++) {
        const a = us[i];
        const b = us[j];
        if (!adjacent(a, b)) continue;
        const g = gcd(a.num, b.num);
        if (g < 2) continue;
        let v = g * cfg.handshakePerGcd;
        if (a.items.includes('glove') || b.items.includes('glove')) v *= 2;
        hs.set(a, (hs.get(a) ?? 0) + v);
        hs.set(b, (hs.get(b) ?? 0) + v);
      }
    }
    for (const [u, v] of hs) {
      const s = Math.min(cfg.handshakeCap, v);
      u.shield += s;
      log?.({ beat: 0, type: 'handshake', unit: u.id, shield: s });
    }
  }
  // 몸풀기 노래(지금 숫자 24 이상, 절반 힘, 보너스 없음)
  {
    const effects: Effect[] = [];
    for (const u of all()) {
      if (u.minion || u.num < cfg.rehearsalMinNumber || unitDef(u.char, cfg).skill === 'conductor') continue;
      u.stats.rehearsal++;
      log?.({ beat: 0, type: 'song', unit: u.id, rehearsal: true, mult: cfg.rehearsalPct });
      const rp = Math.floor((cfg.rehearsalPct * cfg.songPowerPct) / 100);
      effects.push(...songEffects(u, rp, rp, true));
    }
    applyEffects(effects);
    processDeaths([]);
  }

  let winner = winnerNow();

  // ---------- 1~48박 ----------
  while (winner === null && beat < cfg.maxBeat) {
    beat++;

    // ① 가문 박 효과
    for (const t of [0, 1] as TeamIndex[]) {
      const ft = syn[t].fam;
      if (beat % 3 === 0 && ft.tri) {
        const v = cfg.triShield[ft.tri];
        for (const u of up(t)) if (!u.minion && u.fams.includes('tri') && u.shield < v) u.shield = v;
        log?.({ beat, type: 'familyBeat', team: t, family: 'tri', value: v });
      }
      if (beat % 5 === 0 && ft.five && fiveStacks[t] < cfg.fiveMaxStacks) {
        fiveStacks[t]++;
        const v = cfg.fiveAtk[ft.five];
        for (const u of teams[t]) if (!u.minion && u.fams.includes('five')) u.atk += v;
        log?.({ beat, type: 'familyBeat', team: t, family: 'five', value: v });
      }
    }

    // ② 노래할 친구 모으기
    const effects: Effect[] = [];
    for (const t of [0, 1] as TeamIndex[]) {
      const ready = up(t).filter((u) => !stunned(u));
      const isConductor = (u: Fighter) => !u.minion && u.num === 1 && unitDef(u.char, cfg).skill === 'conductor';
      const regular = ready.filter((u) => !isConductor(u) && beat % u.num === 0);
      const conductors = ready.filter((u) => isConductor(u) && regular.some((r) => adjacent(r, u)));
      const singers = regular.concat(conductors);
      if (!singers.length) continue;
      let k = regular.length + conductors.length * cfg.conductorChorusCount;
      if (k >= 2) k += singers.filter((u) => u.items.includes('mic')).length;
      const st = syn[t];
      const primeOnly = st.fam.prime > 0 && singers.every((u) => !u.minion && u.fams.includes('prime'));
      const chorusBase = k >= 2 ? cfg.chorusPct[Math.min(k, 4)] : 100;
      const primeBase = primeOnly ? cfg.primeSongPct[st.fam.prime] : 100;
      const base = Math.max(chorusBase, primeBase);
      const fromChorus = k >= 2 && chorusBase >= primeBase;
      const supportBase = fromChorus ? 100 + Math.floor(((base - 100) * cfg.supportChorusBonusFactor) / 100) : base;
      const singerBonus = k >= 2 ? cfg.singerChorusPct[st.role.singer] : 0;
      log?.({ beat, type: 'chorus', team: t, singers: singers.map((u) => u.id), count: k, prime: primeOnly });

      for (const u of conductors) {
        u.stats.songs++;
        const others = regular.length;
        if (others >= cfg.conductorShieldMinOthers) {
          const target = mostHurt(up(t))[0];
          if (target) effects.push({ kind: 'shield', src: u, tgt: target, amount: others * unitDef(u.char, cfg).coef * u.star });
        }
        log?.({ beat, type: 'song', unit: u.id, rehearsal: false, mult: base });
      }
      for (const u of regular) {
        const mage = !u.minion && u.role === 'mage' ? cfg.mageSongPct[st.role.mage] : 0;
        const M = Math.min(cfg.songMultCapPct, base + mage + singerBonus);
        const H = Math.min(cfg.songMultCapPct, supportBase + mage + singerBonus + cfg.healerSupportPct[st.role.healer]);
        const sp = cfg.songPowerPct;
        u.stats.songs++;
        log?.({ beat, type: 'song', unit: u.id, rehearsal: false, mult: M });
        effects.push(...songEffects(u, Math.floor((M * sp) / 100), Math.floor((H * sp) / 100), false));
      }
    }
    // ③ 노래 동시 적용
    const revivers = applyEffects(effects);

    // ④ 기본 공격 동시
    const hits: [Fighter, Fighter, number][] = [];
    for (const t of [0, 1] as TeamIndex[]) {
      const st = syn[t];
      for (const u of up(t)) {
        if (stunned(u)) continue;
        const tgt = basicTarget(u, foesOf(u));
        if (!tgt) continue;
        let a = u.atk;
        if (!u.minion && u.role === 'ninja') a = Math.floor((a * (100 + cfg.ninjaAtkPct[st.role.ninja])) / 100);
        if (!u.minion && u.role === 'hunter') a = Math.floor((a * (100 + cfg.hunterAtkPct[st.role.hunter])) / 100);
        if (beat >= cfg.hotBeatFrom) a = Math.floor((a * cfg.hotBasicPct) / 100);
        if (weakened(u)) a = Math.floor((a * cfg.weakBasicPct) / 100);
        let total = a;
        if (beat % 2 === 0 && st.fam.even && !u.minion && u.fams.includes('even')) total += Math.floor((a * cfg.evenExtraPct[st.fam.even]) / 100);
        hits.push([u, tgt, total]);
      }
    }
    for (const [u, tgt, a] of hits) applyDamage(u, tgt, a, true);

    // ⑤ 쓰러짐
    processDeaths(revivers);
    winner = winnerNow();
  }

  let timeout = false;
  if (winner === null) {
    timeout = true;
    const a = up(0);
    const b = up(1);
    if (a.length !== b.length) winner = a.length > b.length ? 0 : 1;
    else {
      const ha = a.reduce((s, u) => s + u.hp, 0);
      const hb = b.reduce((s, u) => s + u.hp, 0);
      winner = ha === hb ? 'draw' : ha > hb ? 0 : 1;
    }
  }

  const survivors: [number, number] = [up(0).filter((f) => !f.minion).length, up(1).filter((f) => !f.minion).length];
  return { winner, beats: beat, timeout, fighters: all(), synergy: syn, survivors, defeated, events };
}
