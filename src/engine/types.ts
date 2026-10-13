export type FamilyId = 'even' | 'tri' | 'five' | 'prime' | 'rich';
export type RoleId = 'knight' | 'ninja' | 'hunter' | 'mage' | 'singer' | 'healer';
export type StoneOp = '+1' | '-1' | 'x2' | 'x3' | '/2' | '/3';
export type TreasureId = 'mic' | 'glove' | 'bag';
export type ItemId = StoneOp | TreasureId;
export type Star = 1 | 2 | 3;
export type TeamIndex = 0 | 1;

/** 노래(필살기) 종류. 숫자 캐릭터마다 하나. */
export type SkillId =
  | 'conductor' | 'twinHeal' | 'ding' | 'shell' | 'starfish' | 'honey' | 'rainbowArrows'
  | 'slap8' | 'foxfire' | 'strike' | 'twinBlade' | 'clockStop' | 'baker' | 'ricecake'
  | 'halfPlane' | 'cicada' | 'truck' | 'riddle' | 'dice' | 'noon' | 'bingo'
  | 'perfectBlades' | 'fullMoon' | 'dragon';

export interface UnitDef {
  /** 캐릭터 번호 = 원래 숫자 */
  n: number;
  name: string;
  title: string;
  role: RoleId;
  cost: 1 | 2 | 3 | 4 | 5;
  hp: number;
  atk: number;
  skill: SkillId;
  /** 노래 크기 = 숫자 × coef (스킬마다 쓰는 법이 다름) */
  coef: number;
  /** 보조 계수(자기 방패 등) */
  coef2?: number;
  /** 멈춤/약하게 시간 = 숫자 ÷ div 박(버림) */
  ccDiv?: number;
  line: string;
}

/** 보드에 놓인 친구 한 명(전투 입력). */
export interface BoardUnit {
  char: number;
  star: Star;
  row: 0 | 1; // 0 = 앞줄, 1 = 뒷줄
  col: number; // 0~4
  items?: ItemId[];
}

export type Winner = TeamIndex | 'draw';

export interface UnitStats {
  songs: number;
  rehearsal: number;
  songDamage: number;
  basicDamage: number;
  support: number;
}

export type BattleEvent =
  | { beat: number; type: 'coins'; unit: number; coins: number; nums: number[] }
  | { beat: number; type: 'handshake'; unit: number; shield: number }
  | { beat: number; type: 'familyBeat'; team: TeamIndex; family: 'tri' | 'five'; value: number }
  | { beat: number; type: 'chorus'; team: TeamIndex; singers: number[]; count: number; prime: boolean }
  | { beat: number; type: 'song'; unit: number; rehearsal: boolean; mult: number }
  | { beat: number; type: 'damage'; src: number; tgt: number; amount: number; absorbed: number; basic: boolean }
  | { beat: number; type: 'heal'; src: number; tgt: number; amount: number }
  | { beat: number; type: 'shield'; src: number; tgt: number; amount: number }
  | { beat: number; type: 'stun' | 'weak'; src: number; tgt: number; beats: number }
  | { beat: number; type: 'death'; unit: number }
  | { beat: number; type: 'revive'; src: number; tgt: number; hp: number }
  | { beat: number; type: 'split'; unit: number; minions: number[] };
