// 3단계: 이번 주 규칙 · 숫자 마법 카드. 수치는 tools/ai-sim.ts --magic 으로 맞춤.
import { DEFAULT_CONFIG, type BalanceConfig } from '../engine/data';
import type { TeamMods } from '../engine/battle';
import type { FamilyId } from '../engine/types';

// ---------------- 이번 주 규칙 ----------------
export interface WeeklyRule {
  id: string;
  icon: string;
  name: string;
  /** 한 줄 설명(무엇이 바뀌는지 숫자로) */
  text: string;
  config?: Partial<BalanceConfig>;
  econ?: { stoneCapPlus?: number; extraBox?: boolean; interestPlus?: number };
}

export const WEEKLY_RULES: WeeklyRule[] = [
  { id: 'chorus', icon: '🎵', name: '합창 축제', text: '합창이 더 세져요: 2명 1.75배 · 3명 2.25배 · 4명 이상 2.5배', config: { chorusPct: [100, 100, 175, 225, 250] } },
  { id: 'prime', icon: '💎', name: '다이아 주간', text: '다이아 친구만 노래하면 배율 +0.25 (2명 2배 · 4명 2.25배 · 7명 2.5배)', config: { primeSongPct: [100, 200, 225, 250] } },
  { id: 'tri', icon: '🔺', name: '세모 방패 주간', text: '세모 방패가 두꺼워져요: 3명 40 · 5명 70 · 7명 110', config: { triShield: [0, 40, 70, 110] } },
  { id: 'five', icon: '✋', name: '하이파이브 주간', text: '하이파이브 공격이 더 올라가요: 2명 +6 · 4명 +12 · 6명 +18', config: { fiveAtk: [0, 6, 12, 18] } },
  { id: 'even', icon: '👯', name: '짝꿍 주간', text: '짝수 박 짝! 추가타가 세져요: 2명 45% · 4명 90% · 6명 150%', config: { evenExtraPct: [0, 45, 90, 150] } },
  { id: 'rich', icon: '👑', name: '부자 주간', text: '부자 꼬마가 커져요: 3명 3분의 1 · 5명 절반 · 7명 3분의 2', config: { richPower: [[0, 1], [1, 3], [1, 2], [2, 3]] } },
  { id: 'hot', icon: '🔥', name: '뜨거운 박자 주간', text: '30박부터 기본 공격 2.5배(보통은 36박부터) — 빨리 끝나요', config: { hotBeatFrom: 30 } },
  { id: 'hand', icon: '🤝', name: '손잡기 주간', text: '손잡기 방패 1.5배: 최대공약수 × 18', config: { handshakePerGcd: 18, handshakeCap: 260 } },
  { id: 'stone', icon: '🪨', name: '돌 풍년 주간', text: '몬스터 보상 상자 하나 더 + 숫자 돌 한도 +3', econ: { stoneCapPlus: 3, extraBox: true } },
  { id: 'piggy', icon: '🐷', name: '저금 주간', text: '저금 보너스 최대 3골드(보통은 2골드)', econ: { interestPlus: 1 } },
];

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** 한국 시간 월요일 0시에 바뀌는 주 번호 */
export function weekIndex(now = Date.now()): number {
  return Math.floor((now + 9 * 3600 * 1000 - 4 * 24 * 3600 * 1000) / WEEK_MS); // 1970-01-05(월)부터
}
export const ruleOfWeek = (now = Date.now()) => WEEKLY_RULES[((weekIndex(now) % WEEKLY_RULES.length) + WEEKLY_RULES.length) % WEEKLY_RULES.length];
export const ruleById = (id?: string | null) => WEEKLY_RULES.find((r) => r.id === id);

const cfgCache = new Map<string, BalanceConfig>();
/** 규칙이 바꾼 전투 수치(없으면 기본) */
export function ruleConfig(id?: string | null): BalanceConfig {
  const r = ruleById(id);
  if (!r?.config) return DEFAULT_CONFIG;
  let c = cfgCache.get(r.id);
  if (!c) {
    c = { ...DEFAULT_CONFIG, ...r.config };
    cfgCache.set(r.id, c);
  }
  return c;
}

// ---------------- 숫자 마법 카드 ----------------
export interface MagicCard {
  id: string;
  icon: string;
  name: string;
  text: string;
  /** econ: 골드·상점·돌 / battle: 전투 */
  kind: 'econ' | 'battle';
  mods?: TeamMods;
  /** 문장 카드가 돕는 가문 */
  fam?: FamilyId;
}

