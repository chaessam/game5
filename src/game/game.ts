// 한 판의 규칙(상점·경제·합체·라운드·메달). 화면과 분리된 순수 로직이라 2단계에서 서버(Durable Object)가 그대로 쓴다.
// 무작위는 상점·몬스터·보상에만 있고, 모두 GameState.rngState 하나로 재현된다.

import { UNITS, unitDef } from '../engine/data';
import { runBattle, type BattleResult } from '../engine/battle';
import type { BoardUnit, Star, StoneOp, TreasureId } from '../engine/types';
import { ECON, MEDALS, POOL, SHOP_ODDS, copiesOfStar } from './economy';
import { fitItems } from './items';
import { MAGIC_CARDS, hasCard, magicRounds, modsOf, ruleById, ruleConfig } from './magic';
import type { BagItem, Difficulty, GameState, PendingReward, PlayerState, RoundPlan, Slot, UnitInst } from './types';

// ---------------- 난수 ----------------
export function rand(g: GameState): number {
  let a = (g.rngState = (g.rngState + 0x6d2b79f5) >>> 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(g: GameState, arr: readonly T[]): T => arr[Math.floor(rand(g) * arr.length)];

// ---------------- 라운드 계획 ----------------
export function roundPlans(short = false): RoundPlan[] {
  if (short) {
    return [1, 2, 3, 4, 5, 6, 7, 8].map((r) => ({ round: r, kind: r === 1 || r === 5 ? 'pve' : 'pvp', finale: r >= 7 }));
  }
  return Array.from({ length: 12 }, (_, i) => {
    const r = i + 1;
    return { round: r, kind: [1, 2, 6, 10].includes(r) ? 'pve' : 'pvp', finale: r >= 11 };
  });
}

// ---------------- 만들기 ----------------
export interface NewGameOptions {
  seed: number;
  humanName?: string;
  bots?: number; // 1~3
  botNames?: string[];
  difficulty?: Difficulty;
  /** 컴퓨터마다 난이도(없으면 difficulty) */
  difficulties?: Difficulty[];
  /** 시뮬레이션용: 0번 자리도 컴퓨터(이 난이도) */
  seatZeroBot?: Difficulty;
  short?: boolean;
  /** 이번 주 규칙 id(없으면 규칙 없음) */
  rule?: string | null;
  /** 짝꿍 팀전 2:2(4명일 때): 0·1번 자리 대 2·3번 자리 */
  teams?: boolean;
}

export const BOT_NAME: Record<Difficulty, string[]> = {
  easy: ['똑딱이', '말랑이', '데굴이'],
  normal: ['척척이', '반짝이', '쑥쑥이'],
  hard: ['번뜩이', '쌩쌩이', '우뚝이'],
};

function newPlayer(id: number, name: string, isBot: boolean, difficulty: PlayerState['difficulty']): PlayerState {
  return {
    id, name, isBot, difficulty,
    gold: 0, level: ECON.minLevel, xp: 0, medals: 0, wins: 0, winStreak: 0, lossStreak: 0,
    board: new Map(), bench: Array(ECON.benchSize).fill(null), shop: Array(ECON.shopSize).fill(null),
    shopLocked: false, bag: [], stonesReceived: 0, consolationUsed: false, lastOpponent: null, lastSurvivors: 0, history: [],
  };
}

export function createGame(opts: NewGameOptions): GameState {
  const nBots = Math.max(0, Math.min(3, opts.bots ?? 3)); // 0명은 튜토리얼(몬스터만)
  const diffs = Array.from({ length: nBots }, (_, i) => opts.difficulties?.[i] ?? opts.difficulty ?? 'easy');
  const used: Record<Difficulty, number> = { easy: 0, normal: 0, hard: 0 };
  const botNames = opts.botNames ?? diffs.map((d) => BOT_NAME[d][used[d]++ % 3]);
  const pool: Record<number, number> = {};
  for (const tier of Object.values(POOL)) for (const u of tier.units) pool[u] = tier.copies;
  const g: GameState = {
    seed: opts.seed, rngState: opts.seed >>> 0, round: 0, rounds: roundPlans(opts.short), phase: 'prep',
    players: [newPlayer(0, opts.seatZeroBot ? `컴퓨터 ${BOT_NAME[opts.seatZeroBot][2]}` : (opts.humanName ?? '나'), !!opts.seatZeroBot, opts.seatZeroBot ?? 'easy')],
    pool, nextUid: 1, freePick: {}, pendingRewards: [], monsterIndex: 0, log: [],
    rule: opts.rule ?? null,
  };
  for (let i = 0; i < nBots; i++) g.players.push(newPlayer(i + 1, `컴퓨터 ${botNames[i] ?? i + 1}`, true, diffs[i]));
  if (opts.teams && g.players.length === 4) g.teams = [0, 0, 1, 1];
  startRound(g);
  return g;
}

/**
 * 온라인 대결 판: 자리 순서대로 플레이어(내 자리만 직접 둠, 나머지는 원격). 서버는 mySeat = -1(모두 원격).
 * 같은 시드·사람 수면 서버와 모든 기기의 첫 상태가 같고, 라운드 결과도 resolveRound(g, { boards, pairs })로 똑같이 나온다.
 */
export function createOnlineGame(opts: { seed: number; short: boolean; names: string[]; mySeat: number; bots?: number[]; rule?: string | null; teams?: boolean }): GameState {
  const g = createGame({ seed: opts.seed, short: opts.short, bots: opts.names.length - 1, rule: opts.rule, teams: opts.teams });
  g.players.forEach((p, i) => {
    p.name = opts.names[i];
    // bots: 빈자리 컴퓨터(보통) 중 이 기기(방장)가 대신 두는 자리
    const drive = !!opts.bots?.includes(i) && i !== opts.mySeat;
    p.isBot = drive;
    p.difficulty = 'normal';
    p.remote = i !== opts.mySeat && !drive;
    if (p.remote) delete g.freePick[p.id];
  });
  if (g.phase === 'freePick' && !Object.keys(g.freePick).length) g.phase = 'prep';
  return g;
}

/** 서버 저장용(보드 Map → 배열) */
export function serializeGame(g: GameState): string {
  return JSON.stringify({ ...g, log: [], players: g.players.map((p) => ({ ...p, board: [...p.board.entries()] })) });
}
export function deserializeGame(s: string): GameState {
  const o = JSON.parse(s) as GameState & { players: (PlayerState & { board: [string, UnitInst][] })[] };
  return { ...o, players: o.players.map((p) => ({ ...p, board: new Map(p.board) })) };
}

/** 원격 친구(또는 유령)의 보드를 그대로 놓기 */
export function setBoardFrom(g: GameState, p: PlayerState, board: readonly BoardUnit[]) {
  p.board.clear();
  for (const u of board) p.board.set(cellKey(u.row, u.col), { uid: g.nextUid++, char: u.char, star: u.star, items: (u.items ?? []).slice(0, 2) });
  p.bench = Array(ECON.benchSize).fill(null);
}

export const currentPlan = (g: GameState): RoundPlan => g.rounds[g.round - 1];
export const lastRound = (g: GameState) => g.rounds.length;

// ---------------- 카드 풀·상점 ----------------
function drawCard(g: GameState, level: number): number | null {
  const odds = SHOP_ODDS[Math.min(ECON.maxLevel, Math.max(ECON.minLevel, level))];
  let r = rand(g) * 100;
  let cost = 1;
  for (let c = 0; c < 5; c++) {
    if (r < odds[c]) { cost = c + 1; break; }
    r -= odds[c];
  }
  for (let c = cost; c >= 1; c--) {
    const units = POOL[c].units.filter((u) => g.pool[u] > 0);
    const total = units.reduce((s, u) => s + g.pool[u], 0);
    if (!total) continue;
    let x = rand(g) * total;
    for (const u of units) {
      if (x < g.pool[u]) { g.pool[u]--; return u; }
      x -= g.pool[u];
    }
  }
  return null;
}

function returnShop(g: GameState, p: PlayerState) {
  p.shop.forEach((c, i) => {
    if (c !== null) g.pool[c]++;
    p.shop[i] = null;
  });
}

export function rollShop(g: GameState, p: PlayerState) {
  returnShop(g, p);
  for (let i = 0; i < ECON.shopSize; i++) p.shop[i] = drawCard(g, p.level);
}

// ---------------- 보드·대기석 ----------------
export const cellKey = (row: number, col: number) => `${row},${col}`;
export const boardCount = (p: PlayerState) => p.board.size;
export function allUnits(p: PlayerState): UnitInst[] {
  return [...p.board.values(), ...p.bench.filter((u): u is UnitInst => u !== null)];
}
export function findUnit(p: PlayerState, uid: number): { unit: UnitInst; slot: Slot } | null {
  for (const [k, u] of p.board) if (u.uid === uid) {
    const [row, col] = k.split(',').map(Number);
    return { unit: u, slot: { kind: 'board', row: row as 0 | 1, col } };
  }
  const i = p.bench.findIndex((u) => u?.uid === uid);
  return i >= 0 ? { unit: p.bench[i]!, slot: { kind: 'bench', index: i } } : null;
}
function removeAt(p: PlayerState, slot: Slot) {
  if (slot.kind === 'board') p.board.delete(cellKey(slot.row, slot.col));
  else p.bench[slot.index] = null;
}
function putAt(p: PlayerState, slot: Slot, u: UnitInst) {
  if (slot.kind === 'board') p.board.set(cellKey(slot.row, slot.col), u);
  else p.bench[slot.index] = u;
}
function unitAt(p: PlayerState, slot: Slot): UnitInst | null {
  return slot.kind === 'board' ? p.board.get(cellKey(slot.row, slot.col)) ?? null : p.bench[slot.index];
}

function addToBag(p: PlayerState, items: BagItem[]) {
  for (const it of items) {
    if (p.bag.length < ECON.bagSize) p.bag.push(it);
    else p.gold += ECON.stoneOverflowGold;
  }
}

/** 같은 친구(같은 성) 3명 → 한 성 위로. 보드에 있던 자리에 남는다. 연쇄 합체(2성 3명 → 3성)도 처리. */
export function mergeAll(g: GameState, p: PlayerState, char: number): UnitInst | null {
  let result: UnitInst | null = null;
  for (;;) {
    let merged: UnitInst | null = null;
    for (const star of [1, 2] as Star[]) {
      const found: { unit: UnitInst; slot: Slot }[] = [];
      for (const [k, u] of p.board) {
        if (u.char !== char || u.star !== star) continue;
        const [row, col] = k.split(',').map(Number);
        found.push({ unit: u, slot: { kind: 'board', row: row as 0 | 1, col } });
      }
      p.bench.forEach((u, i) => {
        if (u && u.char === char && u.star === star) found.push({ unit: u, slot: { kind: 'bench', index: i } });
      });
      if (found.length < 3) continue;
      const three = found.slice(0, 3);
      const { keep, extra } = fitItems(g, char, three.flatMap((f) => f.unit.items));
      three.forEach((f) => removeAt(p, f.slot));
      merged = { uid: g.nextUid++, char, star: (star + 1) as Star, items: keep };
      addToBag(p, extra as BagItem[]);
      putAt(p, three[0].slot, merged);
      break;
    }
    if (!merged) return result;
    result = merged;
  }
}

export type ActionResult = { ok: true; merged?: UnitInst | null } | { ok: false; reason: string };

/** 이 카드를 사면 바로 합체되는지(대기석이 꽉 차도 살 수 있는지) */
function wouldMerge(p: PlayerState, char: number) {
  return allUnits(p).filter((u) => u.char === char && u.star === 1).length >= 2;
}

export function buy(g: GameState, p: PlayerState, shopIndex: number): ActionResult {
  const char = p.shop[shopIndex];
  if (char == null) return { ok: false, reason: '빈 칸이에요' };
  const cost = UNITS[char].cost;
  if (p.gold < cost) return { ok: false, reason: '골드가 모자라요' };
  const free = p.bench.findIndex((u) => u === null);
  if (free < 0 && !wouldMerge(p, char)) return { ok: false, reason: '대기석이 꽉 찼어요' };
  p.gold -= cost;
  p.shop[shopIndex] = null;
  const unit: UnitInst = { uid: g.nextUid++, char, star: 1, items: [] };
  if (free >= 0) p.bench[free] = unit;
  else {
    // 대기석이 꽉 찼지만 합체되는 경우: 잠깐 9번째 칸에 둔 셈으로 합체
    p.bench.push(unit);
  }
  const merged = mergeAll(g, p, char);
  p.bench.length = ECON.benchSize;
  for (let i = 0; i < ECON.benchSize; i++) if (p.bench[i] === undefined) p.bench[i] = null;
  return { ok: true, merged };
}

export function sellValue(u: UnitInst): number {
  return UNITS[u.char].cost * copiesOfStar(u.star);
}

export function sell(g: GameState, p: PlayerState, uid: number): ActionResult {
  const f = findUnit(p, uid);
  if (!f) return { ok: false, reason: '없는 친구예요' };
  removeAt(p, f.slot);
  p.gold += sellValue(f.unit);
  g.pool[f.unit.char] += copiesOfStar(f.unit.star);
  addToBag(p, f.unit.items as BagItem[]);
  return { ok: true };
}

/** 이번 새로고침 값(마법 카드 '공짜 새로고침'이면 라운드 첫 번은 0) */
export const rerollCostOf = (g: GameState, p: PlayerState) => (hasCard(p.cards, 'reroll') && p.freeRollRound !== g.round ? 0 : ECON.rerollCost);
export const xpCostOf = (p: PlayerState) => ECON.xpCost - (hasCard(p.cards, 'xp') ? 1 : 0);

export function reroll(g: GameState, p: PlayerState): ActionResult {
  const cost = rerollCostOf(g, p);
  if (p.gold < cost) return { ok: false, reason: '골드가 모자라요' };
  p.gold -= cost;
  if (!cost) p.freeRollRound = g.round;
  rollShop(g, p);
  return { ok: true };
}

export function addXp(p: PlayerState, amount: number) {
  if (p.level >= ECON.maxLevel) return;
  p.xp += amount;
  while (p.level < ECON.maxLevel && p.xp >= ECON.xpToNext[p.level]) {
    p.xp -= ECON.xpToNext[p.level];
    p.level++;
  }
  if (p.level >= ECON.maxLevel) p.xp = 0;
}

export function buyXp(p: PlayerState): ActionResult {
  if (p.level >= ECON.maxLevel) return { ok: false, reason: '이미 최고 레벨이에요' };
  const cost = xpCostOf(p);
  if (p.gold < cost) return { ok: false, reason: '골드가 모자라요' };
  p.gold -= cost;
  addXp(p, ECON.xpAmount);
  return { ok: true };
}

export function toggleLock(p: PlayerState) {
  p.shopLocked = !p.shopLocked;
}

/** 친구 옮기기. 빈칸이면 옮기고, 친구가 있으면 서로 바꾼다. 보드 인원은 레벨까지. */
export function move(p: PlayerState, uid: number, to: Slot): ActionResult {
  const f = findUnit(p, uid);
  if (!f) return { ok: false, reason: '없는 친구예요' };
  if (to.kind === 'board' && (to.col < 0 || to.col > 4)) return { ok: false, reason: '보드 밖이에요' };
  const other = unitAt(p, to);
  if (other?.uid === uid) return { ok: true };
  if (f.slot.kind === 'bench' && to.kind === 'board' && !other && boardCount(p) >= p.level) {
    return { ok: false, reason: `레벨 ${p.level}: 보드에는 ${p.level}명까지 놓을 수 있어요` };
  }
  removeAt(p, f.slot);
  if (other) {
    removeAt(p, to);
    putAt(p, f.slot, other);
  }
  putAt(p, to, f.unit);
  return { ok: true };
}

/** 준비가 끝났는데 보드에 빈자리가 있으면 대기석 친구를 자동으로 올린다(값 × 성이 큰 순). */
export function autoFill(p: PlayerState) {
  if (p.ai?.keepEmpty) return; // 쉬움 컴퓨터가 일부러 비운 칸
  const bench = p.bench
    .map((u, i) => ({ u, i }))
    .filter((x): x is { u: UnitInst; i: number } => x.u !== null)
    .sort((a, b) => UNITS[b.u.char].cost * b.u.star - UNITS[a.u.char].cost * a.u.star);
  for (const { u, i } of bench) {
    if (boardCount(p) >= p.level) break;
    const prefRow: 0 | 1 = UNITS[u.char].role === 'knight' ? 0 : 1;
    const cell = [prefRow, (1 - prefRow) as 0 | 1]
      .flatMap((row) => [2, 1, 3, 0, 4].map((col) => ({ row, col })))
      .find((c) => !p.board.has(cellKey(c.row, c.col)));
    if (!cell) break;
    p.bench[i] = null;
    p.board.set(cellKey(cell.row, cell.col), u);
  }
}

export function toBattleBoard(p: PlayerState): BoardUnit[] {
  return [...p.board.entries()].map(([k, u]) => {
    const [row, col] = k.split(',').map(Number);
    return { char: u.char, star: u.star, row: row as 0 | 1, col, items: u.items };
  });
}

/** 상점을 정해 둔 카드로(튜토리얼). 원래 상점 카드는 풀로 돌려준다 */
export function setShop(g: GameState, p: PlayerState, chars: (number | null)[]) {
  returnShop(g, p);
  chars.slice(0, ECON.shopSize).forEach((c, i) => {
    if (c !== null && g.pool[c] > 0) {
      g.pool[c]--;
      p.shop[i] = c;
    }
  });
}

// ---------------- 몬스터 ----------------
export interface Monster {
  name: string;
  board: BoardUnit[];
}
export function monsterFor(g: GameState): Monster {
  const scripted = g.monsters?.[g.round];
  if (scripted) return scripted;
  const r = currentPlan(g).round;
  const pveIndex = g.rounds.filter((x) => x.kind === 'pve').findIndex((x) => x.round === r);
  const S = (char: number, star: Star, row: 0 | 1, col: number, extra: Partial<BoardUnit> = {}): BoardUnit => ({ char, star, row, col, ...extra });
  if (pveIndex === 0) return { name: '숫자 슬라임 2·3', board: [S(2, 1, 0, 1, { hpPct: 60, atkPct: 60 }), S(3, 1, 0, 3, { hpPct: 60, atkPct: 60 })] };
  if (pveIndex === 1 && g.rounds.length === 12) {
    return { name: '숫자 슬라임 2·3·4', board: [S(2, 1, 0, 1, { hpPct: 70, atkPct: 70 }), S(3, 1, 1, 2, { hpPct: 70, atkPct: 70 }), S(4, 1, 0, 3, { hpPct: 70, atkPct: 70 })] };
  }
  const boss = (pveIndex === 1 && g.rounds.length === 8) || pveIndex === 2;
  const options: Monster[] = boss
    ? [
        { name: '도깨비 대장 12 + 3·4', board: [S(12, 2, 0, 2, { items: ['bag'] }), S(3, 1, 1, 1), S(4, 2, 0, 3)] },
        { name: '트럭 거미 18 + 2·9', board: [S(18, 2, 0, 2, { items: ['bag'] }), S(2, 2, 1, 1), S(9, 1, 1, 3)] },
      ]
    : [
        { name: '구구단 드래곤 9 + 3·6', board: [S(9, 3, 0, 2, { items: ['bag'] }), S(3, 2, 1, 1), S(6, 2, 1, 3), S(4, 2, 0, 1)] },
        { name: '7단 해적 21 + 3·7', board: [S(21, 2, 0, 2, { items: ['bag'] }), S(3, 2, 1, 1), S(7, 2, 1, 3), S(15, 2, 0, 3)] },
      ];
  return options[g.monsterIndex % options.length];
}

// ---------------- 라운드 ----------------
export function income(p: PlayerState, g?: GameState | null): { base: number; interest: number; streak: number; total: number } {
  const max = ECON.interestMax + (hasCard(p.cards, 'piggy') ? 2 : 0) + (ruleById(g?.rule)?.econ?.interestPlus ?? 0);
  const interest = Math.min(max, Math.floor(p.gold / ECON.interestPer));
  const streak = Math.max(ECON.winStreakBonus(p.winStreak), ECON.lossStreakBonus(p.lossStreak));
  return { base: ECON.baseIncome, interest, streak, total: ECON.baseIncome + interest + streak };
}

export function startRound(g: GameState) {
  g.round++;
  const plan = currentPlan(g);
  g.monsterIndex = Math.floor(rand(g) * 2);
  for (const p of g.players) {
    p.gold += income(p, g).total;
    if (g.round >= ECON.autoXpFromRound) addXp(p, ECON.autoXpPerRound);
    if (!p.shopLocked || p.shop.every((c) => c === null)) rollShop(g, p);
  }
  // 숫자 마법 카드: 정해진 라운드에 3장 중 1장(직접 두는 자리만 — 온라인의 다른 친구는 자기 기기에서)
  if (magicRounds(g.rounds.length).includes(g.round) && !g.monsters) {
    for (const p of g.players) if (!p.remote) p.cardChoice = drawCards(g, p);
  }
  g.phase = 'prep';
  if (g.round === 1) {
    g.phase = 'freePick';
    for (const p of g.players) {
      const cands: number[] = [];
      for (let i = 0; i < 3; i++) {
        const c = drawOneCost(g);
        if (c !== null) cands.push(c);
      }
      g.freePick[p.id] = cands;
    }
  }
  g.log.push(`${g.round}라운드 시작 (${plan.kind === 'pve' ? '몬스터' : '친구 대결'})`);
}

function drawOneCost(g: GameState): number | null {
  const units = POOL[1].units.filter((u) => g.pool[u] > 0);
  if (!units.length) return null;
  const u = pick(g, units);
  g.pool[u]--;
  return u;
}

// ---------------- 숫자 마법 카드 ----------------
/** 아직 없는 카드 중 3장(경제 1장 이상, 전투 1장 이상 섞이게) */
function drawCards(g: GameState, p: PlayerState): string[] {
  const own = new Set(p.cards ?? []);
  const free = MAGIC_CARDS.filter((c) => !own.has(c.id));
  const econ = free.filter((c) => c.kind === 'econ');
  const battle = free.filter((c) => c.kind === 'battle');
  const take = (list: typeof free) => {
    const c = list.length ? pick(g, list) : null;
    if (c) list.splice(list.indexOf(c), 1);
    return c;
  };
  const out = [take(econ), take(battle)];
  const rest = econ.concat(battle);
  out.push(take(rest));
  // 섞기(첫 칸이 늘 경제 카드가 되지 않게)
  const ids = out.filter((c): c is (typeof free)[number] => !!c).map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand(g) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/** 마법 카드 고르기: 바로 받는 효과(골드·친구·돌)는 여기서 */
export function chooseCard(g: GameState, p: PlayerState, index: number): ActionResult {
  const id = p.cardChoice?.[index];
  if (!id) return { ok: false, reason: '고를 카드가 없어요' };
  p.cards = [...(p.cards ?? []), id];
  p.cardChoice = undefined;
  if (id === 'gold') p.gold += 5;
  if (id === 'piggy') p.gold += 4;
  if (id === 'mic') {
    p.gold += 3;
    addToBag(p, ['mic']);
  }
  if (id === 'gift') {
    addCardToBench(g, p, 2);
    addCardToBench(g, p, 2);
  }
  if (id === 'stones') giveStones(g, p, [pick(g, COMMON), pick(g, COMMON), pick(g, COMMON)]);
  return { ok: true };
}

/** 1라운드 무료 카드 고르기. 고르지 않은 후보는 풀로 돌아간다. */
export function chooseFreePick(g: GameState, p: PlayerState, index: number): ActionResult {
  const cands = g.freePick[p.id];
  if (!cands?.length) return { ok: false, reason: '고를 카드가 없어요' };
  const char = cands[index];
  cands.forEach((c, i) => {
    if (i !== index) g.pool[c]++;
  });
  delete g.freePick[p.id];
  const free = p.bench.findIndex((u) => u === null);
  p.bench[free] = { uid: g.nextUid++, char, star: 1, items: [] };
  if (Object.keys(g.freePick).length === 0) g.phase = 'prep';
  return { ok: true };
}

export interface Fight {
  a: number;
  /** 상대 플레이어 id. 몬스터면 -1 */
  b: number;
  mirror: boolean;
  label: string;
  result: BattleResult;
}

export interface RoundOutcome {
  round: number;
  kind: 'pve' | 'pvp';
  fights: Fight[];
  medals: Record<number, number>;
  gold: Record<number, number>;
}

export interface Pair {
  a: number;
  b: number;
  mirror: boolean;
}
/** 이번 라운드 친구 대결 짝(온라인: 서버가 정해서 보냄) */
export function pairings(g: GameState): Pair[] {
  const n = g.players.length;
  const pvpRounds = g.rounds.filter((r) => r.kind === 'pvp');
  const k = pvpRounds.findIndex((r) => r.round === g.round);
  if (g.teams && n === 4) {
    // 짝꿍 팀전: 상대 팀하고만, 번갈아 가며
    const A = [0, 1, 2, 3].filter((i) => g.teams![i] === 0);
    const B = [0, 1, 2, 3].filter((i) => g.teams![i] === 1);
    return k % 2 === 0
      ? [{ a: A[0], b: B[0], mirror: false }, { a: A[1], b: B[1], mirror: false }]
      : [{ a: A[0], b: B[1], mirror: false }, { a: A[1], b: B[0], mirror: false }];
  }
  if (n === 2) return [{ a: 0, b: 1, mirror: false }];
  if (n === 4) {
    const S = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];
    let s = S[k % 3];
    if (currentPlan(g).finale) {
      s = S.find((sch) => sch.every(([a, b]) => g.players[a].lastOpponent !== b)) ?? s;
    }
    return s.map(([a, b]) => ({ a, b, mirror: false }));
  }
  // 3명: 둘은 서로, 한 명은 '거울 친구'(다른 플레이어 보드 복사본)와
  const S3 = [
    [{ a: 0, b: 1, mirror: false }, { a: 2, b: 0, mirror: true }],
    [{ a: 0, b: 2, mirror: false }, { a: 1, b: 2, mirror: true }],
    [{ a: 1, b: 2, mirror: false }, { a: 0, b: 1, mirror: true }],
  ];
  return S3[k % 3];
}

const stoneCapOf = (g: GameState, p: PlayerState) => ECON.stoneCapPerGame + (hasCard(p.cards, 'stones') ? 3 : 0) + (ruleById(g.rule)?.econ?.stoneCapPlus ?? 0);

function giveStones(g: GameState, p: PlayerState, items: BagItem[]) {
  const out: BagItem[] = [];
  for (const it of items) {
    const isStone = ['+1', '-1', 'x2', '/2', 'x3', '/3'].includes(it);
    if (isStone) {
      if (p.stonesReceived >= stoneCapOf(g, p)) { p.gold += ECON.stoneOverflowGold; continue; }
      p.stonesReceived++;
    }
    out.push(it);
  }
  addToBag(p, out);
}

const COMMON: StoneOp[] = ['+1', '-1', 'x2', '/2'];
const RARE: StoneOp[] = ['x3', '/3'];
const TREASURES: TreasureId[] = ['mic', 'glove', 'bag'];

/** 몬스터 라운드 보상 선택지 */
function rewardOptions(g: GameState, p: PlayerState): PendingReward {
  const pveIndex = g.rounds.filter((x) => x.kind === 'pve').findIndex((x) => x.round === g.round);
  if (pveIndex === 0) return { playerId: p.id, options: [['+1'], ['-1']] };
  if (pveIndex === 1 && g.rounds.length === 12) return { playerId: p.id, options: [['x2'], ['/2']] };
  const late = pveIndex === 3;
  const c = () => pick(g, COMMON);
  const t = () => pick(g, TREASURES);
  const boxes: BagItem[][] = late ? [[pick(g, RARE), t()], [c()], [c(), t()]] : [[t(), c()], [c(), c()], [c()]];
  const cardCost: (number | null)[] = late ? [null, 4, null] : [null, null, 3];
  // 메달이 가장 적은 플레이어는 상자 하나 더(본인 화면에만)
  const minMedals = Math.min(...g.players.map((x) => x.medals));
  if (p.medals === minMedals && g.players.filter((x) => x.medals === minMedals).length === 1) {
    boxes.push([c(), t()]);
    cardCost.push(null);
  }
  // 이번 주 규칙 '돌 풍년': 모두 상자 하나 더
  if (ruleById(g.rule)?.econ?.extraBox) {
    boxes.push([c(), c()]);
    cardCost.push(null);
  }
  return { playerId: p.id, options: boxes, cardCost };
}

function addCardToBench(g: GameState, p: PlayerState, cost: number) {
  const units = POOL[cost].units.filter((u) => g.pool[u] > 0);
  if (!units.length) return;
  const char = pick(g, units);
  g.pool[char]--;
  const free = p.bench.findIndex((u) => u === null);
  if (free < 0) { p.gold += cost; g.pool[char]++; return; }
  p.bench[free] = { uid: g.nextUid++, char, star: 1, items: [] };
  mergeAll(g, p, char);
}

export function chooseReward(g: GameState, playerId: number, index: number): ActionResult {
  const i = g.pendingRewards.findIndex((r) => r.playerId === playerId);
  if (i < 0) return { ok: false, reason: '받을 보상이 없어요' };
  const r = g.pendingRewards[i];
  const p = g.players[playerId];
  giveStones(g, p, r.options[index]);
  const cost = r.cardCost?.[index];
  if (cost) addCardToBench(g, p, cost);
  g.pendingRewards.splice(i, 1);
  return { ok: true };
}

export interface ResolveOptions {
  /** 온라인: 자리마다 서버가 받은 보드(있으면 이 보드로 싸움, 자동 채우기 안 함) */
  boards?: (BoardUnit[] | null | undefined)[];
  /** 온라인: 서버가 정한 대결 짝 */
  pairs?: Pair[];
  /** 서버: 전투 기록·장면 없이 결과만(계산 아끼기) */
  light?: boolean;
  /** 온라인: 자리마다 마법 카드(서버가 받은 것) */
  cards?: (string[] | null | undefined)[];
}

/** 준비 끝 → 모든 전투 → 메달·골드·연승연패 → 보상 대기 또는 다음 라운드 준비 */
export function resolveRound(g: GameState, opts: ResolveOptions = {}): RoundOutcome {
  const plan = currentPlan(g);
  for (const p of g.players) if (!opts.boards?.[p.id]) autoFill(p);
  const boardOf = (p: PlayerState) => opts.boards?.[p.id] ?? toBattleBoard(p);
  const config = ruleConfig(g.rule);
  const modsFor = (p: PlayerState) => modsOf(opts.cards?.[p.id] ?? p.cards);
  const bopts = opts.light ? { config } : { config, log: true, frames: true };
  const out: RoundOutcome = { round: g.round, kind: plan.kind, fights: [], medals: {}, gold: {} };
  const addMedal = (p: PlayerState, m: number) => {
    p.medals += m;
    out.medals[p.id] = (out.medals[p.id] ?? 0) + m;
  };
  if (plan.kind === 'pve') {
    const mon = monsterFor(g);
    for (const p of g.players) {
      const result = runBattle(boardOf(p), mon.board, { ...bopts, mods: [modsFor(p), undefined] });
      const win = result.winner === 0;
      addMedal(p, win ? MEDALS.pve.win : MEDALS.pve.loss);
      if (win) {
        p.gold += ECON.pveWinGold;
        out.gold[p.id] = ECON.pveWinGold;
      }
      p.history.push({ round: g.round, kind: 'pve', opponent: mon.name, result: win ? 'win' : 'loss', medals: out.medals[p.id], beats: result.beats });
      out.fights.push({ a: p.id, b: -1, mirror: false, label: mon.name, result });
      g.pendingRewards.push(rewardOptions(g, p));
    }
  } else {
    for (const pr of opts.pairs ?? pairings(g)) {
      const A = g.players[pr.a];
      const B = g.players[pr.b];
      const result = runBattle(boardOf(A), boardOf(B), { ...bopts, mods: [modsFor(A), modsFor(B)] });
      out.fights.push({ a: pr.a, b: pr.b, mirror: pr.mirror, label: pr.mirror ? `거울 ${B.name}` : B.name, result });
      const sides: [PlayerState, 0 | 1][] = pr.mirror ? [[A, 0]] : [[A, 0], [B, 1]];
      for (const [p, side] of sides) {
        const opp = side === 0 ? B : A;
        const res = result.winner === 'draw' ? 'draw' : result.winner === side ? 'win' : 'loss';
        let m = res === 'win' ? MEDALS.pvp.win : res === 'draw' ? MEDALS.pvp.draw : MEDALS.pvp.loss;
        m += Math.min(MEDALS.pvp.perDefeatedMax, result.defeated[side] * MEDALS.pvp.perDefeated);
        if (res === 'win' && plan.finale) m += MEDALS.pvp.finaleWinBonus;
        addMedal(p, m);
        if (res === 'win') { p.wins++; p.winStreak++; p.lossStreak = 0; }
        else if (res === 'loss') { p.lossStreak++; p.winStreak = 0; }
        else { p.winStreak = 0; p.lossStreak = 0; }
        p.lastOpponent = pr.mirror ? null : opp.id;
        p.lastSurvivors = result.survivors[side];
        p.history.push({ round: g.round, kind: 'pvp', opponent: pr.mirror ? `거울 ${opp.name}` : opp.name, result: res, medals: out.medals[p.id], beats: result.beats });
        // 3연패 위로 상자(본인만, 한 판 1번): 돌 1개
        if (p.lossStreak === 3 && !p.consolationUsed) {
          p.consolationUsed = true;
          giveStones(g, p, [pick(g, COMMON)]);
        }
      }
    }
  }
  // 짝꿍 팀전: 같은 라운드에 둘 다 이기면 메달 +1씩
  if (g.teams && plan.kind === 'pvp') {
    for (const team of [0, 1]) {
      const mates = g.players.filter((q) => g.teams![q.id] === team);
      if (mates.length === 2 && mates.every((q) => q.history.at(-1)?.round === g.round && q.history.at(-1)?.result === 'win')) {
        for (const q of mates) addMedal(q, TEAM_BOTH_WIN_BONUS);
      }
    }
  }
  g.phase = g.pendingRewards.length ? 'reward' : 'prep';
  return out;
}

/** 짝꿍 팀전: 둘 다 이긴 라운드 보너스 메달 */
export const TEAM_BOTH_WIN_BONUS = 1;

/** 짝꿍 팀전: 팀마다 메달 합 */
export function teamTotals(g: GameState): [number, number] {
  const t: [number, number] = [0, 0];
  if (g.teams) g.players.forEach((p) => (t[g.teams![p.id] as 0 | 1] += p.medals));
  return t;
}
export const partnerOf = (g: GameState, p: PlayerState): PlayerState | null =>
  g.teams ? (g.players.find((q) => q.id !== p.id && g.teams![q.id] === g.teams![p.id]) ?? null) : null;

/** 짝꿍에게 친구 보내기(라운드마다 1번): 보내는 쪽 */
export function takeForGift(g: GameState, p: PlayerState, uid: number): ActionResult & { unit?: UnitInst } {
  if (!g.teams) return { ok: false, reason: '짝꿍 팀전에서만 보낼 수 있어요' };
  if (p.giftRound === g.round) return { ok: false, reason: '이번 라운드에는 이미 보냈어요' };
  const f = findUnit(p, uid);
  if (!f) return { ok: false, reason: '없는 친구예요' };
  removeAt(p, f.slot);
  p.giftRound = g.round;
  return { ok: true, unit: f.unit };
}
/** 받는 쪽: 대기석에 자리가 없으면 그 값만큼 골드 */
export function receiveGift(g: GameState, p: PlayerState, u: Pick<UnitInst, 'char' | 'star' | 'items'>) {
  const free = p.bench.findIndex((x) => x === null);
  if (free < 0) {
    p.gold += sellValue({ uid: 0, char: u.char, star: u.star, items: [] });
    return;
  }
  p.bench[free] = { uid: g.nextUid++, char: u.char, star: u.star, items: u.items.slice(0, 2) };
  mergeAll(g, p, u.char);
}
/** 혼자 하는 팀전(짝꿍이 이 기기에 있음) */
export function giftUnit(g: GameState, from: PlayerState, uid: number): ActionResult {
  const mate = partnerOf(g, from);
  if (!mate) return { ok: false, reason: '짝꿍이 없어요' };
  const r = takeForGift(g, from, uid);
  if (!r.ok) return r;
  receiveGift(g, mate, r.unit!);
  return { ok: true };
}

/** 보상을 다 고른 뒤 호출: 다음 라운드 시작 또는 게임 끝 */
export function advance(g: GameState) {
  if (g.pendingRewards.length) return;
  if (g.round >= lastRound(g)) {
    g.phase = 'over';
    return;
  }
  startRound(g);
}

export function ranking(g: GameState): PlayerState[] {
  const tt = teamTotals(g);
  const team = (p: PlayerState) => (g.teams ? tt[g.teams[p.id] as 0 | 1] : 0);
  return g.players.slice().sort((a, b) => team(b) - team(a) || b.medals - a.medals || b.wins - a.wins || b.lastSurvivors - a.lastSurvivors);
}

/** 상점 카드 '사면' 띠: 이 카드를 사면 가문·직업 인원이 어떻게 바뀌나(보드 기준) */
export function ownedCount(p: PlayerState, char: number, star: Star = 1) {
  return allUnits(p).filter((u) => u.char === char && u.star === star).length;
}

export { unitDef };

/** 이번 라운드 상대 이름(준비 화면 '다음 상대' 표시용) */
export function opponentPreview(g: GameState, playerId: number): string {
  const plan = currentPlan(g);
  if (!plan) return '';
  if (plan.kind === 'pve') return monsterFor(g).name;
  const pr = pairings(g).find((x) => x.a === playerId || (!x.mirror && x.b === playerId));
  if (!pr) return '';
  const other = pr.a === playerId ? pr.b : pr.a;
  return pr.mirror && pr.a === playerId ? `거울 ${g.players[other].name}` : g.players[other].name;
}

/** 이번 라운드 상대(구경용): 몬스터면 보드, 친구면 플레이어 번호(거울이면 mirror) */
export function opponentOf(
  g: GameState,
  playerId: number,
): { kind: 'pve'; name: string; board: BoardUnit[] } | { kind: 'pvp'; id: number; mirror: boolean } | null {
  const plan = currentPlan(g);
  if (!plan) return null;
  if (plan.kind === 'pve') {
    const m = monsterFor(g);
    return { kind: 'pve', name: m.name, board: m.board };
  }
  const pr = pairings(g).find((x) => x.a === playerId || (!x.mirror && x.b === playerId));
  if (!pr) return null;
  return { kind: 'pvp', id: pr.a === playerId ? pr.b : pr.a, mirror: pr.mirror && pr.a === playerId };
}
