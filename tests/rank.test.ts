import { describe, expect, it } from 'vitest';
import { PLACE_POINTS, rankDelta, rankTier } from '../src/shared/rank';

describe('랭크 점수·티어', () => {
  it('티어와 단계', () => {
    expect(rankTier(0).label).toBe('브론즈 3');
    expect(rankTier(150).label).toBe('브론즈 2');
    expect(rankTier(299).label).toBe('브론즈 1');
    expect(rankTier(300).label).toBe('실버 3');
    expect(rankTier(850)).toMatchObject({ label: '골드 1', toNext: 50 });
    expect(rankTier(1500).label).toBe('다이아몬드 3');
    expect(rankTier(1800).label).toBe('마스터');
    expect(rankTier(2100).label).toBe('그랜드마스터');
    expect(rankTier(9999)).toMatchObject({ label: '챌린저', toNext: 0 });
  });
  it('등수 점수: 1등이 가장 많이 얻고 꼴등이 가장 많이 잃음', () => {
    for (const n of [2, 3, 4]) {
      const t = PLACE_POINTS[n];
      expect(t[0]).toBeGreaterThan(0);
      expect(t[t.length - 1]).toBeLessThan(0);
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeLessThan(t[i - 1]);
    }
    expect(rankDelta(1, 4, 700)).toBe(70);
    expect(rankDelta(4, 4, 700)).toBe(-10);
    expect(rankDelta(1, 1, 700)).toBe(0);
  });
  it('브론즈는 잃는 점수 절반, 0점 아래로 안 내려감', () => {
    expect(rankDelta(4, 4, 100)).toBe(-5);
    expect(rankDelta(2, 2, 100)).toBe(-5);
    expect(rankDelta(4, 4, 3)).toBe(-3);
    expect(rankDelta(4, 4, 0)).toBe(0);
  });
  it('2명 판 반만 이겨도 12판이면 한 티어(300점), 4명 판은 더 빨리', () => {
    const play = (start: number, places: number[], players: number) => places.reduce((p, place) => p + rankDelta(place, players, p), start);
    const half2 = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    expect(rankTier(play(600, half2, 2)).id).toBe('platinum'); // 골드 → 플래티넘
    expect(play(600, half2, 2) - 600).toBeGreaterThanOrEqual(300);
    expect(rankTier(play(0, half2, 2)).id).toBe('silver'); // 브론즈 → 실버
    expect(rankTier(play(600, half2.slice(0, 10), 2)).id).toBe('gold'); // 10판으로는 아직
    const avg4 = [1, 2, 3, 4, 1, 2, 3, 4, 2, 3, 1, 4]; // 평균 2.5등
    expect(play(600, avg4, 4) - 600).toBeGreaterThan(play(600, half2, 2) - 600);
    // 이기기 어려운 친구(10판에 3번 이김)도 조금씩은 올라감
    expect(play(600, [1, 2, 2, 1, 2, 2, 1, 2, 2, 2], 2)).toBeGreaterThan(600);
  });
});
