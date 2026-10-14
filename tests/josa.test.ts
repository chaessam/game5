import { describe, expect, it } from 'vitest';
import { josa } from '../src/shared/josa';

describe('josa', () => {
  it('받침에 맞는 조사', () => {
    expect(josa('하나쌤', '을/를')).toBe('하나쌤을');
    expect(josa('띵띵이', '을/를')).toBe('띵띵이를');
    expect(josa('달님', '으로/로')).toBe('달님으로');
    expect(josa('하루', '으로/로')).toBe('하루로');
    expect(josa('달', '으로/로')).toBe('달로');
  });
  it('숫자는 읽는 소리로', () => {
    expect(josa(3, '과/와')).toBe('3과');
    expect(josa(4, '과/와')).toBe('4와');
    expect(josa('2·3', '이/가')).toBe('2·3이');
    expect(josa('4·5', '이/가')).toBe('4·5가');
    expect(josa(10, '은/는')).toBe('10은');
    expect(josa(12, '은/는')).toBe('12는');
  });
});
