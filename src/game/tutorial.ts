// 튜토리얼 한 판(기획서 9절): 5라운드, 상점·골드·몬스터는 고정 대본, 질 수 없게 맞춰 둠.
// 기능은 숨기지 않고 '지금 볼 곳'만 반짝인다. 말풍선마다 아이가 할 행동이 하나씩 있다.
// 대사 없이 켜지는 시너지가 없게 tests/tutorial.test.ts가 지킨다.

import { gcd } from '../engine/math';
import type { BoardUnit, FamilyId, RoleId, Star } from '../engine/types';
import { allUnits, cellKey, createGame, setShop } from './game';
import { numberOf } from './items';
import type { BagItem, GameState, PlayerState } from './types';

export type Expect =
  | { kind: 'ok' }
  | { kind: 'own'; char: number; copies: number }
  | { kind: 'star'; char: number; star: Star }
  | { kind: 'board'; chars: number[]; not?: number[] }
  | { kind: 'front'; char: number }
  | { kind: 'level'; level: number }
  | { kind: 'num'; char: number; num: number }
  | { kind: 'selectItem'; item: BagItem }
  | { kind: 'handshake' }
  | { kind: 'reroll' }
  | { kind: 'ready' };

export interface TutStep {
  id: string;
  round: number;
  text: string;
  expect: Expect;
  /** 반짝일 곳(CSS 선택자) */
  highlight?: string;
  /** 이 단계에서 말로 설명하는 시너지(새로 켜지는 시너지는 여기 있어야 함) */
  mentions?: (FamilyId | RoleId)[];
  /** 전투가 끝난 뒤(결과 화면)에 보여 줄 대사인지 */
  afterBattle?: boolean;
}

export interface TutTalk {
  beat?: number;
  on?: 'rehearsal' | 'split' | 'stunMine';
  text: string;
}

interface TutRound {
  gold: number;
  shop: number[];
  monster: { name: string; board: BoardUnit[] };
  reward: BagItem | null;
  talk: TutTalk[];
}

const M = (char: number, star: Star, row: 0 | 1, col: number, hpPct: number, atkPct: number): BoardUnit => ({ char, star, row, col, hpPct, atkPct });