export const MAGIC_CARDS: MagicCard[] = [
  // 경제
  { id: 'gold', icon: '💰', name: '저금통 깨기', kind: 'econ', text: '지금 바로 5골드' },
  { id: 'xp', icon: '📚', name: '공부 습관', kind: 'econ', text: '이번 판 내내 레벨업이 4골드 → 3골드' },
  { id: 'gift', icon: '🎁', name: '친구 선물', kind: 'econ', text: '지금 바로 2골드 친구 2명을 데려와요' },
  { id: 'stones', icon: '🪨', name: '돌 주머니', kind: 'econ', text: '지금 바로 숫자 돌 3개 + 돌 한도 +3' },
  { id: 'reroll', icon: '🔄', name: '공짜 새로고침', kind: 'econ', text: '라운드마다 첫 새로고침은 공짜' },
  { id: 'piggy', icon: '🐷', name: '저금 왕', kind: 'econ', text: '지금 바로 4골드 + 저금 보너스 최대 2골드 → 4골드' },
  { id: 'mic', icon: '🎤', name: '무대 준비', kind: 'econ', text: '지금 바로 보물 합창 마이크 + 3골드' },
  // 가문 문장: 그 가문 친구 수를 1명 더 셈(1명 이상 있을 때)
  { id: 'emb_even', icon: '👯', name: '짝꿍 문장', kind: 'battle', fam: 'even', text: '짝꿍 가문 친구 수를 1명 더 세요', mods: { famBonus: { even: 1 } } },
  { id: 'emb_tri', icon: '🔺', name: '세모 문장', kind: 'battle', fam: 'tri', text: '세모 가문 친구 수를 2명 더 세요', mods: { famBonus: { tri: 2 } } },
  { id: 'emb_five', icon: '✋', name: '하이파이브 문장', kind: 'battle', fam: 'five', text: '하이파이브 가문 친구 수를 1명 더 세요', mods: { famBonus: { five: 1 } } },
  { id: 'emb_prime', icon: '💎', name: '다이아 문장', kind: 'battle', fam: 'prime', text: '다이아 가문 친구 수를 1명 더 세요', mods: { famBonus: { prime: 1 } } },
  { id: 'emb_rich', icon: '👑', name: '부자 문장', kind: 'battle', fam: 'rich', text: '부자 가문 친구 수를 2명 더 세요', mods: { famBonus: { rich: 2 } } },
  // 전투
  { id: 'baton', icon: '🎼', name: '지휘봉', kind: 'battle', text: '합창(2명 이상) 배율 +0.5배', mods: { chorusPlus: 50 } },
  { id: 'hand', icon: '🤝', name: '공약수 악수', kind: 'battle', text: '손잡기 방패 2.5배(최대공약수 × 30)', mods: { handshakePct: 250 } },
  { id: 'shield', icon: '🛡', name: '몸풀기 방패', kind: 'battle', text: '전투 시작 때 모든 친구 방패 +80', mods: { startShield: 80 } },
  { id: 'hp', icon: '❤️', name: '튼튼한 몸', kind: 'battle', text: '모든 친구 체력 +12%', mods: { hpPct: 12 } },
  { id: 'atk', icon: '⚔️', name: '힘 훈련', kind: 'battle', text: '모든 친구 기본 공격 +15%', mods: { atkPct: 15 } },
  { id: 'late', icon: '🔥', name: '뜨거운 노래', kind: 'battle', text: '24박부터 노래(피해·회복·방패) +50%', mods: { lateSongPct: 50, lateFrom: 24 } },
  { id: 'big', icon: '🦣', name: '큰 수의 힘', kind: 'battle', text: '숫자가 가장 큰 친구 체력 2배', mods: { bigHpPct: 100 } },
  { id: 'lone', icon: '🍀', name: '끝까지 버티기', kind: 'battle', text: '우리 친구가 2명 이하로 남으면 공격·노래 +80%', mods: { lastStandPct: 80, lastStandAt: 2 } },
];

export const cardById = (id: string) => MAGIC_CARDS.find((c) => c.id === id);
export const hasCard = (cards: readonly string[] | undefined, id: string) => !!cards?.includes(id);

/** 가진 카드들의 전투 효과를 합침 */
export function modsOf(cards: readonly string[] | undefined): TeamMods | undefined {
  if (!cards?.length) return undefined;
  const m: TeamMods = {};
  for (const id of cards) {
    const c = cardById(id)?.mods;
    if (!c) continue;
    if (c.famBonus) {
      m.famBonus ??= {};
      for (const [k, v] of Object.entries(c.famBonus) as [FamilyId, number][]) m.famBonus[k] = (m.famBonus[k] ?? 0) + v;
    }
    for (const k of ['chorusPlus', 'startShield', 'hpPct', 'atkPct', 'lateSongPct', 'bigHpPct', 'lastStandPct'] as const) {
      if (c[k]) m[k] = (m[k] ?? 0) + c[k]!;
    }
    if (c.lateFrom) m.lateFrom = Math.min(m.lateFrom ?? 99, c.lateFrom);
    if (c.lastStandAt) m.lastStandAt = Math.max(m.lastStandAt ?? 0, c.lastStandAt);
    if (c.handshakePct) m.handshakePct = (m.handshakePct ?? 100) + (c.handshakePct - 100);
  }
  return m;
}

/** 마법 카드를 고르는 라운드: 12라운드 판 3·6·9, 짧은 판 2·5 */
export const magicRounds = (totalRounds: number) => (totalRounds >= 12 ? [3, 6, 9] : [2, 5]);

/** 서버 검사: 있는 카드, 겹치지 않음, 그 라운드까지 고를 수 있는 수 이하 */
export function validCards(cards: unknown, round: number, totalRounds: number): cards is string[] {
  if (!Array.isArray(cards)) return false;
  const max = magicRounds(totalRounds).filter((r) => r <= round).length;
  return cards.length <= max && new Set(cards).size === cards.length && cards.every((c) => typeof c === 'string' && !!cardById(c));
}
