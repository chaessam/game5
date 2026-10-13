import { describe, expect, it } from 'vitest';
import { runBattle } from '../src/engine/battle';
import { makeRng, randInt, shuffle } from '../src/engine/rng';
import { UNIT_IDS } from '../src/engine/data';
import type { BattleEvent, BoardUnit, Star } from '../src/engine/types';

function randomBoard(seed: number, size = 7): BoardUnit[] {
  const rng = makeRng(seed);
  const chars = shuffle(rng, UNIT_IDS.slice()).slice(0, size);
  const cells = shuffle(rng, Array.from({ length: 10 }, (_, i) => i)).slice(0, size);
  return chars.map((char, i) => ({
    char,
    star: (1 + randInt(rng, 2)) as Star,
    row: (cells[i] < 5 ? 0 : 1) as 0 | 1,
    col: cells[i] % 5,
  }));
}

const chorusAt = (ev: BattleEvent[], beat: number, team: 0 | 1) =>
  ev.find((e) => e.type === 'chorus' && e.beat === beat && e.team === team) as Extract<BattleEvent, { type: 'chorus' }> | undefined;

describe('결정성과 대칭', () => {
  it('같은 배치 = 같은 결과', () => {
    for (let s = 1; s <= 20; s++) {
      const a = randomBoard(s);
      const b = randomBoard(s + 1000);
      const r1 = runBattle(a, b, { log: true });
      const r2 = runBattle(a, b, { log: true });
      expect(r2.winner).toBe(r1.winner);
      expect(r2.beats).toBe(r1.beats);
      expect(r2.events).toEqual(r1.events);
    }
  });

  it('박자 스냅샷: 켜도 결과는 같고, 시작 전·0박·매 박이 있고, 체력이 이벤트와 맞는다', () => {
    for (let s = 1; s <= 20; s++) {
      const a = randomBoard(s * 3);
      const b = randomBoard(s * 5 + 9);
      const plain = runBattle(a, b, { log: true });
      const r = runBattle(a, b, { log: true, frames: true });
      expect(r.winner).toBe(plain.winner);
      expect(r.events).toEqual(plain.events);
      expect(r.frames.map((f) => f.beat)).toEqual([-1, ...Array.from({ length: r.beats + 1 }, (_, i) => i)]);
      const first = r.frames[0];
      for (const f of r.fighters.filter((x) => !x.minion)) {
        if (f.char !== 36) expect(first.units[f.id].hp).toBe(first.units[f.id].maxHp);
      }
      const last = r.frames[r.frames.length - 1];
      for (const f of r.fighters) expect(last.units[f.id].alive).toBe(f.alive);
      expect(plain.frames).toEqual([]);
    }
  });

  it('팀을 바꿔 놓아도 결과가 뒤집힐 뿐 같다(동시 처리)', () => {
    for (let s = 1; s <= 60; s++) {
      const a = randomBoard(s * 7);
      const b = randomBoard(s * 13 + 5);
      const r1 = runBattle(a, b);
      const r2 = runBattle(b, a);
      const flipped = r2.winner === 'draw' ? 'draw' : r2.winner === 0 ? 1 : 0;
      expect(flipped, `seed ${s}`).toBe(r1.winner);
      expect(r2.beats).toBe(r1.beats);
    }
  });
});