export const TUT_ROUNDS: Record<number, TutRound> = {
  1: {
    gold: 5,
    shop: [4, 2, 6, 2, 7],
    monster: { name: '숫자 슬라임 2·3', board: [M(2, 1, 0, 1, 260, 20), M(3, 1, 0, 3, 260, 20)] },
    reward: 'x2',
    talk: [
      { beat: 2, text: "2박! 짝수 박이라 짝꿍 친구가 '짝!' 하고 한 대 더 때려." },
      { beat: 4, text: '4박: 2와 4가 함께 노래! 2명 합창이면 노래가 1.5배야.' },
      { beat: 12, text: '12박: 2·4·6이 처음으로 다 같이 노래해(12는 최소공배수). 3명 합창 = 2배!' },
    ],
  },
  2: {
    gold: 6,
    shop: [2, 3, 7, 9, 13],
    monster: { name: '숫자 슬라임 2·3·4', board: [M(2, 1, 0, 1, 300, 20), M(3, 1, 1, 2, 300, 20), M(4, 1, 0, 3, 300, 20)] },
    reward: '/2',
    talk: [
      { beat: 2, text: '2박: 2가 혼자 노래! 다이아 친구만 노래하는 박이라 1.75배야.' },
      { beat: 6, text: '6박: 2·3·6이 함께! 6은 다이아가 아니라 보통 합창, 3명 = 2배. 6은 2와 3의 공배수야.' },
      { beat: 12, text: '12박: 2·3·4·6, 4명이 합창하면 2.25배!' },
    ],
  },
  3: {
    gold: 12,
    shop: [5, 9, 8, 3, 10],
    monster: { name: '연습 로봇 7·11', board: [M(7, 2, 0, 1, 150, 20), M(11, 1, 0, 3, 200, 20)] },
    reward: null,
    talk: [
      { beat: 9, text: '9박: 꼬리 9개라 여우불 9개!' },
      { beat: 10, text: '10박: 돌로 10이 된 오롱이가 10박에 노래해. 모습은 그대로, 박자는 새 숫자대로!' },
    ],
  },
  4: {
    gold: 19,
    shop: [7, 11, 16, 12, 13],
    monster: { name: '연습 로봇 9·15', board: [M(9, 2, 1, 2, 160, 20), M(15, 2, 0, 2, 180, 20)] },
    reward: null,
    talk: [
      { beat: 7, text: '7박: 7 혼자 노래, 다이아 박!' },
      { beat: 14, text: '14박: 2와 7이 함께 노래했지만 둘 다 다이아라 다이아 박!' },
    ],
  },
  5: {
    gold: 6,
    shop: [8, 15, 4, 18, 21],
    monster: {
      name: '로봇 대장 12·18·24',
      board: [M(12, 1, 0, 2, 130, 25), M(18, 1, 0, 1, 120, 25), M(4, 1, 0, 3, 110, 25), M(24, 1, 1, 2, 110, 25), M(3, 1, 1, 1, 110, 25)],
    },
    reward: 'mic',
    talk: [
      { on: 'rehearsal', text: '24 이상 큰 수는 싸우기 전에 몸풀기 노래를 절반 힘으로 한 번 해.' },
      { beat: 3, text: '3박: 로봇의 세모 친구가 3명 넘게 모여서 초록 세모 방패!' },
      { on: 'stunMine', text: '시계 기사가 노래로 내 앞줄을 멈췄어(12 ÷ 6 = 2박). 멈춘 친구는 그동안 노래를 놓쳐.' },
      { on: 'split', text: '로봇 12가 쓰러지며 3 + 4로 나뉘었어! 12 = 3 × 4, 3과 4는 12의 약수야.' },
    ],
  },
};

const shopIdx = (c: number) => `.cards .card[data-action="buy"][data-char="${c}"]`;

