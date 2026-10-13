// 캐릭터 노래 값(1성, 보너스 없음)이 기획서 5절 도감과 같은지 실제 엔진으로 확인한다.
import { describe, expect, it } from 'vitest';
import { runBattle, type BattleResult } from '../src/engine/battle';
import type { BattleEvent, BoardUnit } from '../src/engine/types';
import { DEFAULT_CONFIG, type BalanceConfig } from '../src/engine/data';

// 과녁(3성 하나쌤)은 공격력 0: 노래하는 친구가 자기 박까지 살아 있게
const cfg: BalanceConfig = { ...DEFAULT_CONFIG, unitOverrides: { 1: { atk: 0 } } };

/** 노래하는 친구 1명 vs 체력 큰 하나쌤(3성) 무리. 시너지·합창이 켜지지 않는 배치. */
function solo(char: number, enemies: BoardUnit[] = [{ char: 1, star: 3, row: 0, col: 0 }], extra: BoardUnit[] = []) {
  return runBattle([{ char, star: 1, row: 0, col: 2 }, ...extra], enemies, { log: true, config: cfg });
}
const songAt = (r: BattleResult, beat: number, srcId = 0) =>
  r.events.filter((e) => e.beat === beat && 'src' in e && e.src === srcId && !(e.type === 'damage' && e.basic));
const amounts = (ev: BattleEvent[], type: string) => ev.filter((e) => e.type === type).map((e) => ('amount' in e ? e.amount : 0));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const bigWall: BoardUnit[] = [
  { char: 1, star: 3, row: 0, col: 0 }, { char: 1, star: 3, row: 0, col: 1 }, { char: 1, star: 3, row: 0, col: 2 },
  { char: 1, star: 3, row: 0, col: 3 }, { char: 1, star: 3, row: 1, col: 1 }, { char: 1, star: 3, row: 1, col: 3 },
];

