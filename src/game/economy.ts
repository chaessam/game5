// 경제 수치(기획서 7절). 판 안에서만 쓰는 골드·메달 — 현금 결제·확률형 상품 없음.

export const ECON = {
  baseIncome: 5,
  interestPer: 10,
  interestMax: 2,
  rerollCost: 2,
  xpCost: 4,
  xpAmount: 4,
  autoXpPerRound: 2,
  autoXpFromRound: 2,
  /** 레벨 → 다음 레벨까지 필요한 경험치 */
  xpToNext: { 3: 2, 4: 6, 5: 10, 6: 16, 7: 24 } as Record<number, number>,
  minLevel: 3,
  maxLevel: 8,
  benchSize: 8,
  shopSize: 5,
  bagSize: 6,
  stoneCapPerGame: 5,
  stoneOverflowGold: 2,
  pveWinGold: 2,
  /** 연승·연패 보너스(연속 횟수 → 골드) */
  winStreakBonus: (n: number) => (n >= 4 ? 2 : n >= 2 ? 1 : 0),
  lossStreakBonus: (n: number) => (n >= 4 ? 3 : n === 3 ? 2 : n === 2 ? 1 : 0),
};

/** 레벨별 상점 확률(%) — 1골드~5골드, 각 줄 합 100 */
export const SHOP_ODDS: Record<number, [number, number, number, number, number]> = {
  3: [75, 25, 0, 0, 0],
  4: [55, 35, 10, 0, 0],
  5: [40, 35, 20, 5, 0],
  6: [21, 35, 28, 12, 4],
  7: [15, 25, 33, 20, 7],
  8: [10, 18, 30, 28, 14],
};

/** 방 하나가 함께 쓰는 카드 풀 */
export const POOL: Record<number, { units: number[]; copies: number }> = {
  1: { units: [2, 3, 4, 5, 6, 7], copies: 18 },
  2: { units: [8, 9, 10, 11, 15, 16], copies: 15 },
  3: { units: [12, 13, 17, 18, 21], copies: 12 },
  4: { units: [1, 20, 24, 25, 28], copies: 10 },
  5: { units: [30, 36], copies: 9 },
};

export const MEDALS = {
  pvp: { win: 3, draw: 2, loss: 1, perDefeated: 1, perDefeatedMax: 3, finaleRounds: [11, 12], finaleWinBonus: 1 },
  pve: { win: 2, loss: 1 },
};

/** 합체에 든 장수: 1성 1장, 2성 3장, 3성 9장 */
export const copiesOfStar = (star: number) => 3 ** (star - 1);
