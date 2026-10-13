// 컴퓨터 플레이어(기획서 10절). 사람과 같은 규칙·같은 확률·같은 카드 풀, 골드 보너스 없음.
// 쉬움(똑딱이): 무작위로 사되 합체는 꼭, 새로고침·레벨업 구매 없음, 가끔 한 칸 비움, 크게 앞서면 봐주기.
// 보통(척척이): 목표 가문 1개 + 직업 1개, 저금 10 지키기, 라운드별 레벨 목표, 손잡기 배치, 돌은 점수가 가장 오르는 곳.
// 어려움(번뜩이): 메타 덱을 골라 남은 카드 수를 보고 갈아탐, 후보 판을 이번 상대와 모의 전투(최대 40번), 돌 순서까지 탐색, 10%는 두 번째 안.
// 모든 무작위는 GameState 난수(rand)를 써서 같은 시드 = 같은 판.

import { DEFAULT_CONFIG, UNITS } from '../engine/data';
import { familiesOf } from '../engine/math';
import { runBattle } from '../engine/battle';
import type { BoardUnit, ItemId, TreasureId } from '../engine/types';
import { META_DECKS } from '../sim/decks';
import { placements } from '../sim/arena';
import { ECON } from './economy';
import {
  allUnits, buy, buyXp, cellKey, chooseFreePick, chooseReward, lastRound, opponentOf, ownedCount, rand, reroll, sell,
  toBattleBoard,
} from './game';
import { FAM_ORDER, ROLE_ORDER, checkItems, equip, isStoneItem, numberOf, planEquip, slotCount, synergyOf } from './items';
import type { BagItem, GameState, PlayerState, UnitInst } from './types';

type Piece = Pick<UnitInst, 'char' | 'star' | 'items'>;
const value = (u: Pick<UnitInst, 'char' | 'star'>) => UNITS[u.char].cost * 3 ** (u.star - 1);
/**
 * 어려움이 아는 '메타': 덱 고정 전체 판 시뮬레이션(tools/ai-sim.ts --decks, 140판, 하나쌤 3골드 반영)의 평균 순위로 만든 가산점.
 * 평균 순위 2.5보다 좋을수록 +, 나쁠수록 −. 수치를 바꾸면 다시 재서 고친다.
 */
const DECK_PRIOR: Record<string, number> = {
  '다이아+하나쌤': 4, '헌터': 3, '다이아 독창': 3, '하이파이브 마법': 2, '닌자': 2, '짝꿍 가문': 2, '큰 수': 1,
  '기사 성벽': -1, '세모 가문': -2, '작은 수': -2, '힐러 합창': -2, '변신 부자(돌 4)': -3, '대합창': -4, '대합창(하나쌤)': -4,
};
const deckChars = (name?: string) => (name ? (META_DECKS[name] ?? []).map((c) => (typeof c === 'number' ? c : c.c)) : []);

// ---------------- 판 점수(보통·어려움) ----------------
/** 값 + 가문·직업 단계 + 합창 박(36박까지) + 다이아 혼자 박 */
export function boardScore(units: readonly Piece[]): number {
  const s = synergyOf(units);
  let sc = 0;
  for (const u of units) sc += value(u) * 10;
  for (const f of FAM_ORDER) sc += s.fam[f].tier * 14;
  for (const r of ROLE_ORDER) sc += s.role[r].tier * 9;
  const nums = units.map(numberOf).filter((n) => n !== 1);
  const primeOn = s.fam.prime.tier > 0;
  for (let b = 1; b <= 36; b++) {
    const sing = nums.filter((n) => b % n === 0);
    if (sing.length >= 2) sc += (sing.length - 1) * 2.5;
    else if (sing.length === 1 && primeOn && familiesOf(sing[0]).includes('prime')) sc += 1.5;
  }
  if (units.some((u) => u.char === 1 && numberOf(u) === 1)) sc += 6;
  return sc;
}

