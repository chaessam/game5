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
    expect(rankDelta(1, 4, 700)).toBe(30);
    expect(rankDelta(4, 4, 700)).toBe(-20);
    expect(rankDelta(1, 1, 700)).toBe(0);
  });
  it('브론즈는 잃는 점수 절반, 0점 아래로 안 내려감', () => {
    expect(rankDelta(4, 4, 100)).toBe(-10);
    expect(rankDelta(2, 2, 100)).toBe(-7);
    expect(rankDelta(4, 4, 4)).toBe(-4);
    expect(rankDelta(4, 4, 0)).toBe(0);
  });
});
