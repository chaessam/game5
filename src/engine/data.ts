// 숫자체스 데이터. 엔진이 쓰는 값은 모두 여기 있다(이 파일이 기준).
// 밸런스 조정은 숫자만 바꾸고 규칙 문장은 바꾸지 않는다(design/숫자체스_최종기획서.md 12절).

import type { FamilyId, RoleId, UnitDef } from './types';

export const UNITS: Record<number, UnitDef> = {
  1: { n: 1, name: '하나쌤', title: '하나 지휘자', role: 'singer', cost: 4, hp: 1100, atk: 17, skill: 'conductor', coef: 30, line: '자, 다 같이 한 박!' },
  2: { n: 2, name: '토토와 끼끼', title: '쌍둥이 토끼', role: 'healer', cost: 1, hp: 550, atk: 10, skill: 'twinHeal', coef: 6, line: '우리는~ 둘이야!' },
  3: { n: 3, name: '띵띵이', title: '트라이앵글 다람쥐', role: 'singer', cost: 1, hp: 550, atk: 12, skill: 'ding', coef: 12, line: '띵!' },
  4: { n: 4, name: '거부기', title: '네모 등껍질 거북 기사', role: 'knight', cost: 1, hp: 750, atk: 10, skill: 'shell', coef: 6, line: '내 뒤로 숨어!' },
  5: { n: 5, name: '오롱이', title: '불가사리 마법사', role: 'mage', cost: 1, hp: 550, atk: 11, skill: 'starfish', coef: 14, ccDiv: 5, line: '다섯 팔 빙글빙글, 얍!' },
  6: { n: 6, name: '붕붕이', title: '꿀벌 간호사', role: 'healer', cost: 1, hp: 580, atk: 10, skill: 'honey', coef: 2, line: '꿀 먹고 힘내!' },
  7: { n: 7, name: '칠색이', title: '무지개 고양이 궁수', role: 'hunter', cost: 1, hp: 550, atk: 14, skill: 'rainbowArrows', coef: 2, line: '…한 발이면 충분해.' },
  8: { n: 8, name: '먹물이', title: '여덟 다리 문어 닌자', role: 'ninja', cost: 2, hp: 630, atk: 15, skill: 'slap8', coef: 2, ccDiv: 4, line: '여덟 팔로 다 잡아 줄게~' },
  9: { n: 9, name: '여우비', title: '아홉 꼬리 구미호', role: 'mage', cost: 2, hp: 770, atk: 14, skill: 'foxfire', coef: 30, line: '내 꼬리 몇 개게?' },
  10: { n: 10, name: '스트라이크', title: '볼링 하마', role: 'hunter', cost: 2, hp: 730, atk: 15, skill: 'strike', coef: 8, line: '스트라이크!' },
  11: { n: 11, name: '일일이', title: '쌍검 닌자', role: 'ninja', cost: 2, hp: 730, atk: 16, skill: 'twinBlade', coef: 12, line: '쉿… 둘, 하나!' },
  12: { n: 12, name: '똑딱경', title: '시계 기사', role: 'knight', cost: 3, hp: 720, atk: 16, skill: 'clockStop', coef: 10, ccDiv: 6, line: '정각이다, 멈춰라!' },
  13: { n: 13, name: '덤덤이', title: '덤 빵 제빵사 곰', role: 'healer', cost: 3, hp: 810, atk: 14, skill: 'baker', coef: 5, line: '하나 더, 덤이야!' },
  15: { n: 15, name: '달콩이', title: '보름달 떡방아 호랑이 기사', role: 'knight', cost: 2, hp: 850, atk: 14, skill: 'ricecake', coef: 5, coef2: 6, line: '쿵덕쿵! 떡 하나 줄게!' },
  16: { n: 16, name: '접접이', title: '종이비행기 생쥐', role: 'hunter', cost: 2, hp: 810, atk: 21, skill: 'halfPlane', coef: 8, line: '반으로 접고, 또 반으로!' },
  17: { n: 17, name: '맴순이', title: '17년 매미 싱어', role: 'singer', cost: 3, hp: 760, atk: 16, skill: 'cicada', coef: 7, ccDiv: 6, line: '17년을 기다렸다!' },
  18: { n: 18, name: '빵빵', title: '변신 트럭 로봇', role: 'knight', cost: 3, hp: 720, atk: 15, skill: 'truck', coef: 5, coef2: 2, line: '다 타! 출발! 빵빵!' },
  20: { n: 20, name: '물음표', title: '스무고개 부엉이 박사', role: 'mage', cost: 4, hp: 760, atk: 21, skill: 'riddle', coef: 7, ccDiv: 20, line: '스무 번 안에 맞혀 볼까?' },
  21: { n: 21, name: '굴리', title: '주사위 닌자', role: 'ninja', cost: 3, hp: 920, atk: 23, skill: 'dice', coef: 1, line: '눈을 다 더하면? 21이지롱!' },
  24: { n: 24, name: '하루', title: '하루 해님 왕', role: 'singer', cost: 4, hp: 680, atk: 20, skill: 'noon', coef: 4, line: '좋은 아침! 다 같이 노래하자!' },
  25: { n: 25, name: '빙고리', title: '빙고 너구리 헌터', role: 'hunter', cost: 4, hp: 810, atk: 22, skill: 'bingo', coef: 10, line: '빙고!' },
  28: { n: 28, name: '그림자', title: '완벽 닌자 까마귀', role: 'ninja', cost: 4, hp: 810, atk: 25, skill: 'perfectBlades', coef: 3, line: '하나도 빠짐없이!' },
  30: { n: 30, name: '달래', title: '달님 여왕', role: 'healer', cost: 5, hp: 920, atk: 21, skill: 'fullMoon', coef: 5, line: '괜찮아, 내가 비춰 줄게.' },
  36: { n: 36, name: '서른여섯', title: '황금 보물 용', role: 'mage', cost: 5, hp: 930, atk: 25, skill: 'dragon', coef: 6, line: '내 약수 친구들, 다 모여라!' },
};