describe('합창과 단단', () => {
  const wall: BoardUnit[] = [{ char: 1, star: 3, row: 0, col: 0 }];

  it('12박에 2·3·4·6이 함께 노래하면 4명 합창 = 2.25배', () => {
    const r = runBattle(
      [{ char: 2, star: 1, row: 1, col: 0 }, { char: 3, star: 1, row: 1, col: 1 }, { char: 4, star: 1, row: 0, col: 2 }, { char: 6, star: 1, row: 1, col: 3 }],
      wall,
      { log: true },
    );
    expect(chorusAt(r.events, 12, 0)).toMatchObject({ count: 4 });
    const songs = r.events.filter((e) => e.type === 'song' && e.beat === 12);
    // 2·3은 단단이지만 4·6이 끼어 단단끼리가 아니다 → 4명 합창 225%
    for (const s of songs) expect(s).toMatchObject({ mult: 225 });
  });

  it('같은 숫자 두 명은 합창 인원 2', () => {
    const r = runBattle([{ char: 3, star: 1, row: 1, col: 0 }, { char: 3, star: 1, row: 1, col: 3 }], wall, { log: true });
    expect(chorusAt(r.events, 3, 0)).toMatchObject({ count: 2 });
  });

  it('단단끼리만 노래하면 단단 배율(합창보다 크면): 2·3 → 6박 1.75배', () => {
    const r = runBattle([{ char: 2, star: 1, row: 1, col: 0 }, { char: 3, star: 1, row: 1, col: 3 }], wall, { log: true });
    expect(chorusAt(r.events, 6, 0)).toMatchObject({ count: 2, prime: true });
    const songs = r.events.filter((e) => e.type === 'song' && e.beat === 6);
    for (const s of songs) expect(s).toMatchObject({ mult: 175 });
    // 혼자 노래하는 3박도 단단끼리 → 1.75배
    expect(r.events.find((e) => e.type === 'song' && e.beat === 3)).toMatchObject({ mult: 175 });
  });

  it('하나쌤은 붙은 친구가 노래할 때만 함께 노래하고 2명 몫', () => {
    const r = runBattle(
      [{ char: 1, star: 1, row: 1, col: 1 }, { char: 7, star: 1, row: 1, col: 2 }, { char: 11, star: 1, row: 1, col: 4 }],
      wall,
      { log: true },
    );
    // 7박: 7(이웃) + 하나쌤 2명 몫 = 3
    expect(chorusAt(r.events, 7, 0)).toMatchObject({ count: 3, prime: false });
    // 11박: 11은 하나쌤과 붙어 있지 않다 → 혼자, 단단끼리(7·11 = 단단 2명 켜짐) → 두 배
    expect(chorusAt(r.events, 11, 0)).toMatchObject({ count: 1, prime: true });
  });
});

describe('멈춤·손잡기·분열', () => {
  it('5의 1박 멈춤: 맞은 적은 다음 박에 아무것도 못 한다', () => {
    const r = runBattle([{ char: 5, star: 1, row: 0, col: 0 }], [{ char: 3, star: 3, row: 0, col: 0 }], { log: true });
    const enemyId = 100;
    expect(r.events.find((e) => e.type === 'stun' && e.beat === 5)).toMatchObject({ tgt: enemyId, beats: 1 });
    const acted6 = r.events.some((e) => e.beat === 6 && e.type === 'damage' && e.src === enemyId);
    const acted7 = r.events.some((e) => e.beat === 7 && e.type === 'damage' && e.src === enemyId);
    expect(acted6).toBe(false);
    expect(acted7).toBe(true);
  });

  it('손잡기: 12 옆 18 → 최대공약수 6 × 12 = 72씩', () => {
    const r = runBattle([{ char: 12, star: 1, row: 0, col: 1 }, { char: 18, star: 1, row: 0, col: 2 }], [{ char: 1, star: 1, row: 0, col: 0 }], { log: true });
    const hs = r.events.filter((e) => e.type === 'handshake');
    expect(hs.map((e) => ('shield' in e ? e.shield : 0))).toEqual([72, 72]);
  });

  it('부자 3명이면 쓰러진 12가 3과 4 꼬마로 나뉜다', () => {
    const r = runBattle(
      [{ char: 12, star: 1, row: 0, col: 2 }, { char: 18, star: 1, row: 1, col: 0 }, { char: 20, star: 1, row: 1, col: 4 }],
      [{ char: 36, star: 3, row: 0, col: 2 }, { char: 28, star: 3, row: 0, col: 1 }, { char: 25, star: 3, row: 0, col: 3 }],
      { log: true },
    );
    const split = r.events.find((e) => e.type === 'split' && e.unit === 0);
    expect(split).toBeDefined();
    const minions = r.fighters.filter((f) => f.minion && f.team === 0 && f.row === 0 && f.col === 2).map((f) => f.num);
    expect(minions.sort()).toEqual([3, 4]);
  });
});