describe('노래 값 (1성)', () => {
  it('3 띵! 36', () => expect(amounts(songAt(solo(3), 3), 'damage')).toEqual([36]));
  it('5 불가사리 70 + 1박 멈춤', () => {
    const ev = songAt(solo(5), 5);
    expect(amounts(ev, 'damage')).toEqual([70]);
    expect(ev.find((e) => e.type === 'stun')).toMatchObject({ beats: 1 });
  });
  it('7 화살 14 × 7 = 98', () => expect(amounts(songAt(solo(7), 7), 'damage')).toEqual(Array(7).fill(14)));
  it('8 찰싹 16 × 8 = 128 + 2박 약하게', () => {
    const ev = songAt(solo(8), 8);
    expect(sum(amounts(ev, 'damage'))).toBe(128);
    expect(ev.find((e) => e.type === 'weak')).toMatchObject({ beats: 2 });
  });
  it('9 여우불 30 × 9개 = 270', () => expect(amounts(songAt(solo(9), 9), 'damage')).toEqual(Array(9).fill(30)));
  it('10 스트라이크 80', () => expect(amounts(songAt(solo(10), 10), 'damage')).toEqual([80]));
  it('11 쌍검 132 × 2', () => expect(amounts(songAt(solo(11), 11), 'damage')).toEqual([132, 132]));
  it('12 앞줄 2박 멈춤 + 보호막 120', () => {
    const ev = songAt(solo(12), 12);
    expect(ev.find((e) => e.type === 'stun')).toMatchObject({ beats: 2 });
    expect(amounts(ev, 'shield')).toEqual([120]);
  });
  it('15 앞줄 75 + 보호막 90', () => {
    const ev = songAt(solo(15), 15);
    expect(amounts(ev, 'damage')).toEqual([75]);
    expect(amounts(ev, 'shield')).toEqual([90]);
  });
  it('16 종이비행기 128 → 64 → 32 → 16', () =>
    expect(amounts(songAt(solo(16, bigWall), 16), 'damage')).toEqual([128, 64, 32, 16]));
  it('17 모두 119 + 2박 약하게', () => {
    const ev = songAt(solo(17), 17);
    expect(amounts(ev, 'damage')).toEqual([119]);
    expect(ev.find((e) => e.type === 'weak')).toMatchObject({ beats: 2 });
  });
  it('18 앞줄 90 + 아군 보호막 36', () => {
    const ev = songAt(solo(18), 18);
    expect(amounts(ev, 'damage')).toEqual([90]);
    expect(amounts(ev, 'shield')).toEqual([36]);
  });
  it('20 모두 140 + 1박 멈춤 (20 ÷ 20 = 1)', () => {
    const ev = songAt(solo(20), 20);
    expect(amounts(ev, 'damage')).toEqual([140]);
    expect(ev.find((e) => e.type === 'stun')).toMatchObject({ beats: 1 });
  });
  it('13 덤 빵: 빵 13개, 한 개 65', () => {
    const r = runBattle(
      [{ char: 13, star: 1, row: 1, col: 2 }, { char: 4, star: 1, row: 0, col: 0 }, { char: 4, star: 1, row: 0, col: 4 }],
      [{ char: 3, star: 3, row: 0, col: 0 }, { char: 3, star: 3, row: 0, col: 4 }],
      { log: true },
    );
    const heals = amounts(songAt(r, 13), 'heal');
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) expect(h % 65 === 0 || h < 65 * 13).toBe(true);
  });
  it('21 주사위 21·42·63·84·105·126·126 = 567', () =>
    expect(amounts(songAt(solo(21), 21), 'damage')).toEqual([21, 42, 63, 84, 105, 126, 126]));
  it('24 몸풀기 48(+방패 48), 24박 모두 96', () => {
    const r = solo(24);
    expect(amounts(songAt(r, 0), 'damage')).toEqual([48]);
    expect(amounts(songAt(r, 0), 'shield')).toEqual([48]);
    expect(amounts(songAt(r, 24), 'damage')).toEqual([96]);
  });
  it('25 빙고 몸풀기 125, 25박 250', () => {
    const r = solo(25);
    expect(amounts(songAt(r, 0), 'damage')).toEqual([125]);
    expect(amounts(songAt(r, 25), 'damage')).toEqual([250]);
  });
  it('28 완벽한 다섯 칼 588, 몸풀기 293', () => {
    const r = solo(28);
    expect(amounts(songAt(r, 0), 'damage')).toEqual([10, 21, 42, 73, 147]);
    expect(amounts(songAt(r, 28), 'damage')).toEqual([21, 42, 84, 147, 294]);
  });
  it('36 용 몸풀기 108, 36박 216', () => {
    const r = solo(36, [{ char: 1, star: 3, row: 0, col: 0 }, { char: 1, star: 3, row: 0, col: 4 }]);
    expect(amounts(songAt(r, 0), 'damage')).toEqual([108, 108]);
    expect(amounts(songAt(r, 36), 'damage')).toEqual([216, 216]);
  });
  it('30 몸풀기 아군 보호막 75', () => expect(amounts(songAt(solo(30), 0), 'shield')).toEqual([75]));
});

describe('지원 노래 (1성)', () => {
  it('2 쌍둥이 반창고: 가장 아픈 2명에게 12씩', () => {
    // 1박에 앞줄 거북 둘이 3성 하나쌤에게 한 대씩 맞고, 2박 노래로 회복
    const r = runBattle(
      [{ char: 2, star: 1, row: 1, col: 2 }, { char: 4, star: 1, row: 0, col: 0 }, { char: 4, star: 1, row: 0, col: 4 }],
      [{ char: 1, star: 3, row: 0, col: 0 }, { char: 1, star: 3, row: 0, col: 4 }],
      { log: true },
    );
    expect(amounts(songAt(r, 2), 'heal')).toEqual([12, 12]);
  });
  it('4 등껍질: 붙은 친구 방패 24', () => {
    const r = runBattle(
      [{ char: 4, star: 1, row: 0, col: 2 }, { char: 7, star: 1, row: 0, col: 1 }, { char: 11, star: 1, row: 1, col: 2 }],
      [{ char: 1, star: 3, row: 0, col: 0 }],
      { log: true, config: cfg },
    );
    expect(amounts(songAt(r, 4), 'shield')).toEqual([24, 24]);
  });
});