/** 가진 친구 중 n명을 점수가 가장 오르게 하나씩 고른다 */
function pickBoard(p: PlayerState, n: number, bonus: (u: UnitInst) => number = () => 0): UnitInst[] {
  const pool = allUnits(p);
  const chosen: UnitInst[] = [];
  while (chosen.length < Math.min(n, pool.length)) {
    let best: UnitInst | null = null;
    let bestSc = -Infinity;
    for (const u of pool) {
      if (chosen.includes(u)) continue;
      // 같은 캐릭터 두 명은 가문에 한 번만 세서 손해: 다른 친구가 있으면 피한다
      const dup = chosen.some((x) => x.char === u.char) ? value(u) * 10 + 20 : 0;
      const sc = boardScore([...chosen, u]) + bonus(u) - dup;
      if (sc > bestSc) {
        bestSc = sc;
        best = u;
      }
    }
    chosen.push(best!);
  }
  return chosen;
}

/** 고른 친구를 손잡기가 가장 커지게 놓고, 나머지는 대기석으로 */
function placeBoard(g: GameState, p: PlayerState, chosen: UnitInst[], restarts = 12) {
  const all = allUnits(p);
  p.board.clear();
  if (chosen.length) {
    const pieces = chosen.map((u) => ({ c: u.char, s: u.star, stones: u.items.filter(isStoneItem), treasures: u.items.filter((i) => !isStoneItem(i)) as TreasureId[] }));
    const [best] = placements(pieces, 1, Math.floor(rand(g) * 1e9), DEFAULT_CONFIG, restarts);
    best.forEach((b, i) => p.board.set(cellKey(b.row, b.col), chosen[i]));
  }
  const rest = all.filter((u) => !chosen.includes(u)).sort((a, b) => value(b) - value(a));
  p.bench = Array(ECON.benchSize).fill(null);
  rest.slice(0, ECON.benchSize).forEach((u, i) => (p.bench[i] = u));
}

/** 쉬움용: 값이 큰 친구부터, 기사는 앞줄 */
export function arrangeBoard(p: PlayerState) {
  const units = allUnits(p).sort((a, b) => value(b) - value(a) || a.uid - b.uid);
  const onBoard = units.slice(0, p.level);
  const rest = units.slice(p.level);
  p.board.clear();
  const cols = [2, 1, 3, 0, 4];
  const used = new Set<string>();
  const place = (u: UnitInst) => {
    const pref: (0 | 1)[] = UNITS[u.char].role === 'knight' ? [0, 1] : [1, 0];
    for (const row of pref) {
      for (const col of cols) {
        const k = cellKey(row, col);
        if (!used.has(k)) {
          used.add(k);
          p.board.set(k, u);
          return;
        }
      }
    }
  };
  const knights = onBoard.filter((u) => UNITS[u.char].role === 'knight');
  const others = onBoard.filter((u) => UNITS[u.char].role !== 'knight');
  knights.forEach(place);
  if (!knights.length && others.length) {
    const tank = others.sort((a, b) => UNITS[b.char].hp * b.star - UNITS[a.char].hp * a.star)[0];
    used.add(cellKey(0, 2));
    p.board.set(cellKey(0, 2), tank);
    others.filter((u) => u !== tank).forEach(place);
  } else others.forEach(place);
  p.bench = Array(ECON.benchSize).fill(null);
  rest.slice(0, ECON.benchSize).forEach((u, i) => (p.bench[i] = u));
}

// ---------------- 경제 ----------------
/** 라운드별 레벨 목표(12라운드 기준, 짧은 판은 비례) */
function levelTarget(g: GameState, hard: boolean): number {
  const r = Math.round((g.round * 12) / g.rounds.length);
  const T: [number, number][] = hard ? [[2, 4], [4, 5], [6, 6], [8, 7], [10, 8]] : [[2, 4], [5, 5], [7, 6], [9, 7], [11, 8]];
  let t = ECON.minLevel;
  for (const [round, lv] of T) if (r >= round) t = lv;
  return t;
}
/** 저금(이자)을 지키는 선: 마지막 두 라운드 전까지 10 */
const reserve = (g: GameState) => (g.round >= lastRound(g) - 1 ? 0 : ECON.interestPer);

