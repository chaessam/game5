// 서버가 받는 보드 검사(유령 기록·온라인 대결): 있는 캐릭터, 성 1~3, 칸 안, 겹치지 않음, 돌 계산이 2~40
import { UNITS } from '../engine/data';
import { applyStones } from '../engine/math';
import type { BoardUnit, StoneOp } from '../engine/types';
import { ECON } from '../game/economy';

const STONES = ['+1', '-1', 'x2', '/2', 'x3', '/3'];
const ITEMS = [...STONES, 'mic', 'glove', 'bag'];

export function validBoard(b: unknown): b is BoardUnit[] {
  if (!Array.isArray(b) || b.length > ECON.maxLevel) return false;
  const seen = new Set<string>();
  for (const u of b as BoardUnit[]) {
    if (!u || !UNITS[u.char] || ![1, 2, 3].includes(u.star) || ![0, 1].includes(u.row) || !(Number.isInteger(u.col) && u.col >= 0 && u.col <= 4)) return false;
    const k = `${u.row},${u.col}`;
    if (seen.has(k)) return false;
    seen.add(k);
    const items = u.items ?? [];
    if (!Array.isArray(items) || items.length > 2 || !items.every((i) => ITEMS.includes(i))) return false;
    if (!applyStones(u.char, items.filter((i) => STONES.includes(i)) as StoneOp[]).ok) return false;
  }
  return true;
}

/** 서버로 보낼 때 필요한 것만 남김 */
export const cleanBoard = (b: BoardUnit[]): BoardUnit[] =>
  b.map((u) => ({ char: u.char, star: u.star, row: u.row, col: u.col, ...(u.items?.length ? { items: u.items.slice(0, 2) } : {}) }));
