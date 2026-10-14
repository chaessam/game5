import { describe, expect, it } from 'vitest';
import { advance, autoFill, chooseFreePick, chooseReward, createOnlineGame, currentPlan, pairings, resolveRound, toBattleBoard } from '../src/game/game';
import { botFreePick, botPrep, botRewards } from '../src/game/bot';
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

/** 사람 2명 + 컴퓨터 2명: 컴퓨터는 0번 자리(방장) 기기가 대신 두고 보드를 함께 보냄 */
describe('온라인 대결: 빈자리 컴퓨터(방장 기기)', () => {
  it('서버·방장·다른 친구 결과가 같음', () => {
    const names = ['방장', '친구', '컴퓨터 척척이', '컴퓨터 반짝이'];
    const seed = 77;
    const server = createOnlineGame({ seed, short: false, names, mySeat: -1 });
    const host = createOnlineGame({ seed, short: false, names, mySeat: 0, bots: [2, 3] });
    const other = createOnlineGame({ seed, short: false, names, mySeat: 1 });
    expect(host.players.map((p) => [p.isBot, !!p.remote])).toEqual([[false, false], [false, true], [true, false], [true, false]]);
    for (const p of host.players) if (p.isBot) botFreePick(host, p);
    chooseFreePick(host, host.players[0], 0);
    chooseFreePick(other, other.players[1], 1);
    expect(host.phase).toBe('prep');
    while (server.phase !== 'over') {
      const boards = [0, 1, 2, 3].map((i) => {
        const c = i === 1 ? other : host;
        const p = c.players[i];
        if (!p.isBot) p.difficulty = i === 0 ? 'hard' : 'easy';
        botPrep(c, p);
        autoFill(p);
        return toBattleBoard(p);
      });
      const pairs = currentPlan(server).kind === 'pvp' ? pairings(server) : undefined;
      resolveRound(server, { boards, light: true });
      server.pendingRewards = [];
      advance(server);
      for (const [c, mine] of [[host, 0], [other, 1]] as const) {
        resolveRound(c, { boards, pairs });
        c.pendingRewards = c.pendingRewards.filter((r) => !c.players[r.playerId].remote);
        botRewards(c);
        if (c.pendingRewards.length) chooseReward(c, mine, 0);
        expect(c.pendingRewards.length).toBe(0);
        advance(c);
        c.monsterIndex = server.monsterIndex;
        expect(c.players.map((p) => p.medals)).toEqual(server.players.map((p) => p.medals));
        expect(c.phase).toBe(server.phase);
      }
    }
  });
});