/** 크게 앞서면 봐주기(사람이 있을 때만) */
function farAhead(g: GameState, p: PlayerState): boolean {
  const humans = g.players.filter((x) => !x.isBot);
  return humans.length > 0 && p.medals - Math.max(...humans.map((h) => h.medals)) >= 6;
}

const benchFree = (p: PlayerState) => p.bench.filter((u) => u === null).length;

/** 카드 점수: 합체 > 목표 덱·가문·직업 > 비싼 카드 */
function cardScore(p: PlayerState, char: number): number {
  let s = 0;
  const own1 = ownedCount(p, char, 1);
  if (own1 >= 2) s += 10;
  else if (own1 === 1) s += 4;
  if (ownedCount(p, char, 2) >= 1) s += 2;
  const m = p.ai ?? {};
  if (m.fam && familiesOf(char).includes(m.fam)) s += 3;
  if (m.role && UNITS[char].role === m.role) s += 2;
  if (deckChars(m.deck).includes(char)) s += 6;
  return s + UNITS[char].cost * 0.6;
}

/** 대기석이 꽉 차면 가장 덜 필요한 친구를 판다 */
function makeRoom(g: GameState, p: PlayerState, keepChar: number): boolean {
  if (benchFree(p) > 0) return true;
  const cands = p.bench
    .filter((u): u is UnitInst => u !== null && u.char !== keepChar)
    .sort((a, b) => cardScore(p, a.char) + value(a) * 2 - (cardScore(p, b.char) + value(b) * 2));
  const victim = cands[0];
  if (!victim) return false;
  return sell(g, p, victim.uid).ok;
}

/** 상점에서 점수 순으로 산다 */
function shopRound(g: GameState, p: PlayerState, minScore: number, keep: number) {
  const order = p.shop
    .map((c, i) => ({ c, i }))
    .filter((x): x is { c: number; i: number } => x.c !== null)
    .sort((a, b) => cardScore(p, b.c) - cardScore(p, a.c));
  for (const { c, i } of order) {
    const sc = cardScore(p, c);
    const cost = UNITS[c].cost;
    const merge = ownedCount(p, c, 1) >= 2;
    const short = allUnits(p).length < p.level;
    if (p.gold < cost) continue;
    if (!merge && sc < minScore && !short) continue;
    if (!merge && p.gold - cost < keep && !short) continue;
    if (!merge && benchFree(p) === 0 && !(sc >= minScore + 3 && makeRoom(g, p, c))) continue;
    buy(g, p, i);
  }
}

/** 목표 가문·직업(보통): 가진 친구의 지금 숫자·캐릭터로 가장 많이 모인 것 */
function chooseTargets(p: PlayerState) {
  const units = allUnits(p);
  const nums = new Set(units.map(numberOf));
  const chars = new Set(units.map((u) => u.char));
  let fam = p.ai?.fam;
  let best = -1;
  for (const f of FAM_ORDER) {
    const c = [...nums].filter((n) => familiesOf(n).includes(f)).length + (f === 'even' ? 0.3 : 0);
    if (c > best) {
      best = c;
      fam = f;
    }
  }
  let role = p.ai?.role;
  best = -1;
  for (const r of ROLE_ORDER) {
    const c = [...chars].filter((ch) => UNITS[ch].role === r).length;
    if (c > best) {
      best = c;
      role = r;
    }
  }
  p.ai = { ...(p.ai ?? {}), fam, role };
}

/** 메타 덱 고르기(어려움): 가진 카드 + 남은 카드 수, 다른 컴퓨터와 겹치면 감점 */
function chooseDeck(g: GameState, p: PlayerState) {
  if (p.ai?.lockDeck) return;
  const owned = (c: number) => allUnits(p).filter((u) => u.char === c).reduce((s, u) => s + 3 ** (u.star - 1), 0);
  let bestName = p.ai?.deck;
  let bestSc = -Infinity;
  let curSc = -Infinity;
  for (const name of Object.keys(META_DECKS)) {
    const chars = deckChars(name);
    let sc = 0;
    for (const c of chars) sc += owned(c) * 3 + Math.min(g.pool[c] ?? 0, 6) * 0.4 - (UNITS[c].cost >= 4 && p.level < 6 ? 1 : 0);
    sc += (DECK_PRIOR[name] ?? 0) * 2;
    for (const q of g.players) if (q !== p && q.ai?.deck === name) sc -= 6;
    if (name === p.ai?.deck) curSc = sc;
    if (sc > bestSc) {
      bestSc = sc;
      bestName = name;
    }
  }
  // 갈아타기: 지금 덱보다 30% 넘게 좋을 때만
  if (!p.ai?.deck || bestSc > curSc * 1.3 + 2) p.ai = { ...(p.ai ?? {}), deck: bestName };
}

