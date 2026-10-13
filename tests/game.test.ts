import { describe, expect, it } from 'vitest';
import {
  addXp, advance, allUnits, boardCount, buy, buyXp, cellKey, chooseFreePick, chooseReward, createGame, income,
  mergeAll, move, ranking, reroll, resolveRound, sell,
} from '../src/game/game';
import { botFreePick, botPrep, botRewards } from '../src/game/bot';
import { ECON, POOL, SHOP_ODDS } from '../src/game/economy';
import { UNITS } from '../src/engine/data';
import type { GameState, PlayerState } from '../src/game/types';

const totalPool = (g: GameState) => Object.values(g.pool).reduce((a, b) => a + b, 0);
const inPlay = (g: GameState) =>
  g.players.reduce((s, p) => s + allUnits(p).reduce((t, u) => t + 3 ** (u.star - 1), 0) + p.shop.filter((c) => c !== null).length, 0) +
  Object.values(g.freePick).reduce((s, c) => s + c.length, 0);

function give(g: GameState, p: PlayerState, char: number, n = 1) {
  for (let i = 0; i < n; i++) {
    const free = p.bench.findIndex((u) => u === null);
    p.bench[free] = { uid: g.nextUid++, char, star: 1, items: [] };
    g.pool[char]--;
  }
}

describe('경제 표', () => {
  it('상점 확률 각 줄 합 100, 카드 풀 326장', () => {
    for (const row of Object.values(SHOP_ODDS)) expect(row.reduce((a, b) => a + b)).toBe(100);
    const total = Object.values(POOL).reduce((s, t) => s + t.units.length * t.copies, 0);
    expect(total).toBe(326);
    for (const [cost, t] of Object.entries(POOL)) for (const u of t.units) expect(UNITS[u].cost).toBe(Number(cost));
  });

  it('레벨: 자동 경험치만으로 2라운드 4, 5라운드 5, 10라운드 6', () => {
    const p = createGame({ seed: 1, bots: 1 }).players[0];
    const levelAt: Record<number, number> = {};
    p.level = 3;
    p.xp = 0;
    for (let r = 2; r <= 10; r++) {
      addXp(p, 2);
      levelAt[r] = p.level;
    }
    expect([levelAt[2], levelAt[5], levelAt[10]]).toEqual([4, 5, 6]);
  });

  it('수입 = 5 + 저금 보너스(10골드마다 1, 최대 2) + 연승·연패', () => {
    const p = createGame({ seed: 1, bots: 1 }).players[0];
    p.gold = 19;
    expect(income(p)).toMatchObject({ interest: 1, total: 6 });
    p.gold = 45;
    expect(income(p).interest).toBe(2);
    p.lossStreak = 3;
    expect(income(p)).toMatchObject({ streak: 2, total: 9 });
  });
});

