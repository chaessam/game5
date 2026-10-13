import { describe, expect, it } from 'vitest';
import { advance, createGame, resolveRound } from '../src/game/game';
import { botFreePick, botPrep, botRewards } from '../src/game/bot';
import { checkItems, slotCount } from '../src/game/items';
import type { Difficulty, GameState } from '../src/game/types';

function play(seed: number, diffs: Difficulty[], short = true): GameState {
  const g = createGame({ seed, bots: diffs.length - 1, difficulties: diffs.slice(1), seatZeroBot: diffs[0], short });
  for (const p of g.players) botFreePick(g, p);
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 40) {
    if (g.phase === 'prep') {
      for (const p of g.players) botPrep(g, p);
      // 컴퓨터가 끼운 돌은 언제나 규칙에 맞아야 한다(틀리면 전투 엔진이 멈춘다)
      for (const p of g.players) {
        for (const u of [...p.board.values(), ...p.bench.filter((x) => x !== null)]) {
          expect(checkItems(u!.char, u!.items).ok).toBe(true);
          expect(u!.items.length).toBeLessThanOrEqual(slotCount(g));
        }
        expect(p.board.size).toBeLessThanOrEqual(p.level);
      }
      resolveRound(g);
    }
    botRewards(g);
    advance(g);
  }
  return g;
}

describe('컴퓨터끼리 한 판', () => {
  it('쉬움·보통·어려움이 함께 짧은 판을 끝까지 둔다(돌 규칙·보드 인원 지킴)', () => {
    const g = play(11, ['easy', 'normal', 'hard', 'hard']);
    expect(g.phase).toBe('over');
    for (const p of g.players) expect(p.medals).toBeGreaterThan(0);
  });

  it('같은 시드 = 같은 판(컴퓨터도 게임 난수만 씀)', () => {
    const a = play(23, ['normal', 'hard']);
    const b = play(23, ['normal', 'hard']);
    expect(a.players.map((p) => [p.medals, p.level, p.gold])).toEqual(b.players.map((p) => [p.medals, p.level, p.gold]));
    expect(a.rngState).toBe(b.rngState);
  });
});