// ---------------- 아이템 ----------------
/** 돌·보물을 판 점수가 가장 오르는 곳에(어려움은 두 돌의 순서까지) */
/** keep(u, 새 숫자) = false면 그 돌은 쓰지 않는다(목표 덱·가문의 숫자를 지키기) */
function useItems(g: GameState, p: PlayerState, chosen: UnitInst[], orders: boolean, keep: (u: UnitInst, n: number) => boolean = () => true) {
  for (let iter = 0; iter < 6 && p.bag.length; iter++) {
    const base = boardScore(chosen);
    let best: { bi: number; u: UnitInst; items: ItemId[]; gain: number } | null = null;
    p.bag.forEach((item, bi) => {
      for (const u of chosen) {
        if (u.char === 1 && isStoneItem(item)) continue; // 하나쌤은 1이어야 지휘한다
        const tries: ItemId[][] = [];
        const plan = planEquip(g, u, item);
        if (plan.ok) tries.push(plan.items);
        if (orders && u.items.length === 1 && slotCount(g) === 2) tries.push([item, ...u.items]);
        for (const items of tries) {
          const r = checkItems(u.char, items);
          if (!r.ok || !keep(u, r.value)) continue;
          let gain = boardScore(chosen.map((x) => (x === u ? { ...x, items } : x))) - base;
          if (!isStoneItem(item)) gain += treasureGain(item, u, chosen);
          if (gain > (best?.gain ?? 0.5)) best = { bi, u, items, gain };
        }
      }
    });
    if (!best) break;
    const b = best as { bi: number; u: UnitInst; items: ItemId[]; gain: number };
    const plan = planEquip(g, b.u, p.bag[b.bi]);
    if (plan.ok && plan.items.join() === b.items.join()) equip(g, p, b.u, b.bi);
    else {
      // 순서를 바꿔 끼우기(앞 칸에 새 돌)
      p.bag.splice(b.bi, 1);
      b.u.items = b.items;
    }
  }
  // 돌을 끼웠는데 숫자가 제자리(예: 20 ÷ 2 × 2)면 돌을 가방으로
  for (const u of chosen) {
    const stones = u.items.filter(isStoneItem);
    if (stones.length && numberOf(u) === u.char && p.bag.length + stones.length <= ECON.bagSize) {
      u.items = u.items.filter((i) => !isStoneItem(i));
      p.bag.push(...stones);
    }
  }
}

function treasureGain(item: BagItem, u: UnitInst, chosen: UnitInst[]): number {
  if (u.items.some((i) => !isStoneItem(i))) return -5; // 보물은 친구마다 하나만
  const n = numberOf(u);
  if (item === 'mic') {
    const others = chosen.filter((x) => x !== u).map(numberOf);
    let shared = 0;
    for (let b = n; b <= 36; b += n) if (others.some((m) => m !== 1 && b % m === 0)) shared++;
    return shared * 1.5;
  }
  if (item === 'bag') return familiesOf(n).includes('prime') || n < 4 ? -5 : value(u) * 1.2;
  return value(u) * 0.8; // glove
}