export const TUT_STEPS: TutStep[] = [
  // ---- 1라운드: 사기 · 자동 가문 · 직업 · 놓기 · 박자 · 합창
  { id: 'hello', round: 1, text: '안녕! 나는 1, 하나 지휘자야. 1은 모든 수의 약수라서 어떤 노래에도 낄 수 있어.', expect: { kind: 'ok' } },
  { id: 'song', round: 1, text: "이 게임은 필살기를 '노래'라고 불러. 3번 친구는 3단 박(3·6·9…)마다 노래해!", expect: { kind: 'ok' } },
  { id: 'buy4', round: 1, text: '4 거북을 눌러 사 봐! 4는 2의 배수라서 저절로 짝꿍 가문이야.', expect: { kind: 'own', char: 4, copies: 1 }, highlight: shopIdx(4) },
  { id: 'place4', round: 1, text: '대기석의 4를 누르고 판의 앞줄 칸을 눌러 봐. 기사는 앞줄에서 대신 맞아 줘!', expect: { kind: 'front', char: 4 }, highlight: '.board .cell.front' },
  { id: 'buy2', round: 1, text: '2 토끼를 사서 판(뒷줄)에 올려 봐. 짝꿍 2명, 켜졌다! 설명은 왼쪽 판에 늘 있으니 외우지 않아도 돼.', expect: { kind: 'board', chars: [4, 2] }, highlight: shopIdx(2), mentions: ['even'] },
  { id: 'buy6', round: 1, text: '6 꿀벌도 사서 올려 봐. 6은 짝꿍·세모 둘 다야. 오른쪽 직업 판! 2와 6은 힐러라 힐러가 켜졌어.', expect: { kind: 'board', chars: [4, 2, 6] }, highlight: shopIdx(6), mentions: ['healer'] },
  { id: 'buy2b', round: 1, text: "남은 2 토끼도 사 둬. 같은 친구는 대기석에 모아. '3장이면 2성!'", expect: { kind: 'own', char: 2, copies: 2 }, highlight: shopIdx(2) },
  { id: 'beats', round: 1, text: '2는 2단 박, 4는 4단 박, 6은 6단 박에 노래해. 같은 박에 노래하면 합창! 36박부터는 뜨거운 박이야.', expect: { kind: 'ok' } },
  { id: 'ready1', round: 1, text: '[준비 완료]를 눌러 싸워 봐! 박자 줄을 보면 누가 언제 노래하는지 보여.', expect: { kind: 'ready' }, highlight: '[data-action="ready"]' },
  { id: 'medal1', round: 1, text: '이기면 메달! 몬스터를 이기면 2개, 친구와 대결은 이기면 3개, 져도 1개야. 보상은 두 배 돌!', expect: { kind: 'ok' }, afterBattle: true },

  // ---- 2라운드: 레벨 · 합체 · 다이아 · 손잡기
  { id: 'level4', round: 2, text: '라운드마다 레벨이 저절로 올라. 이제 판에 4명까지 놓을 수 있어!', expect: { kind: 'ok' }, highlight: '.lv' },
  { id: 'merge', round: 2, text: '2 토끼를 사 봐. 같은 친구 3장이면 2성! 체력도 공격도 노래도 2배야.', expect: { kind: 'star', char: 2, star: 2 }, highlight: shopIdx(2) },
  { id: 'prime', round: 2, text: '3 다람쥐를 사서 판에 올려 봐. 2와 3은 약수가 1과 자기뿐인 다이아 가문! 다이아만 노래하는 박엔 1.75배.', expect: { kind: 'board', chars: [4, 2, 6, 3] }, highlight: shopIdx(3), mentions: ['prime'] },
  { id: 'hand', round: 2, text: '붙어 있는 두 친구의 최대공약수가 2 이상이면 손잡기 방패가 생겨. 친구 위 🤝 숫자가 방패야. 4와 6을 위아래나 옆으로 붙여 봐!', expect: { kind: 'handshake' }, highlight: '.board' },
  { id: 'hand7', round: 2, text: '7은 1과 7로만 나눠져서 4와 같이 나눌 수 있는 수가 1뿐이야. 그래서 손을 못 잡아.', expect: { kind: 'ok' } },
  { id: 'ready2', round: 2, text: '[준비 완료]! 다이아 박과 합창을 들어 봐.', expect: { kind: 'ready' }, highlight: '[data-action="ready"]' },
  { id: 'reward2', round: 2, text: '보상은 반쪽 돌(÷2)이야. 짝수만 반으로 나눌 수 있어.', expect: { kind: 'ok' }, afterBattle: true },

  // ---- 3라운드: 숫자 돌 · 직업 2축 · 고르기
  { id: 'xp', round: 3, text: '[레벨업 +4]를 눌러 레벨 5를 만들어 봐. 판에 5명!', expect: { kind: 'level', level: 5 }, highlight: '[data-action="xp"]' },
  { id: 'buy5', round: 3, text: '5 오롱이를 사서 판에 올려 봐.', expect: { kind: 'board', chars: [4, 2, 6, 3, 5] }, highlight: shopIdx(5) },
  { id: 'stone', round: 3, text: '가방의 ×2 돌을 누르고 5를 눌러 봐. 미리보기를 보고 [끼우기]!', expect: { kind: 'num', char: 5, num: 10 }, highlight: '.bagitems' },
  { id: 'stone2', round: 3, text: '모습도 직업도 성도 그대로! 바뀌는 건 숫자와 가문뿐. 10이 되어 짝꿍 4명이 켜졌어.', expect: { kind: 'ok' }, mentions: ['even'] },
  { id: 'gray', round: 3, text: '이번엔 ÷2 돌을 눌러 봐. 3 위의 ✕는 끼울 수 없다는 뜻이야(3 ÷ 2 = 1 … 1).', expect: { kind: 'selectItem', item: '/2' }, highlight: '.bagitems' },
  { id: 'mage', round: 3, text: '9 구미호를 사서 판의 3과 자리를 바꿔 봐. 마법사 2명이 켜지고 다이아는 꺼져. 무엇을 켤지 고르는 게 전략!', expect: { kind: 'board', chars: [9], not: [3] }, highlight: shopIdx(9), mentions: ['mage'] },
  { id: 'ready3', round: 3, text: '[준비 완료]! 9박을 잘 봐.', expect: { kind: 'ready' }, highlight: '[data-action="ready"]' },

  // ---- 4라운드: 저금 · 레벨 · 다이아 박 · 하나쌤
  { id: 'save', round: 4, text: '19골드야. 19 ÷ 10 = 1 … 9라서 다음 라운드에 저금 보너스 +1! 위 띠에 미리 나와.', expect: { kind: 'ok' }, highlight: '.top .stat' },
  { id: 'xp2', round: 4, text: '[레벨업]을 두 번 눌러 레벨 6을 만들어 봐.', expect: { kind: 'level', level: 6 }, highlight: '[data-action="xp"]' },
  { id: 'buy7', round: 4, text: '7 고양이를 사서 판에 올려 봐. 7은 약수가 1과 7, 딱 2개. 다이아가 다시 켜졌어!', expect: { kind: 'board', chars: [7] }, highlight: shopIdx(7), mentions: ['prime'] },
  { id: 'reroll', round: 4, text: '[새로고침]을 눌러 봐. 10골드 아래로 내려가면 저금 보너스가 사라져! 아낄까, 쓸까?', expect: { kind: 'reroll' }, highlight: '[data-action="reroll"]' },
  { id: 'me', round: 4, text: '나는 붙어 있는 친구가 노래할 때 같이 노래해. 합창에선 2명 몫! 3골드라 레벨 4부터 가끔 나와.', expect: { kind: 'ok' } },
  { id: 'ready4', round: 4, text: '[준비 완료]! 7박과 14박을 잘 봐.', expect: { kind: 'ready' }, highlight: '[data-action="ready"]' },

  // ---- 5라운드: 몸풀기 · 세모 방패 · 멈춤 · 부자 분열 · 마무리
  { id: 'boss', round: 5, text: '마지막 판! 로봇 대장이 세모·부자 친구들을 데려왔어. 오른쪽 위 얼굴을 눌러 로봇 판도 구경해 봐.', expect: { kind: 'ok' } },
  { id: 'ready5', round: 5, text: '[준비 완료]! 이번엔 보면서 배워 봐.', expect: { kind: 'ready' }, highlight: '[data-action="ready"]' },
  { id: 'mic', round: 5, text: '보상은 합창 마이크! 보물은 카드에 적힌 대로 작동해. 두 번째 아이템 칸은 6라운드부터 열려.', expect: { kind: 'ok' }, afterBattle: true },
  { id: 'end', round: 5, text: '세 줄만 기억해! ① 3번 친구는 3단 박에 노래 ② 같은 박이면 합창 ③ 가문은 숫자가, 직업은 캐릭터가.', expect: { kind: 'ok' }, afterBattle: true },
];

