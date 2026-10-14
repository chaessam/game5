import { describe, expect, it } from 'vitest';
import { runBattle } from '../src/engine/battle';
import { ECON } from '../src/game/economy';
import {
  advance, buyXp, chooseCard, createGame, giftUnit, income, pairings, ranking, reroll, resolveRound, teamTotals, TEAM_BOTH_WIN_BONUS,
} from '../src/game/game';
import { botFreePick, botPrep, botRewards } from '../src/game/bot';
import { MAGIC_CARDS, WEEKLY_RULES, magicRounds, modsOf, ruleConfig, ruleOfWeek, validCards, weekIndex } from '../src/game/magic';
import type { BoardUnit } from '../src/engine/types';

const U = (char: number, row: 0 | 1, col: number, star: 1 | 2 | 3 = 1): BoardUnit => ({ char, star, row, col });

describe('이번 주 규칙', () => {
  it('한국 시간 월요일 0시에 바뀜', () => {
    const sunNight = Date.parse('2026-10-18T23:59:00+09:00');
    const monMorning = Date.parse('2026-10-19T00:01:00+09:00');
    expect(weekIndex(monMorning)).toBe(weekIndex(sunNight) + 1);
    expect(weekIndex(Date.parse('2026-10-21T12:00:00+09:00'))).toBe(weekIndex(monMorning));
    expect(WEEKLY_RULES).toContain(ruleOfWeek(monMorning));
  });
  it('전투 규칙은 수치를 바꾸고, 규칙 없음은 기본 그대로', () => {
    expect(ruleConfig('chorus').chorusPct[3]).toBeGreaterThan(ruleConfig(null).chorusPct[3]);
    expect(ruleConfig('hot').hotBeatFrom).toBe(30);
    expect(ruleConfig('stone')).toBe(ruleConfig(null)); // 경제 규칙은 전투 수치 그대로
  });
  it('저금 주간: 저금 보너스 최대 +1', () => {
    const g = createGame({ seed: 3, bots: 1, rule: 'piggy' });
    g.players[0].gold = 50;
    expect(income(g.players[0], g).interest).toBe(ECON.interestMax + 1);
    expect(income(g.players[0]).interest).toBe(ECON.interestMax);
  });
});

describe('숫자 마법 카드', () => {
  it('카드는 20장, id 겹치지 않음, 고르는 라운드', () => {
    expect(new Set(MAGIC_CARDS.map((c) => c.id)).size).toBe(MAGIC_CARDS.length);
    expect(magicRounds(12)).toEqual([3, 6, 9]);
    expect(magicRounds(8)).toEqual([2, 5]);
    expect(validCards(['gold'], 3, 12)).toBe(true);
    expect(validCards(['gold', 'xp'], 3, 12)).toBe(false); // 3라운드엔 1장까지
    expect(validCards(['gold', 'gold'], 9, 12)).toBe(false);
    expect(validCards(['없는카드'], 9, 12)).toBe(false);
  });
  it('3라운드에 3장 중 1장, 경제 카드 바로 효과', () => {
    const g = createGame({ seed: 9, bots: 1 });
    for (const p of g.players) botFreePick(g, p);
    while (g.round < 3) {
      for (const p of g.players) botPrep(g, p);
      resolveRound(g);
      botRewards(g);
      g.pendingRewards = [];
      g.phase = 'prep';
      advance(g);
    }
    const me = g.players[0];
    expect(me.cardChoice).toHaveLength(3);
    me.cardChoice = ['gold', 'xp', 'reroll'];
    const before = me.gold;
    chooseCard(g, me, 0);
    expect(me.gold).toBe(before + 5);
    expect(me.cardChoice).toBeUndefined();
    me.cards = ['gold', 'xp', 'reroll'];
    me.gold = 10;
    buyXp(me);
    expect(me.gold).toBe(7); // 레벨업 3골드
    reroll(g, me);
    expect(me.gold).toBe(7); // 첫 새로고침 공짜
    reroll(g, me);
    expect(me.gold).toBe(5);
  });
  it('전투 카드: 같은 보드면 카드 가진 쪽이 더 잘 버팀', () => {
    const board = [U(4, 0, 1), U(8, 0, 2), U(12, 0, 3), U(6, 1, 2)]; // 붙은 친구끼리 공약수가 있어 손잡기도 확인
    for (const c of MAGIC_CARDS.filter((x) => x.kind === 'battle' && !x.fam && x.id !== 'lone')) {
      const r = runBattle(board, board, { mods: [modsOf([c.id]), undefined] });
      expect(r.winner, c.id).toBe(0);
    }
  });
  it('문장 카드: 그 가문 친구가 있을 때만 1명 더', () => {
    const r = runBattle([U(2, 0, 0)], [U(3, 0, 0)], { mods: [modsOf(['emb_even']), modsOf(['emb_even'])] });
    expect(r.synergy[0].famCount.even).toBe(2); // 2 한 명 + 문장 → 2명 단계
    expect(r.synergy[0].fam.even).toBe(1);
    expect(r.synergy[1].famCount.even).toBe(0); // 3은 짝꿍이 아님
  });
});

describe('짝꿍 팀전 2:2', () => {
  const play = (seed: number) => {
    const g = createGame({ seed, bots: 3, difficulties: ['normal', 'normal', 'normal'], seatZeroBot: 'normal', teams: true });
    for (const p of g.players) botFreePick(g, p);
    let guard = 0;
    while (g.phase !== 'over' && guard++ < 40) {
      if (g.phase === 'prep') {
        for (const p of g.players) botPrep(g, p);
        const plan = g.rounds[g.round - 1];
        if (plan.kind === 'pvp') for (const pr of pairings(g)) expect(g.teams![pr.a]).not.toBe(g.teams![pr.b]);
        resolveRound(g);
      }
      botRewards(g);
      advance(g);
    }
    return g;
  };
  it('상대 팀하고만 싸우고, 팀 메달 합으로 등수', () => {
    const g = play(5);
    expect(g.teams).toEqual([0, 0, 1, 1]);
    const tt = teamTotals(g);
    const r = ranking(g);
    const winTeam = tt[0] >= tt[1] ? 0 : 1;
    expect(g.teams![r[0].id]).toBe(winTeam);
    expect(g.teams![r[1].id]).toBe(winTeam);
    expect(TEAM_BOTH_WIN_BONUS).toBe(1);
  });
  it('짝꿍에게 친구 보내기: 라운드마다 1번', () => {
    const g = createGame({ seed: 8, bots: 3, teams: true });
    for (const p of g.players) botFreePick(g, p);
    const me = g.players[0];
    const mate = g.players[1];
    const u = me.bench.find(Boolean)!;
    const mateBefore = mate.bench.filter(Boolean).length;
    expect(giftUnit(g, me, u.uid).ok).toBe(true);
    expect(mate.bench.filter(Boolean).length).toBe(mateBefore + 1);
    const u2 = me.bench.find(Boolean);
    if (u2) expect(giftUnit(g, me, u2.uid).ok).toBe(false);
  });
});