// ---------------- 난이도별 준비 ----------------
function easyPrep(g: GameState, p: PlayerState) {
  const ahead = farAhead(g, p);
  p.shop.forEach((c, i) => {
    if (c !== null && ownedCount(p, c) > 0 && p.gold >= UNITS[c].cost) buy(g, p, i);
  });
  if (!ahead) {
    for (let i = 0; i < p.shop.length; i++) {
      const c = p.shop[i];
      if (c === null || p.gold < UNITS[c].cost) continue;
      if (rand(g) < 0.5) buy(g, p, i);
    }
  }
  // 돌: 반쯤은 아무 친구에게나 끼워 본다
  if (p.bag.length && rand(g) < 0.5) {
    const us = allUnits(p);
    const u = us[Math.floor(rand(g) * us.length)];
    if (u) equip(g, p, u, Math.floor(rand(g) * p.bag.length));
  }
  arrangeBoard(p);
  // 30%(앞서면 항상) 한 칸 비우기
  const keepEmpty = p.board.size >= 2 && (ahead || rand(g) < 0.3);
  if (keepEmpty) {
    const weakest = [...p.board.entries()].sort((a, b) => value(a[1]) - value(b[1]))[0];
    const free = p.bench.findIndex((u) => u === null);
    if (weakest && free >= 0) {
      p.board.delete(weakest[0]);
      p.bench[free] = weakest[1];
    }
  }
  p.ai = { ...(p.ai ?? {}), keepEmpty };
}

function normalPrep(g: GameState, p: PlayerState) {
  const ahead = farAhead(g, p);
  if (g.round >= 2 && (!p.ai?.fam || g.round === 6)) chooseTargets(p);
  const keep = reserve(g);
  if (!ahead) while (p.level < levelTarget(g, false) && p.gold - ECON.xpCost >= keep && buyXp(p).ok);
  shopRound(g, p, ahead ? 99 : 5, keep);
  // 짝이 있으면 높은 레벨에서 한두 번 새로고침
  if (!ahead && p.level >= 6) {
    for (let k = 0; k < 2; k++) {
      const pairs = allUnits(p).some((u) => u.star === 1 && ownedCount(p, u.char, 1) === 2);
      if (!pairs || p.gold - ECON.rerollCost < keep + 3) break;
      reroll(g, p);
      shopRound(g, p, 6, keep);
    }
  }
  const chosen = pickBoard(p, p.level);
  const fam = p.ai?.fam;
  useItems(g, p, chosen, false, (u, n) => !fam || !familiesOf(numberOf(u)).includes(fam) || familiesOf(n).includes(fam));
  placeBoard(g, p, chosen);
  p.ai = { ...(p.ai ?? {}), keepEmpty: false };
}