describe('상점·사기·팔기·합체', () => {
  it('카드 수가 보존된다(풀 + 상점 + 손에 든 것 = 326)', () => {
    const g = createGame({ seed: 7, bots: 3 });
    g.players.forEach((p) => botFreePick(g, p));
    expect(totalPool(g) + inPlay(g)).toBe(326);
    const p = g.players[0];
    p.gold = 50;
    for (let i = 0; i < 5; i++) buy(g, p, i);
    reroll(g, p);
    expect(totalPool(g) + inPlay(g)).toBe(326);
    const u = allUnits(p)[0];
    sell(g, p, u.uid);
    expect(totalPool(g) + inPlay(g)).toBe(326);
  });

  it('같은 친구 3장 → 2성, 2성 3장 → 3성(연쇄), 보드 자리에 남는다', () => {
    const g = createGame({ seed: 3, bots: 1 });
    const p = g.players[0];
    p.bench = Array(ECON.benchSize).fill(null);
    give(g, p, 7, 2);
    move(p, p.bench[0]!.uid, { kind: 'board', row: 1, col: 2 });
    give(g, p, 7, 1);
    const m = mergeAll(g, p, 7);
    expect(m).toMatchObject({ char: 7, star: 2 });
    expect(p.board.get(cellKey(1, 2))).toMatchObject({ char: 7, star: 2 });
    // 1성 6장 더 → 2성 2개 더 → 3성
    give(g, p, 7, 6);
    mergeAll(g, p, 7);
    expect(allUnits(p).filter((u) => u.char === 7)).toEqual([expect.objectContaining({ star: 3 })]);
    expect(p.board.get(cellKey(1, 2))).toMatchObject({ star: 3 });
  });

  it('대기석이 꽉 차도 바로 합체되는 카드는 살 수 있다', () => {
    const g = createGame({ seed: 5, bots: 1 });
    const p = g.players[0];
    p.bench = Array(ECON.benchSize).fill(null);
    give(g, p, 4, 2);
    give(g, p, 5, 6);
    expect(p.bench.every((u) => u !== null)).toBe(true);
    p.shop = [4, 6, null, null, null];
    p.gold = 10;
    expect(buy(g, p, 1)).toMatchObject({ ok: false });
    expect(buy(g, p, 0)).toMatchObject({ ok: true, merged: expect.objectContaining({ char: 4, star: 2 }) });
    expect(p.bench.length).toBe(ECON.benchSize);
  });

  it('팔면 산 값 그대로(1성 값, 2성 값×3)', () => {
    const g = createGame({ seed: 9, bots: 1 });
    const p = g.players[0];
    p.bench = Array(ECON.benchSize).fill(null);
    give(g, p, 12, 3);
    mergeAll(g, p, 12);
    const before = p.gold;
    sell(g, p, allUnits(p)[0].uid);
    expect(p.gold - before).toBe(UNITS[12].cost * 3);
  });

  it('보드에는 레벨만큼만 놓을 수 있다', () => {
    const g = createGame({ seed: 2, bots: 1 });
    const p = g.players[0];
    p.bench = Array(ECON.benchSize).fill(null);
    p.board.clear();
    p.level = 3;
    give(g, p, 2, 1); give(g, p, 3, 1); give(g, p, 4, 1); give(g, p, 5, 1);
    const ids = p.bench.filter(Boolean).map((u) => u!.uid);
    expect(move(p, ids[0], { kind: 'board', row: 0, col: 0 }).ok).toBe(true);
    expect(move(p, ids[1], { kind: 'board', row: 0, col: 1 }).ok).toBe(true);
    expect(move(p, ids[2], { kind: 'board', row: 0, col: 2 }).ok).toBe(true);
    expect(move(p, ids[3], { kind: 'board', row: 0, col: 3 }).ok).toBe(false);
    // 자리 바꾸기는 된다
    expect(move(p, ids[3], { kind: 'board', row: 0, col: 0 }).ok).toBe(true);
    expect(boardCount(p)).toBe(3);
  });

  it('경험치 사기: 4골드에 +4', () => {
    const p = createGame({ seed: 4, bots: 1 }).players[0];
    p.gold = 8;
    p.level = 4;
    p.xp = 0;
    buyXp(p);
    expect([p.gold, p.level, p.xp]).toEqual([4, 4, 4]);
    buyXp(p);
    expect([p.gold, p.level, p.xp]).toEqual([0, 5, 2]);
  });
});

/** 컴퓨터끼리(+사람 자리도 컴퓨터처럼) 한 판 전체 */
function playWholeGame(seed: number, bots: number, short = false) {
  const g = createGame({ seed, bots, short });
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 100) {
    if (g.phase === 'freePick') g.players.forEach((p) => botFreePick(g, p));
    for (const p of g.players) botPrep(g, p);
    resolveRound(g);
    botRewards(g);
    // 사람 자리(0번)의 보상도 첫 번째로
    while (g.pendingRewards.length) chooseReward(g, g.pendingRewards[0].playerId, 0);
    advance(g);
  }
  return g;
}

describe('한 판 전체', () => {
  it('12라운드가 끝까지 돌고, 같은 시드면 같은 결과', () => {
    const g1 = playWholeGame(42, 3);
    const g2 = playWholeGame(42, 3);
    expect(g1.phase).toBe('over');
    expect(g1.round).toBe(12);
    expect(g1.players.map((p) => p.medals)).toEqual(g2.players.map((p) => p.medals));
    expect(totalPool(g1) + inPlay(g1)).toBe(326);
    for (const p of g1.players) {
      expect(p.history.length).toBe(12);
      expect(p.medals).toBeGreaterThanOrEqual(12); // 져도 매 라운드 메달 1개 이상
      expect(p.stonesReceived).toBeLessThanOrEqual(ECON.stoneCapPerGame);
      expect(p.bag.length).toBeLessThanOrEqual(ECON.bagSize);
    }
    expect(ranking(g1)[0].medals).toBeGreaterThanOrEqual(ranking(g1)[3].medals);
  });

  it('2명·3명 방, 짧은 판(8라운드)도 끝까지 돈다', () => {
    expect(playWholeGame(1, 1).phase).toBe('over');
    expect(playWholeGame(2, 2).phase).toBe('over');
    const s = playWholeGame(3, 3, true);
    expect(s.phase).toBe('over');
    expect(s.round).toBe(8);
  });

  it('1라운드: 무료 카드 고르기 후 준비 단계', () => {
    const g = createGame({ seed: 11, bots: 1 });
    expect(g.phase).toBe('freePick');
    expect(g.freePick[0]).toHaveLength(3);
    chooseFreePick(g, g.players[0], 1);
    expect(g.phase).toBe('freePick'); // 컴퓨터가 아직
    botFreePick(g, g.players[1]);
    expect(g.phase).toBe('prep');
    expect(allUnits(g.players[0])).toHaveLength(1);
    expect(g.players[0].gold).toBe(5);
  });
});
