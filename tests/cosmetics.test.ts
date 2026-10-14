import { describe, expect, it } from 'vitest';
import { THEMES, TITLES, themeUnlocked, unlockedTitles, type Profile } from '../src/shared/cosmetics';

const base: Profile = { games: 0, firsts: 0, ranked: 0, bestPoints: 0, tutorial: false, bestChorus: 0, met: 0, three: 0, morphs: 0 };

describe('리그 꾸미기', () => {
  it('처음에는 칭호 없음, 기본 테마만', () => {
    expect(unlockedTitles(base)).toEqual([]);
    expect(THEMES.filter((t) => themeUnlocked(base, t.id)).map((t) => t.id)).toEqual(['basic']);
  });
  it('업적과 티어로 열림(한 번 가 본 티어는 그대로)', () => {
    const p = { ...base, tutorial: true, firsts: 1, games: 12, bestChorus: 5, bestPoints: 650 };
    const t = unlockedTitles(p);
    expect(t).toEqual(expect.arrayContaining(['newbie', 'first', 'steady', 'chorus4', 'chorus5', 'tier_silver', 'tier_gold']));
    expect(t).not.toContain('tier_platinum');
    expect(themeUnlocked(p, 'forest')).toBe(true);
    expect(themeUnlocked(p, 'desert')).toBe(false);
  });
  it('id 겹치지 않음', () => {
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });
});