/** 어려움: 후보 판 여러 개를 이번 상대 판과 모의 전투해 고른다(최대 40번) */
function hardPrep(g: GameState, p: PlayerState) {
  if (g.round >= 3 || !p.ai?.deck) chooseDeck(g, p);
  const keep = g.round >= 8 ? Math.min(reserve(g), 4) : reserve(g);
  while (p.level < levelTarget(g, true) && p.gold - ECON.xpCost >= keep && buyXp(p).ok);
  shopRound(g, p, 6, keep);
  for (let k = 0; k < 3 && p.level >= 5; k++) {
    if (p.gold - ECON.rerollCost < keep + 2) break;
    reroll(g, p);
    shopRound(g, p, 6, keep);
  }
  const deck = deckChars(p.ai?.deck);
  const deckBonus = (u: UnitInst) => (deck.includes(u.char) ? 12 : 0);
  // 덱 친구의 숫자는 덱 안의 숫자로만 바꾼다(합창 구조 지키기)
  const keepDeck = (u: UnitInst, n: number) => !deck.includes(u.char) || deck.includes(n);

  // 후보 판
  const n = p.level;
  const cands: UnitInst[][] = [];
  const add = (c: UnitInst[]) => {
    const key = c.map((u) => u.uid).sort().join(',');
    if (c.length && !cands.some((x) => x.map((u) => u.uid).sort().join(',') === key)) cands.push(c);
  };
  add(pickBoard(p, n, deckBonus));
  add(pickBoard(p, n));
  add(allUnits(p).sort((a, b) => value(b) - value(a)).slice(0, n));
  const base = cands[0] ?? [];
  const pool = allUnits(p).filter((u) => !base.includes(u));
  for (let k = 0; k < 4 && pool.length && base.length; k++) {
    const out = Math.floor(rand(g) * base.length);
    const inn = pool[Math.floor(rand(g) * pool.length)];
    add(base.map((u, i) => (i === out ? inn : u)));
  }
  // 상대 판: 이번 상대 + (친구 대결이면) 다른 친구 한 명
  const opp = opponentOf(g, p.id);
  const foes: BoardUnit[][] = [];
  if (opp?.kind === 'pve') foes.push(opp.board);
  else if (opp) foes.push(toBattleBoard(g.players[opp.id]));
  const others = g.players.filter((q) => q !== p && (opp?.kind !== 'pvp' || q.id !== opp.id) && q.board.size);
  if (others.length) foes.push(toBattleBoard(others[Math.floor(rand(g) * others.length)]));
  const live = foes.filter((f) => f.length);

  const scored: { c: UnitInst[]; sc: number }[] = [];
  let sims = 0;
  for (const c of cands.slice(0, 8)) {
    const itemsBefore = new Map(allUnits(p).map((u) => [u.uid, u.items.slice()]));
    const bagBefore = p.bag.slice();
    useItems(g, p, c, true, keepDeck);
    placeBoard(g, p, c, 6);
    const mine = toBattleBoard(p);
    let sc = boardScore(c) * 0.05;
    for (const f of live) {
      if (sims >= 40) break;
      const r = runBattle(mine, f);
      sims++;
      sc += r.winner === 0 ? 100 : r.winner === 'draw' ? 40 : 0;
      sc += (r.survivors[0] - r.survivors[1]) * 6;
    }
    scored.push({ c, sc });
    // 아이템 되돌리기(다음 후보도 공정하게)
    for (const u of allUnits(p)) u.items = itemsBefore.get(u.uid) ?? u.items;
    p.bag = bagBefore;
  }
  scored.sort((a, b) => b.sc - a.sc);
  const pickSecond = scored.length > 1 && rand(g) < 0.1;
  const final = (pickSecond ? scored[1] : scored[0])?.c ?? [];
  useItems(g, p, final, true, keepDeck);
  placeBoard(g, p, final);
  p.ai = { ...(p.ai ?? {}), keepEmpty: false };
}

/** 친구 유령: 그 친구가 그 라운드에 실제로 둔 판(기록보다 라운드가 길면 마지막 판) */
function ghostPrep(g: GameState, p: PlayerState) {
  const rounds = p.ghost!;
  const b = rounds[Math.min(g.round - 1, rounds.length - 1)] ?? [];
  p.board.clear();
  for (const u of b) p.board.set(cellKey(u.row, u.col), { uid: g.nextUid++, char: u.char, star: u.star, items: (u.items ?? []).slice(0, 2) });
  p.bench = Array(ECON.benchSize).fill(null);
  p.ai = { ...(p.ai ?? {}), keepEmpty: true };
}

export function botPrep(g: GameState, p: PlayerState) {
  if (p.ghost) ghostPrep(g, p);
  else if (p.difficulty === 'hard') hardPrep(g, p);
  else if (p.difficulty === 'normal') normalPrep(g, p);
  else easyPrep(g, p);
}

export function botFreePick(g: GameState, p: PlayerState) {
  const c = g.freePick[p.id];
  if (c?.length) chooseFreePick(g, p, Math.floor(rand(g) * c.length));
}

/** 보상: 쉬움은 아무거나, 보통·어려움은 많이 주는 상자(카드가 든 상자 우선) */
export function botRewards(g: GameState) {
  for (const r of g.pendingRewards.slice()) {
    const p = g.players[r.playerId];
    if (!p.isBot) continue;
    let idx = Math.floor(rand(g) * r.options.length);
    if (p.difficulty !== 'easy') {
      let best = -1;
      r.options.forEach((opt, i) => {
        const sc = opt.length * 2 + (r.cardCost?.[i] ?? 0) + opt.filter((x) => x === 'x2' || x === 'x3').length;
        if (sc > best) {
          best = sc;
          idx = i;
        }
      });
    }
    chooseReward(g, p.id, idx);
  }
}
