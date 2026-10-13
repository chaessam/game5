// 한 판의 규칙(상점·경제·합체·라운드·메달). 화면과 분리된 순수 로직이라 2단계에서 서버(Durable Object)가 그대로 쓴다.
// 무작위는 상점·몬스터·보상에만 있고, 모두 GameState.rngState 하나로 재현된다.

import { UNITS, unitDef } from '../engine/data';
import { runBattle, type BattleResult } from '../engine/battle';
import type { BoardUnit, Star, StoneOp, TreasureId } from '../engine/types';
import { ECON, MEDALS, POOL, SHOP_ODDS, copiesOfStar } from './economy';
import type { BagItem, GameState, PendingReward, PlayerState, RoundPlan, Slot, UnitInst } from './types';

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
  difficulty?: 'easy' | 'normal' | 'hard';
  short?: boolean;
}

function newPlayer(id: number, name: string, isBot: boolean, difficulty: PlayerState['difficulty']): PlayerState {
  return {
    id, name, isBot, difficulty,
    gold: 0, level: ECON.minLevel, xp: 0, medals: 0, wins: 0, winStreak: 0, lossStreak: 0,
    board: new Map(), bench: Array(ECON.benchSize).fill(null), shop: Array(ECON.shopSize).fill(null),
    shopLocked: false, bag: [], stonesReceived: 0, consolationUsed: false, lastOpponent: null, lastSurvivors: 0, history: [],
  };
}

export function createGame(opts: NewGameOptions): GameState {
  const nBots = Math.max(1, Math.min(3, opts.bots ?? 3));
  const botNames = opts.botNames ?? ['똑딱이', '척척이', '번뜩이'];
  const pool: Record<number, number> = {};
  for (const tier of Object.values(POOL)) for (const u of tier.units) pool[u] = tier.copies;
  const g: GameState = {
    seed: opts.seed, rngState: opts.seed >>> 0, round: 0, rounds: roundPlans(opts.short), phase: 'prep',
    players: [newPlayer(0, opts.humanName ?? '나', false, 'easy')],
    pool, nextUid: 1, freePick: {}, pendingRewards: [], monsterIndex: 0, log: [],
  };
  for (let i = 0; i < nBots; i++) g.players.push(newPlayer(i + 1, `컴퓨터 ${botNames[i] ?? i + 1}`, true, opts.difficulty ?? 'easy'));
  startRound(g);
  return g;
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
      const items = three.flatMap((f) => f.unit.items);
      three.forEach((f) => removeAt(p, f.slot));
      merged = { uid: g.nextUid++, char, star: (star + 1) as Star, items: items.slice(0, 2) };
      addToBag(p, items.slice(2) as BagItem[]);
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

export function reroll(g: GameState, p: PlayerState): ActionResult {
  if (p.gold < ECON.rerollCost) return { ok: false, reason: '골드가 모자라요' };
  p.gold -= ECON.rerollCost;
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
  if (p.gold < ECON.xpCost) return { ok: false, reason: '골드가 모자라요' };
  p.gold -= ECON.xpCost;
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

// ---------------- 몬스터 ----------------
export interface Monster {
  name: string;
  board: BoardUnit[];
}
export function monsterFor(g: GameState): Monster {
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
export function income(p: PlayerState): { base: number; interest: number; streak: number; total: number } {
  const interest = Math.min(ECON.interestMax, Math.floor(p.gold / ECON.interestPer));
  const streak = Math.max(ECON.winStreakBonus(p.winStreak), ECON.lossStreakBonus(p.lossStreak));
  return { base: ECON.baseIncome, interest, streak, total: ECON.baseIncome + interest + streak };
}

export function startRound(g: GameState) {
  g.round++;
  const plan = currentPlan(g);
  g.monsterIndex = Math.floor(rand(g) * 2);
  for (const p of g.players) {
    p.gold += income(p).total;
    if (g.round >= ECON.autoXpFromRound) addXp(p, ECON.autoXpPerRound);
    if (!p.shopLocked || p.shop.every((c) => c === null)) rollShop(g, p);
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

function pairings(g: GameState): { a: number; b: number; mirror: boolean }[] {
  const n = g.players.length;
  const pvpRounds = g.rounds.filter((r) => r.kind === 'pvp');
  const k = pvpRounds.findIndex((r) => r.round === g.round);
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

function giveStones(p: PlayerState, items: BagItem[]) {
  const out: BagItem[] = [];
  for (const it of items) {
    const isStone = ['+1', '-1', 'x2', '/2', 'x3', '/3'].includes(it);
    if (isStone) {
      if (p.stonesReceived >= ECON.stoneCapPerGame) { p.gold += ECON.stoneOverflowGold; continue; }
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
  giveStones(p, r.options[index]);
  const cost = r.cardCost?.[index];
  if (cost) addCardToBench(g, p, cost);
  g.pendingRewards.splice(i, 1);
  return { ok: true };
}

/** 준비 끝 → 모든 전투 → 메달·골드·연승연패 → 보상 대기 또는 다음 라운드 준비 */
export function resolveRound(g: GameState): RoundOutcome {
  const plan = currentPlan(g);
  for (const p of g.players) autoFill(p);
  const out: RoundOutcome = { round: g.round, kind: plan.kind, fights: [], medals: {}, gold: {} };
  const addMedal = (p: PlayerState, m: number) => {
    p.medals += m;
    out.medals[p.id] = (out.medals[p.id] ?? 0) + m;
  };
  if (plan.kind === 'pve') {
    const mon = monsterFor(g);
    for (const p of g.players) {
      const result = runBattle(toBattleBoard(p), mon.board, { log: true });
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
    for (const pr of pairings(g)) {
      const A = g.players[pr.a];
      const B = g.players[pr.b];
      const result = runBattle(toBattleBoard(A), toBattleBoard(B), { log: true });
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
          giveStones(p, [pick(g, COMMON)]);
        }
      }
    }
  }
  g.phase = g.pendingRewards.length ? 'reward' : 'prep';
  return out;
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
  return g.players.slice().sort((a, b) => b.medals - a.medals || b.wins - a.wins || b.lastSurvivors - a.lastSurvivors);
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
