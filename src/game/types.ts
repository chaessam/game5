import type { FamilyId, ItemId, RoleId, Star, StoneOp, TreasureId } from '../engine/types';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** 컴퓨터의 기억(목표 가문·직업·덱, 일부러 비운 칸) */
export interface BotMemory {
  fam?: FamilyId;
  role?: RoleId;
  deck?: string;
  /** 시뮬레이션용: 덱을 바꾸지 않음 */
  lockDeck?: boolean;
  keepEmpty?: boolean;
}

/** 플레이어가 가진 친구 한 명 */
export interface UnitInst {
  uid: number;
  char: number;
  star: Star;
  /** 아이템 칸 2개(숫자 돌·보물) */
  items: ItemId[];
}

export type Slot =
  | { kind: 'board'; row: 0 | 1; col: number }
  | { kind: 'bench'; index: number };

export type BagItem = StoneOp | TreasureId;

export interface PlayerState {
  id: number;
  name: string;
  isBot: boolean;
  difficulty: Difficulty;
  ai?: BotMemory;
  /** 친구 유령: 라운드별 보드(같은 학교 친구가 실제로 둔 판). 있으면 상점 대신 이 판으로 싸운다 */
  ghost?: import('../engine/types').BoardUnit[][];
  gold: number;
  level: number;
  xp: number;
  medals: number;
  wins: number;
  winStreak: number;
  lossStreak: number;
  /** 보드: key = "row,col" */
  board: Map<string, UnitInst>;
  bench: (UnitInst | null)[];
  /** 상점 5칸(캐릭터 번호, 산 칸은 null) */
  shop: (number | null)[];
  shopLocked: boolean;
  bag: BagItem[];
  stonesReceived: number;
  consolationUsed: boolean;
  lastOpponent: number | null;
  lastSurvivors: number;
  history: RoundRecord[];
}

export interface RoundRecord {
  round: number;
  kind: 'pvp' | 'pve';
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  medals: number;
  beats: number;
}

export type RoundKind = 'pve' | 'pvp';

export interface RoundPlan {
  round: number;
  kind: RoundKind;
  finale?: boolean;
}

export type GamePhase = 'freePick' | 'prep' | 'reward' | 'over';

export interface PendingReward {
  playerId: number;
  options: BagItem[][]; // 상자/선택지마다 받을 것들
  /** 상자에 카드가 들어 있으면 그 값(골드 비용) */
  cardCost?: (number | null)[];
}

export interface GameState {
  seed: number;
  rngState: number;
  round: number;
  rounds: RoundPlan[];
  phase: GamePhase;
  players: PlayerState[];
  /** 카드 풀: 캐릭터 → 남은 장수 */
  pool: Record<number, number>;
  nextUid: number;
  /** 1라운드 무료 카드 후보 */
  freePick: Record<number, number[]>;
  pendingRewards: PendingReward[];
  /** 이번 라운드 몬스터(라운드 시작에 시드로 고름) */
  monsterIndex: number;
  log: string[];
}
