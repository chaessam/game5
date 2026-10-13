// 수학표: 게임 안의 모든 수학 사실(가문, 약수, 분열 짝, 돌 변신)은 여기서만 계산한다.
// 화면 문구와 캐릭터 설명도 이 함수들로 만들어 손으로 쓴 숫자가 틀리지 않게 한다.

import type { FamilyId, StoneOp } from './types';

export const MIN_NUMBER = 2;
export const MAX_NUMBER = 40;

export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}

export function divisorCount(n: number): number {
  let c = 0;
  for (let i = 1; i <= n; i++) if (n % i === 0) c++;
  return c;
}

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** 숫자 성질로 정해지는 가문. 1은 어느 가문에도 속하지 않는다. */
export function familiesOf(n: number): FamilyId[] {
  const f: FamilyId[] = [];
  if (n % 2 === 0) f.push('even');
  if (n % 3 === 0) f.push('tri');
  if (n % 5 === 0) f.push('five');
  const d = divisorCount(n);
  if (d === 2) f.push('prime');
  if (d >= 6) f.push('rich');
  return f;
}

/** 곱해서 n이 되는 두 수 중 차가 가장 작은 짝(1 제외). 1 × n뿐이면 null. */
export function splitPair(n: number): [number, number] | null {
  for (let a = Math.floor(Math.sqrt(n)); a >= 2; a--) {
    if (n % a === 0) return [a, n / a];
  }
  return null;
}

export type StoneResult =
  | { ok: true; value: number; expr: string }
  | { ok: false; reason: string; expr: string };

/** 숫자 돌 하나를 적용한다. 실패하면 아이에게 보여 줄 이유 문장을 돌려준다. */
export function applyStone(n: number, op: StoneOp): StoneResult {
  switch (op) {
    case '+1': {
      const v = n + 1;
      return v > MAX_NUMBER
        ? { ok: false, expr: `${n} + 1 = ${v}`, reason: `${MAX_NUMBER}보다 커요` }
        : { ok: true, value: v, expr: `${n} + 1 = ${v}` };
    }
    case '-1': {
      const v = n - 1;
      return v < MIN_NUMBER
        ? { ok: false, expr: `${n} − 1 = ${v}`, reason: `숫자는 ${MIN_NUMBER}부터예요` }
        : { ok: true, value: v, expr: `${n} − 1 = ${v}` };
    }
    case 'x2':
    case 'x3': {
      const k = op === 'x2' ? 2 : 3;
      const v = n * k;
      return v > MAX_NUMBER
        ? { ok: false, expr: `${n} × ${k} = ${v}`, reason: `${MAX_NUMBER}보다 커요` }
        : { ok: true, value: v, expr: `${n} × ${k} = ${v}` };
    }
    case '/2':
    case '/3': {
      const k = op === '/2' ? 2 : 3;
      const q = Math.floor(n / k);
      const r = n % k;
      if (r !== 0) return { ok: false, expr: `${n} ÷ ${k} = ${q} … ${r}`, reason: '나누어떨어지지 않아요' };
      return q < MIN_NUMBER
        ? { ok: false, expr: `${n} ÷ ${k} = ${q}`, reason: `숫자는 ${MIN_NUMBER}부터예요` }
        : { ok: true, value: q, expr: `${n} ÷ ${k} = ${q}` };
    }
  }
}

/** 돌 여러 개를 왼쪽 칸부터 차례로 적용한다. */
export function applyStones(n: number, ops: readonly StoneOp[]): StoneResult {
  let cur = n;
  const exprs: string[] = [];
  for (const op of ops) {
    const r = applyStone(cur, op);
    exprs.push(r.expr);
    if (!r.ok) return { ok: false, reason: r.reason, expr: exprs.join(' → ') };
    cur = r.value;
  }
  return { ok: true, value: cur, expr: exprs.join(' → ') || String(n) };
}

/** 박 b에 노래할 수 있는 숫자들(= b의 약수 중 후보 목록에 있는 것). */
export function singersAtBeat(beat: number, numbers: readonly number[]): number[] {
  return numbers.filter((n) => beat % n === 0);
}

/** 1~MAX_NUMBER 수학표(테스트·화면 문구용). */
export interface MathRow {
  n: number;
  divisors: number[];
  divisorCount: number;
  families: FamilyId[];
  splitPair: [number, number] | null;
}

export function mathTable(max = MAX_NUMBER): MathRow[] {
  const rows: MathRow[] = [];
  for (let n = 1; n <= max; n++) {
    rows.push({ n, divisors: divisors(n), divisorCount: divisorCount(n), families: familiesOf(n), splitPair: splitPair(n) });
  }
  return rows;
}
