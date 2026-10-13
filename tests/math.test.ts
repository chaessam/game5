import { describe, expect, it } from 'vitest';
import { applyStone, applyStones, divisorCount, divisors, familiesOf, gcd, lcm, mathTable, splitPair } from '../src/engine/math';
import { ROLES, UNITS, UNIT_IDS } from '../src/engine/data';

describe('수학표 1~40', () => {
  it('약수 개수: 36이 9개로 가장 많고 다음은 24·30·40(8개)', () => {
    const rows = mathTable(40);
    const max = Math.max(...rows.map((r) => r.divisorCount));
    expect(max).toBe(9);
    expect(rows.filter((r) => r.divisorCount === 9).map((r) => r.n)).toEqual([36]);
    expect(rows.filter((r) => r.divisorCount === 8).map((r) => r.n)).toEqual([24, 30, 40]);
    expect(divisorCount(16)).toBe(5); // 부자에 하나 모자람
    expect(divisorCount(1)).toBe(1); // 1은 다이아 아님
  });

  it('부자(약수 6개 이상) 수는 12·18·20·24·28·30·32·36·40', () => {
    const rich = mathTable(40).filter((r) => r.families.includes('rich')).map((r) => r.n);
    expect(rich).toEqual([12, 18, 20, 24, 28, 30, 32, 36, 40]);
  });

  it('다이아(약수 딱 2개)은 2~40의 1과 자기로만 나눠지는 수', () => {
    const prime = mathTable(40).filter((r) => r.families.includes('prime')).map((r) => r.n);
    expect(prime).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
  });

  it('2~40의 모든 수는 가문이 하나 이상, 가문 없는 첫 수는 49, 1은 가문 없음', () => {
    for (let n = 2; n <= 48; n++) expect(familiesOf(n).length, `n=${n}`).toBeGreaterThan(0);
    expect(familiesOf(49)).toEqual([]);
    expect(familiesOf(1)).toEqual([]);
  });

  it('분열 짝은 차가 가장 작은 곱셈 짝', () => {
    const expected: Record<number, [number, number]> = {
      12: [3, 4], 18: [3, 6], 20: [4, 5], 24: [4, 6], 28: [4, 7], 30: [5, 6], 32: [4, 8], 36: [6, 6], 40: [5, 8],
      16: [4, 4], 9: [3, 3], 10: [2, 5],
    };
    for (const [n, pair] of Object.entries(expected)) expect(splitPair(Number(n))).toEqual(pair);
    expect(splitPair(7)).toBeNull(); // 1 × 7뿐
  });

  it('최대공약수·최소공배수 예시', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(lcm(2, 3), 5)).toBe(30);
    expect(lcm(7, 11)).toBe(77);
    expect(gcd(7, 9)).toBe(1);
  });

  it('36박·48박에 노래할 수 있는 로스터 숫자는 9개, 24·30박 8개, 12박 6개', () => {
    const roster = UNIT_IDS;
    const at = (b: number) => roster.filter((n) => b % n === 0);
    expect(at(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
    expect(at(48)).toEqual([1, 2, 3, 4, 6, 8, 12, 16, 24]);
    expect(at(24).length).toBe(8);
    expect(at(30).length).toBe(8);
    expect(at(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(divisors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
  });
});

describe('숫자 돌', () => {
  it('결과는 2~40, 나누기는 나누어떨어질 때만', () => {
    expect(applyStone(11, '+1')).toMatchObject({ ok: true, value: 12 });
    expect(applyStone(7, '-1')).toMatchObject({ ok: true, value: 6 });
    expect(applyStone(5, 'x2')).toMatchObject({ ok: true, value: 10 });
    expect(applyStone(36, '/2')).toMatchObject({ ok: true, value: 18 });
    expect(applyStone(21, '/3')).toMatchObject({ ok: true, value: 7 });
    expect(applyStone(2, '-1')).toMatchObject({ ok: false, expr: '2 − 1 = 1' });
    expect(applyStone(3, '/2')).toMatchObject({ ok: false, expr: '3 ÷ 2 = 1 … 1', reason: '나누어떨어지지 않아요' });
    expect(applyStone(20, 'x3')).toMatchObject({ ok: false, expr: '20 × 3 = 60' });
  });

  it('돌 2개는 왼쪽 칸부터: (5+1)×2 = 12, 5×2+1 = 11', () => {
    expect(applyStones(5, ['+1', 'x2'])).toMatchObject({ ok: true, value: 12 });
    expect(applyStones(5, ['x2', '+1'])).toMatchObject({ ok: true, value: 11 });
  });

  it('로스터 × 돌 6종 결과는 1이 되지 않고, 2~40 모든 수는 돌 2개 이내로 만들어진다', () => {
    const ops = ['+1', '-1', 'x2', 'x3', '/2', '/3'] as const;
    const made = new Set<number>(UNIT_IDS.filter((n) => n >= 2));
    for (const n of UNIT_IDS) {
      for (const a of ops) {
        const r1 = applyStones(n, [a]);
        if (r1.ok) {
          expect(r1.value).toBeGreaterThanOrEqual(2);
          made.add(r1.value);
        }
        for (const b of ops) {
          const r2 = applyStones(n, [a, b]);
          if (r2.ok) made.add(r2.value);
        }
      }
    }
    for (let n = 2; n <= 40; n++) expect(made.has(n), `n=${n}`).toBe(true);
  });
});

describe('로스터와 시너지 표', () => {
  it('직업 6개 × 4명', () => {
    const byRole: Record<string, number[]> = {};
    for (const n of UNIT_IDS) (byRole[UNITS[n].role] ??= []).push(n);
    expect(byRole).toEqual({
      singer: [1, 3, 17, 24], healer: [2, 6, 13, 30], knight: [4, 12, 15, 18],
      mage: [5, 9, 20, 36], hunter: [7, 10, 16, 25], ninja: [8, 11, 21, 28],
    });
    expect(ROLES.healer.name).toBe('힐러');
    expect(ROLES.singer.name).toBe('싱어');
    expect(ROLES.hunter.name).toBe('헌터');
  });

  it('가문 소속 인원(로스터 24명 기준): 짝꿍 13, 세모 10, 하이파이브 6, 다이아 7, 부자 7', () => {
    const count = (f: string) => UNIT_IDS.filter((n) => familiesOf(n).includes(f as never)).length;
    expect([count('even'), count('tri'), count('five'), count('prime'), count('rich')]).toEqual([13, 10, 6, 7, 7]);
  });
});