export const QUIZ: { q: string; choices: string[]; answer: number; why: string }[] = [
  { q: '12박에 노래하는 친구는? (판: 2·5·6·7)', choices: ['2와 6', '5와 7', '2·5·6·7 모두'], answer: 0, why: '12는 2와 6의 배수예요(2와 6은 12의 약수).' },
  { q: '7에 빼기 돌(−1)을 끼우면 어느 가문?', choices: ['다이아', '짝꿍·세모', '하이파이브'], answer: 1, why: '7 − 1 = 6, 6은 2와 3의 배수라 짝꿍·세모예요.' },
  { q: '4와 6이 처음 함께 노래하는 박은?', choices: ['10박', '12박', '24박'], answer: 1, why: '4와 6의 최소공배수는 12예요.' },
];

/** 튜토리얼 판: 몬스터만 5라운드, 1라운드 무료 카드 없이 바로 준비 */
export function createTutorial(): GameState {
  const g = createGame({ seed: 20261013, bots: 0 });
  g.rounds = [1, 2, 3, 4, 5].map((r) => ({ round: r, kind: 'pve' as const }));
  g.monsters = Object.fromEntries(Object.entries(TUT_ROUNDS).map(([r, t]) => [Number(r), t.monster]));
  // 1라운드 무료 카드는 풀로 돌려준다
  for (const [, cands] of Object.entries(g.freePick)) for (const c of cands) g.pool[c]++;
  g.freePick = {};
  g.phase = 'prep';
  prepareTutorialRound(g);
  return g;
}