export const UNIT_IDS: number[] = Object.keys(UNITS).map(Number).sort((a, b) => a - b);

export interface FamilyDef {
  id: FamilyId;
  name: string;
  icon: string;
  rule: string;
}

export const FAMILIES: Record<FamilyId, FamilyDef> = {
  even: { id: 'even', name: '짝꿍', icon: '●●', rule: '2의 배수(짝수). 짝수 박에 \'짝!\' 한 대 더' },
  tri: { id: 'tri', name: '세모', icon: '▲', rule: '3의 배수. 3단 박마다 세모 방패를 채워요' },
  five: { id: 'five', name: '하이파이브', icon: '✋', rule: '5의 배수(끝자리 0·5). 5단 박마다 하이파이브! 공격력 쑥!' },
  prime: { id: 'prime', name: '다이아', icon: '◆', rule: '약수가 딱 2개(1과 자기)인 수. 그 박에 다이아 친구만 노래하면 쾅! 단단한 몸이라 덜 아파요' },
  rich: { id: 'rich', name: '부자', icon: '♛', rule: '약수가 6개 이상. 쓰러지면 곱셈 짝 꼬마 둘로 (12 → 3과 4)' },
};

export interface RoleDef {
  id: RoleId;
  name: string;
  rule: string;
}

export const ROLES: Record<RoleId, RoleDef> = {
  knight: { id: 'knight', name: '기사', rule: '앞줄에서 대신 맞아 줘요 \'나부터 때려!\'' },
  ninja: { id: 'ninja', name: '닌자', rule: '적 뒷줄부터 때려요' },
  hunter: { id: 'hunter', name: '헌터', rule: '가장 먼 적을 쏴요' },
  mage: { id: 'mage', name: '마법사', rule: '마법사 노래가 더 세요' },
  singer: { id: 'singer', name: '싱어', rule: '합창이 더 커져요' },
  healer: { id: 'healer', name: '힐러', rule: '회복·방패 노래가 더 커요' },
};

/**
 * 밸런스 손잡이. 퍼센트는 정수(150 = 1.5배)로 적어 모든 계산을 정수로 한다.
 * 단계 배열은 [꺼짐, 1단계, 2단계, 3단계] 순서.
 */
