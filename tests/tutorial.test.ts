import { describe, expect, it } from 'vitest';
import { advance, buy, buyXp, cellKey, chooseReward, findUnit, move, reroll, resolveRound, type RoundOutcome } from '../src/game/game';
import { equip, synergyOf } from '../src/game/items';
import { TUT_ROUNDS, TUT_STEPS, createTutorial, fixTutorialRewards, prepareTutorialRound, stepDone, type TutStep } from '../src/game/tutorial';
import type { GameState, PlayerState } from '../src/game/types';

const SPOT: Record<number, [0 | 1, number]> = { 4: [0, 2], 2: [1, 1], 6: [1, 2], 3: [1, 3], 5: [0, 1], 7: [0, 3] };

function buyChar(g: GameState, p: PlayerState, char: number) {
  const i = p.shop.indexOf(char);
  expect(i, `상점에 ${char}`).toBeGreaterThanOrEqual(0);
  expect(buy(g, p, i).ok).toBe(true);
}
const onBoard = (p: PlayerState, c: number) => [...p.board.values()].some((u) => u.char === c);
const benchUnit = (p: PlayerState, c: number) => p.bench.find((u) => u?.char === c) ?? null;

/** 아이가 대본대로 했을 때의 행동 */
function act(g: GameState, step: TutStep): RoundOutcome | null {
  const p = g.players[0];
  const e = step.expect;
  switch (e.kind) {
    case 'own':
    case 'star':
      buyChar(g, p, e.char);
      break;
    case 'front': {
      const u = benchUnit(p, e.char)!;
      expect(move(p, u.uid, { kind: 'board', row: 0, col: 2 }).ok).toBe(true);
      break;
    }
    case 'board':
      for (const c of e.chars) {
        if (onBoard(p, c)) continue;
        if (!benchUnit(p, c)) buyChar(g, p, c);
        const u = benchUnit(p, c)!;
        const out = (e.not ?? []).map((n) => [...p.board.entries()].find(([, x]) => x.char === n)).find(Boolean);
        if (out) {
          const [row, col] = out[0].split(',').map(Number);
          expect(move(p, u.uid, { kind: 'board', row: row as 0 | 1, col }).ok).toBe(true);
        } else {
          const [row, col] = SPOT[c];
          expect(move(p, u.uid, { kind: 'board', row, col }).ok).toBe(true);
        }
      }
      break;
    case 'level':
      while (p.level < e.level) expect(buyXp(p).ok).toBe(true);
      break;
    case 'num': {
      const u = [...p.board.values()].find((x) => x.char === e.char)!;
      expect(equip(g, p, u, p.bag.indexOf('x2')).ok).toBe(true);
      break;
    }
    case 'reroll':
      expect(reroll(g, p).ok).toBe(true);
      break;
    case 'ready': {
      const out = resolveRound(g);
      fixTutorialRewards(g);
      return out;
    }
    default:
      break;
  }
  return null;
}

const active = (p: PlayerState) => {
  const s = synergyOf([...p.board.values()]);
  return new Set([
    ...Object.entries(s.fam).filter(([, v]) => v.tier > 0).map(([k]) => k),
    ...Object.entries(s.role).filter(([, v]) => v.tier > 0).map(([k]) => k),
  ]);
};

describe('튜토리얼 대본', () => {
  it('대본대로 하면 5라운드를 모두 이기고, 대사 없이 켜지는 시너지가 없다', () => {
    const g = createTutorial();
    const p = g.players[0];
    let round = 1;
    for (const step of TUT_STEPS) {
      while (g.round < step.round) {
        // 보상 받고 다음 라운드
        if (g.pendingRewards.length) expect(chooseReward(g, 0, 0).ok).toBe(true);
        advance(g);
        prepareTutorialRound(g);
      }
      if (step.round !== round) round = step.round;
      const before = active(p);
      const out = act(g, step);
      const after = active(p);
      const unexplained = [...after].filter((x) => !before.has(x) && !(step.mentions ?? []).includes(x as never));
      expect(unexplained, `${step.id}: 대사 없이 켜진 시너지`).toEqual([]);
      if (!['ok', 'ready', 'selectItem', 'reroll'].includes(step.expect.kind)) {
        expect(stepDone(g, step, {}), `${step.id} 완료`).toBe(true);
      }
      if (out) {
        const r = out.fights[0].result;
        expect(r.winner, `${step.round}라운드 승리`).toBe(0);
        const talk = TUT_ROUNDS[step.round].talk;
        for (const t of talk) {
          if (t.beat) expect(r.beats, `${step.round}라운드 ${t.beat}박까지 감`).toBeGreaterThanOrEqual(t.beat);
          if (t.on === 'rehearsal') expect(r.events.some((ev) => ev.type === 'song' && ev.rehearsal)).toBe(true);
          if (t.on === 'split') expect(r.events.some((ev) => ev.type === 'split' && r.fighters.find((f) => f.id === ev.unit)?.team === 1)).toBe(true);
          if (t.on === 'stunMine') expect(r.events.some((ev) => ev.type === 'stun' && r.fighters.find((f) => f.id === ev.tgt)?.team === 0)).toBe(true);
        }
        expect(findUnit(p, p.board.get(cellKey(0, 2))!.uid)).not.toBeNull();
      }
    }
  });
});
