// 숫자 돌·보물 끼우기(기획서 6절). "캐릭터는 그대로, 등번호만 바뀐다."
// - 친구마다 아이템 칸 2개, 두 번째 칸은 6라운드(짧은 판 4라운드)부터.
// - 돌은 왼쪽 칸부터 계산하고, 단계마다 2~40이어야 한다.
// - 준비 시간에는 언제든 공짜로 빼고 바꾼다. 돌은 써도 없어지지 않는다.

import { DEFAULT_CONFIG, UNITS, tierOf, unitDef } from '../engine/data';
import { applyStones, familiesOf } from '../engine/math';
import type { FamilyId, ItemId, RoleId, Star, StoneOp, TreasureId } from '../engine/types';
import { ECON } from './economy';
import type { BagItem, GameState, PlayerState, UnitInst } from './types';

export const STONES: readonly StoneOp[] = ['+1', '-1', 'x2', '/2', 'x3', '/3'];
export const TREASURES: readonly TreasureId[] = ['mic', 'glove', 'bag'];
export const isStoneItem = (it: ItemId): it is StoneOp => (STONES as readonly string[]).includes(it);

export const ITEM_LABEL: Record<BagItem, string> = {
  '+1': '+1', '-1': '−1', x2: '×2', '/2': '÷2', x3: '×3', '/3': '÷3', mic: '🎤', glove: '🧤', bag: '👝',
};
export const ITEM_NAME: Record<BagItem, string> = {
  '+1': '더하기 돌 (+1)', '-1': '빼기 돌 (−1)', x2: '두 배 돌 (×2)', '/2': '반쪽 돌 (÷2)', x3: '세 배 돌 (×3)', '/3': '삼등분 돌 (÷3)',
  mic: '합창 마이크', glove: '손잡기 장갑', bag: '분신 주머니',
};
export const ITEM_HELP: Record<BagItem, string> = {
  '+1': '숫자에 1을 더해요 (40까지)', '-1': '숫자에서 1을 빼요 (2부터)', x2: '숫자를 두 배로 (40까지)', '/2': '짝수만 반으로 나눠요',
  x3: '숫자를 세 배로 (40까지)', '/3': '3의 배수만 셋으로 나눠요',
  mic: '이 친구가 합창에 끼면 인원 +1', glove: '이 친구와 이웃의 손잡기 방패 2배', bag: '쓰러지면 곱셈 짝 꼬마 둘로 (다이아 수는 효과 없음)',
};

/** 두 번째 칸이 열리는 라운드 */
export const secondSlotRound = (g: GameState) => (g.rounds.length >= 12 ? 6 : 4);
/** 지금 열린 아이템 칸 수 */
export const slotCount = (g: GameState): 1 | 2 => (g.round >= secondSlotRound(g) ? 2 : 1);

const stonesOf = (items: readonly ItemId[]) => items.filter(isStoneItem);

/** 친구의 지금 숫자(돌 반영) */
export function numberOf(u: Pick<UnitInst, 'char' | 'items'>): number {
  const r = applyStones(u.char, stonesOf(u.items));
  return r.ok ? r.value : u.char;
}

/** 이 아이템 목록이 이 캐릭터에 맞는가(돌 계산이 모두 2~40) */
export function checkItems(char: number, items: readonly ItemId[]) {
  return applyStones(char, stonesOf(items));
}

export type ItemResult = { ok: true } | { ok: false; reason: string };

/** 가방의 아이템을 친구에게 끼운다. slot을 주면 그 칸(차 있으면 바꿔 끼우고 원래 것은 가방으로). */
export function equip(g: GameState, p: PlayerState, unit: UnitInst, bagIndex: number, slot?: number): ItemResult {
  const item = p.bag[bagIndex];
  if (item === undefined) return { ok: false, reason: '가방에 없는 아이템이에요' };
  const next = planEquip(g, unit, item, slot);
  if (!next.ok) return next;
  p.bag.splice(bagIndex, 1);
  if (next.removed) p.bag.push(next.removed);
  unit.items = next.items;
  return { ok: true };
}

/** 끼우면 아이템 칸이 어떻게 되나(실제로 바꾸지는 않음) */
export function planEquip(
  g: GameState,
  unit: Pick<UnitInst, 'char' | 'items'>,
  item: BagItem,
  slot?: number,
): { ok: true; items: ItemId[]; removed: BagItem | null; expr: string; value: number } | { ok: false; reason: string } {
  const open = slotCount(g);
  const items = unit.items.slice();
  let removed: BagItem | null = null;
  if (slot !== undefined && slot < items.length) {
    removed = items[slot] as BagItem;
    items[slot] = item;
  } else if (items.length < open) items.push(item);
  else {
    return {
      ok: false,
      reason: open === 1 ? `칸이 찼어요. 두 번째 칸은 ${secondSlotRound(g)}라운드에 열려요` : '칸 2개가 모두 찼어요. 먼저 하나를 빼요',
    };
  }
  const r = checkItems(unit.char, items);
  if (!r.ok) return { ok: false, reason: `${r.expr}, ${r.reason}` };
  return { ok: true, items, removed, expr: r.expr, value: r.value };
}

/** 친구의 아이템을 빼서 가방으로. 남은 돌 계산이 틀어지면 뒤 칸 것도 함께 뺀다. */
export function unequip(p: PlayerState, unit: UnitInst, slot: number): ItemResult {
  const it = unit.items[slot];
  if (it === undefined) return { ok: false, reason: '빈 칸이에요' };
  const rest = unit.items.filter((_, i) => i !== slot);
  const back: ItemId[] = [it];
  if (!checkItems(unit.char, rest).ok) back.push(...rest.splice(0));
  if (p.bag.length + back.length > ECON.bagSize) return { ok: false, reason: `가방이 꽉 찼어요 (${ECON.bagSize}칸)` };
  unit.items = rest;
  p.bag.push(...(back as BagItem[]));
  return { ok: true };
}