export interface BalanceConfig {
  /** 모든 노래(피해·회복·방패) 크기 배율(%) — 실험용 손잡이, 확정되면 계수에 녹이고 100으로 둔다 */
  songPowerPct: number;
  /** 모든 기본 공격력 배율(%) — 실험용 손잡이 */
  atkPct: number;
  maxBeat: number;
  hotBeatFrom: number;
  hotBasicPct: number;
  chorusPct: number[]; // 인원 k → 배율(%) : [0,1,2,3,4+]
  songMultCapPct: number;
  supportChorusBonusFactor: number; // 회복·방패 노래가 받는 합창 보너스 비율(%)
  handshakePerGcd: number;
  handshakeCap: number;
  rehearsalMinNumber: number;
  rehearsalPct: number;
  ccImmuneBeats: number;
  weakBasicPct: number;
  famTiers: Record<FamilyId, number[]>;
  roleTiers: number[];
  evenExtraPct: number[];
  triShield: number[];
  fiveAtk: number[];
  fiveMaxStacks: number;
  primeSongPct: number[];
  primeReducePct: number[];
  richPower: [number, number][]; // 분수 [분자, 분모]
  knightSelfReducePct: number[];
  knightAllReducePct: number[];
  ninjaAtkPct: number[];
  hunterAtkPct: number[];
  mageSongPct: number[];
  singerChorusPct: number[];
  healerSupportPct: number[];
  conductorChorusCount: number;
  conductorShieldMinOthers: number;
  minionSongCoef: number;
  coinHp: number;
  coinAtk: number;
  coinMax: number;
  /** 유닛 수치 덮어쓰기(밸런스 실험용) */
  unitOverrides: Partial<Record<number, Partial<Pick<UnitDef, 'hp' | 'atk' | 'coef' | 'coef2' | 'ccDiv' | 'cost'>>>>;
}

export const DEFAULT_CONFIG: BalanceConfig = {
  songPowerPct: 100,
  atkPct: 100,
  maxBeat: 48,
  hotBeatFrom: 36,
  hotBasicPct: 250,
  chorusPct: [100, 100, 150, 200, 225],
  songMultCapPct: 350,
  supportChorusBonusFactor: 50,
  handshakePerGcd: 12,
  handshakeCap: 190,
  rehearsalMinNumber: 24,
  rehearsalPct: 50,
  ccImmuneBeats: 3,
  weakBasicPct: 50,
  famTiers: { even: [2, 4, 6], tri: [3, 5, 7], five: [2, 4, 6], prime: [2, 4, 7], rich: [3, 5, 7] },
  roleTiers: [2, 4],
  evenExtraPct: [0, 30, 60, 100],
  triShield: [0, 25, 45, 75],
  fiveAtk: [0, 4, 8, 12],
  fiveMaxStacks: 6,
  primeSongPct: [100, 175, 200, 225],
  primeReducePct: [0, 5, 10, 20],
  richPower: [[0, 1], [1, 4], [1, 3], [1, 2]],
  knightSelfReducePct: [0, 15, 30],
  knightAllReducePct: [0, 0, 10],
  ninjaAtkPct: [0, 50, 100],
  hunterAtkPct: [0, 40, 80],
  mageSongPct: [0, 30, 70],
  singerChorusPct: [0, 50, 100],
  healerSupportPct: [0, 40, 100],
  conductorChorusCount: 2,
  conductorShieldMinOthers: 2,
  minionSongCoef: 10,
  coinHp: 25,
  coinAtk: 3,
  coinMax: 7,
  unitOverrides: {},
};

export function unitDef(char: number, cfg: BalanceConfig = DEFAULT_CONFIG): UnitDef {
  const base = UNITS[char];
  if (!base) throw new Error(`없는 캐릭터: ${char}`);
  const o = cfg.unitOverrides[char];
  return o ? { ...base, ...o } : base;
}

/** 단계 계산: count가 tiers[i] 이상이면 i+1단계. */
export function tierOf(count: number, tiers: readonly number[]): number {
  let t = 0;
  tiers.forEach((th, i) => {
    if (count >= th) t = i + 1;
  });
  return t;
}
