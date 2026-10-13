import { describe, expect, it } from 'vitest';
import { createGame, mergeAll, toBattleBoard } from '../src/game/game';
import { equip, fitItems, numberOf, previewEquip, slotCount, synergyOf, unequip } from '../src/game/items';
import { runBattle } from '../src/engine/battle';
import type { GameState, PlayerState, UnitInst } from '../src/game/types';
import type { BagItem } from '../src/game/types';

function setup(round = 1, short = false): { g: GameState; p: PlayerState } {
  const g = createGame({ seed: 7, bots: 1, short });
  g.round = round;
  const p = g.players[0];
  p.bag = [];
  return { g, p };
}
let uid = 1000;
const unit = (char: number, items: BagItem[] = [], star: 1 | 2 | 3 = 1): UnitInst => ({ uid: uid++, char, star, items });

describe('숫자 돌 끼우기', () => {
  it('두 번째 칸은 6라운드(짧은 판 4라운드)부터', () => {
    expect(slotCount(setup(5).g)).toBe(1);
    expect(slotCount(setup(6).g)).toBe(2);
    expect(slotCount(setup(3, true).g)).toBe(1);
    expect(slotCount(setup(4, true).g)).toBe(2);
  });

  it('5에 ×2 → 10, 가방에서 빠진다', () => {
    const { g, p } = setup(1);
    const u = unit(5);
    p.bag = ['x2'];
    expect(equip(g, p, u, 0).ok).toBe(true);
    expect(numberOf(u)).toBe(10);
    expect(p.bag).toEqual([]);
  });

  it('나누어떨어지지 않으면 이유 문장과 함께 거절, 가방 그대로', () => {
    const { g, p } = setup(1);
    const u = unit(3);
    p.bag = ['/2'];
    const r = equip(g, p, u, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('3 ÷ 2 = 1 … 1, 나누어떨어지지 않아요');
    expect(p.bag).toEqual(['/2']);
    expect(u.items).toEqual([]);
  });

  it('칸이 차면 거절(1칸일 때 열리는 라운드 안내)', () => {
    const { g, p } = setup(2);
    const u = unit(5, ['+1']);
    p.bag = ['x2'];
    const r = equip(g, p, u, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('6라운드');
  });

  it('왼쪽 칸부터 계산: 5 → +1 → ×2 = 12, 5 → ×2 → +1 = 11', () => {
    const { g, p } = setup(6);
    const a = unit(5);
    p.bag = ['+1', 'x2'];
    equip(g, p, a, 0);
    equip(g, p, a, 0);
    expect(numberOf(a)).toBe(12);
    const b = unit(5);
    p.bag = ['x2', '+1'];
    equip(g, p, b, 0);
    equip(g, p, b, 0);
    expect(numberOf(b)).toBe(11);
  });

  it('칸을 지정하면 바꿔 끼우고 원래 돌은 가방으로', () => {
    const { g, p } = setup(1);
    const u = unit(6, ['+1']);
    p.bag = ['x2'];
    expect(equip(g, p, u, 0, 0).ok).toBe(true);
    expect(u.items).toEqual(['x2']);
    expect(p.bag).toEqual(['+1']);
  });

  it('빼기: 남은 돌 계산이 틀어지면 뒤 칸 돌도 함께 가방으로', () => {
    const { p } = setup(6);
    const u = unit(5, ['x2', '/2']);
    expect(numberOf(u)).toBe(5);
    expect(unequip(p, u, 0).ok).toBe(true);
    expect(u.items).toEqual([]);
    expect(p.bag.sort()).toEqual(['/2', 'x2']);
  });

  it('합체: 열린 칸·돌 계산에 맞는 것만 남기고 나머지는 가방', () => {
    const { g } = setup(2);
    expect(fitItems(g, 3, ['/2', 'x2', '+1'])).toEqual({ keep: ['x2'], extra: ['/2', '+1'] });
    const { g: g6 } = setup(6);
    expect(fitItems(g6, 3, ['x2', 'x3', '+1'])).toEqual({ keep: ['x2', 'x3'], extra: ['+1'] });
  });

  it('합체해도 계산이 맞는 아이템만 친구에게', () => {
    const { g, p } = setup(2);
    p.board.clear();
    p.board.set('0,1', unit(3, ['x2']));
    p.bench[0] = unit(3, ['+1']);
    p.bench[1] = unit(3);
    const m = mergeAll(g, p, 3)!;
    expect(m.star).toBe(2);
    expect(m.items).toEqual(['x2']);
    expect(p.bag).toEqual(['+1']);
  });
});

describe('가문 세기와 미리보기', () => {
  it('가문은 서로 다른 지금 숫자로 센다', () => {
    const s = synergyOf([unit(5, ['x2']), unit(10), unit(2)]);
    expect([...s.nums].sort((a, b) => a - b)).toEqual([2, 10]);
    expect(s.fam.even.count).toBe(2);
    expect(s.fam.prime.count).toBe(1);
    expect(s.role.mage.count).toBe(1);
    expect(s.role.hunter.count).toBe(1);
  });

  it('미리보기: 5 → 10, +짝꿍 −다이아, 보드 가문 줄 변화, 30박 노래', () => {
    const { g, p } = setup(1);
    p.board.clear();
    const five = unit(5);
    p.board.set('1,1', five);
    p.board.set('1,2', unit(2));
    p.board.set('0,2', unit(4));
    const pv = previewEquip(g, p, five, 'x2');
    expect(pv.ok).toBe(true);
    expect(pv.from).toBe(5);
    expect(pv.to).toBe(10);
    expect(pv.gained).toEqual(['even']);
    expect(pv.lost).toEqual(['prime']);
    expect(pv.board).toContainEqual({ fam: 'even', before: 2, after: 3, tierBefore: 1, tierAfter: 1 });
    expect(pv.board).toContainEqual({ fam: 'prime', before: 2, after: 1, tierBefore: 1, tierAfter: 0 });
    // 30박: 6번 × 70 = 420 → 3번 × 140 = 420
    expect(pv.song).toEqual({ before: [6, 70], after: [3, 140] });
  });

  it('가문 2개 이상 꺼지면 빨간 경고(30 + 1 = 31)', () => {
    const { g, p } = setup(1);
    const u = unit(30);
    const pv = previewEquip(g, p, u, '+1');
    expect(pv.to).toBe(31);
    expect(pv.lost.length).toBe(4);
    expect(pv.warnings[0]).toContain('4개');
  });

  it('돌을 낀 보드로 전투가 돈다(지금 숫자로 싸움)', () => {
    const { p } = setup(1);
    p.board.clear();
    p.board.set('1,2', unit(5, ['x2']));
    p.board.set('0,2', unit(4));
    const r = runBattle(toBattleBoard(p), [{ char: 7, star: 1, row: 0, col: 2 }]);
    expect(r.fighters.find((f) => f.team === 0 && f.char === 5)!.num).toBe(10);
  });
});