/** 라운드 시작마다: 정해 둔 골드·상점 */
export function prepareTutorialRound(g: GameState) {
  const t = TUT_ROUNDS[g.round];
  const p = g.players[0];
  if (!t) return;
  p.gold = t.gold;
  p.shopLocked = false;
  setShop(g, p, t.shop);
}

/** 전투가 끝난 뒤: 보상을 대본대로 */
export function fixTutorialRewards(g: GameState) {
  const t = TUT_ROUNDS[g.round];
  g.pendingRewards = t?.reward ? [{ playerId: 0, options: [[t.reward]] }] : [];
  g.phase = g.pendingRewards.length ? 'reward' : 'prep';
}

const adjacentGcd = (p: PlayerState) => {
  const units = [...p.board.entries()].map(([k, u]) => ({ u, row: Number(k[0]), col: Number(k[2]) }));
  for (const a of units) for (const b of units) {
    if (a === b || Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) continue;
    if (gcd(numberOf(a.u), numberOf(b.u)) >= 2) return true;
  }
  return false;
};

const copies = (p: PlayerState, char: number) => allUnits(p).filter((u) => u.char === char).reduce((s, u) => s + 3 ** (u.star - 1), 0);

/** 이 단계의 행동을 했나(ok·ready는 화면이 직접 넘김) */
export function stepDone(g: GameState, step: TutStep, ui: { selectedItem?: BagItem; rerolled?: boolean }): boolean {
  const p = g.players[0];
  const e = step.expect;
  const boardChars = new Set([...p.board.values()].map((u) => u.char));
  switch (e.kind) {
    case 'own': return copies(p, e.char) >= e.copies;
    case 'star': return allUnits(p).some((u) => u.char === e.char && u.star >= e.star);
    case 'board': return e.chars.every((c) => boardChars.has(c)) && !(e.not ?? []).some((c) => boardChars.has(c));
    case 'front': return [0, 1, 2, 3, 4].some((col) => p.board.get(cellKey(0, col))?.char === e.char);
    case 'level': return p.level >= e.level;
    case 'num': return [...p.board.values(), ...p.bench].some((u) => u && u.char === e.char && numberOf(u) === e.num);
    case 'selectItem': return ui.selectedItem === e.item;
    case 'handshake': return adjacentGcd(p);
    case 'reroll': return !!ui.rerolled;
    default: return false;
  }
}

/** 이 단계에서 할 행동만 허락(대본이 어긋나지 않게). 옮기기·구경·자세히는 언제나 됨 */
export function tutorialAllows(step: TutStep | undefined, action: string, char?: number): string | null {
  if (!step) return null;
  const e = step.expect;
  switch (action) {
    case 'buy':
      if ((e.kind === 'own' || e.kind === 'star') && e.char === char) return null;
      if (e.kind === 'board' && char !== undefined && e.chars.includes(char)) return null;
      return '하나쌤 말을 먼저 따라 해 봐!';
    case 'ready':
      return e.kind === 'ready' ? null : '하나쌤 말을 먼저 따라 해 봐!';
    case 'xp':
      return e.kind === 'level' ? null : '지금은 레벨업을 안 해도 돼!';
    case 'reroll':
      return e.kind === 'reroll' ? null : '지금은 새로고침을 안 해도 돼!';
    case 'sell':
    case 'lock':
      return '튜토리얼에서는 잠깐 쉬어 가요!';
    default:
      return null;
  }
}
