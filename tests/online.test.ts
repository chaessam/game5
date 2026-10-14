import { describe, expect, it } from 'vitest';
import { advance, autoFill, chooseFreePick, chooseReward, createOnlineGame, currentPlan, pairings, resolveRound, toBattleBoard } from '../src/game/game';
import { botPrep } from '../src/game/bot';
import type { Difficulty } from '../src/game/types';

/** 서버(모두 원격) 1개 + 기기 n개: 기기는 자기 자리만 두고, 서버가 모은 보드로 결과를 똑같이 계산하는지 */
function simulate(n: number, short: boolean, seed: number) {
  const names = Array.from({ length: n }, (_, i) => `친구${i}`);
  const server = createOnlineGame({ seed, short, names, mySeat: -1 });
  const clients = names.map((_, i) => createOnlineGame({ seed, short, names, mySeat: i }));
  const diffs: Difficulty[] = ['easy', 'normal', 'hard', 'normal'];
  clients.forEach((c, i) => {
    expect(c.phase).toBe('freePick');
    chooseFreePick(c, c.players[i], 0);
    expect(c.phase).toBe('prep');
  });
  expect(server.phase).toBe('prep');
  let rounds = 0;
  while (server.phase !== 'over') {
    const boards = clients.map((c, i) => {
      const p = c.players[i];
      p.difficulty = diffs[i];
      botPrep(c, p);
      autoFill(p);
      return toBattleBoard(p);
    });
    const pairs = currentPlan(server).kind === 'pvp' ? pairings(server) : undefined;
    resolveRound(server, { boards, light: true });
    server.pendingRewards = [];
    advance(server);
    clients.forEach((c, i) => {
      resolveRound(c, { boards, pairs });
      c.pendingRewards = c.pendingRewards.filter((r) => !c.players[r.playerId].remote);
      if (c.pendingRewards.length) chooseReward(c, i, 0);
      advance(c);
      c.monsterIndex = server.monsterIndex;
      expect(c.players.map((p) => [p.medals, p.wins, p.winStreak, p.lastOpponent])).toEqual(server.players.map((p) => [p.medals, p.wins, p.winStreak, p.lastOpponent]));
      expect(c.phase).toBe(server.phase);
    });
    rounds++;
  }
  return rounds;
}

describe('온라인 대결: 서버와 기기가 같은 결과', () => {
  it('2·3·4명, 긴 판·짧은 판', () => {
    expect(simulate(2, true, 11)).toBe(8);
    expect(simulate(3, false, 22)).toBe(12);
    expect(simulate(4, false, 33)).toBe(12);
    expect(simulate(4, true, 44)).toBe(8);
  });
});