/** 합체 등으로 받은 아이템을 열린 칸·돌 계산에 맞게 정리한다. 남는 것은 돌려준다. */
export function fitItems(g: GameState, char: number, items: readonly ItemId[]): { keep: ItemId[]; extra: ItemId[] } {
  const keep: ItemId[] = [];
  const extra: ItemId[] = [];
  for (const it of items) {
    if (keep.length < slotCount(g) && checkItems(char, [...keep, it]).ok) keep.push(it);
    else extra.push(it);
  }
  return { keep, extra };
}

// ---------------- 보드 시너지(지금 숫자 기준) ----------------
export const FAM_ORDER: FamilyId[] = ['even', 'tri', 'five', 'prime', 'rich'];
export const ROLE_ORDER: RoleId[] = ['knight', 'ninja', 'hunter', 'mage', 'singer', 'healer'];

export interface BoardSynergy {
  /** 보드 위 서로 다른 지금 숫자 */
  nums: Set<number>;
  /** 보드 위 서로 다른 캐릭터 */
  chars: Set<number>;
  fam: Record<FamilyId, { count: number; tier: number }>;
  role: Record<RoleId, { count: number; tier: number }>;
}

/** 가문은 '서로 다른 지금 숫자', 직업은 '서로 다른 캐릭터'로 센다. 대기석은 세지 않는다. */
export function synergyOf(units: readonly Pick<UnitInst, 'char' | 'items'>[]): BoardSynergy {
  const nums = new Set(units.map(numberOf));
  const chars = new Set(units.map((u) => u.char));
  const fam = {} as BoardSynergy['fam'];
  for (const f of FAM_ORDER) {
    const count = [...nums].filter((n) => familiesOf(n).includes(f)).length;
    fam[f] = { count, tier: tierOf(count, DEFAULT_CONFIG.famTiers[f]) };
  }
  const role = {} as BoardSynergy['role'];
  for (const r of ROLE_ORDER) {
    const count = [...chars].filter((c) => UNITS[c]?.role === r).length;
    role[r] = { count, tier: tierOf(count, DEFAULT_CONFIG.roleTiers) };
  }
  return { nums, chars, fam, role };
}

export const boardSynergy = (p: PlayerState) => synergyOf([...p.board.values()]);

// ---------------- 미리보기(3줄 + 30박) ----------------
export interface FamChange {
  fam: FamilyId;
  before: number;
  after: number;
  tierBefore: number;
  tierAfter: number;
}

export interface EquipPreview {
  ok: boolean;
  reason?: string;
  from: number;
  to: number;
  expr: string;
  /** 이 친구에게 생기는/사라지는 가문 */
  gained: FamilyId[];
  lost: FamilyId[];
  /** 보드 가문 판에서 바뀌는 줄(보드 위 친구일 때만) */
  board: FamChange[];
  onBoard: boolean;
  /** 30박 동안 노래: [횟수, 한 번 크기] 전·후 */
  song: { before: [number, number]; after: [number, number] } | null;
  warnings: string[];
}

/** 30박 동안 노래 횟수와 한 번 크기(1성 기준이 아니라 지금 성 기준) */
export function songOver30(char: number, num: number, star: Star): [number, number] {
  const def = unitDef(char);
  return [Math.floor(30 / num), num * def.coef * star];
}

export function previewEquip(g: GameState, p: PlayerState, unit: UnitInst, item: BagItem, slot?: number): EquipPreview {
  const from = numberOf(unit);
  const plan = planEquip(g, unit, item, slot);
  const base: EquipPreview = { ok: false, from, to: from, expr: '', gained: [], lost: [], board: [], onBoard: false, song: null, warnings: [] };
  if (!plan.ok) return { ...base, reason: plan.reason };
  const to = plan.value;
  const fBefore = familiesOf(from);
  const fAfter = familiesOf(to);
  const onBoard = [...p.board.values()].includes(unit);
  const res: EquipPreview = {
    ...base, ok: true, to, expr: plan.expr, onBoard,
    gained: fAfter.filter((f) => !fBefore.includes(f)),
    lost: fBefore.filter((f) => !fAfter.includes(f)),
  };
  if (onBoard) {
    const units = [...p.board.values()];
    const before = synergyOf(units);
    const after = synergyOf(units.map((u) => (u === unit ? { char: u.char, items: plan.items } : u)));
    for (const f of FAM_ORDER) {
      if (before.fam[f].count !== after.fam[f].count) {
        res.board.push({ fam: f, before: before.fam[f].count, after: after.fam[f].count, tierBefore: before.fam[f].tier, tierAfter: after.fam[f].tier });
      }
    }
  }
  if (unitDef(unit.char).skill !== 'conductor' && from !== to) res.song = { before: songOver30(unit.char, from, unit.star), after: songOver30(unit.char, to, unit.star) };
  if (res.lost.length >= 2) res.warnings.push(`가문 ${res.lost.length}개가 꺼져요!`);
  if (unitDef(unit.char).skill === 'conductor' && to !== 1) res.warnings.push('하나쌤은 1이 아니면 가까이서 지휘하는 능력을 잃어요');
  if (item === 'bag' && familiesOf(to).includes('prime')) res.warnings.push('다이아 수(1 × 자기뿐)에는 분신 주머니가 효과가 없어요');
  return res;
}
