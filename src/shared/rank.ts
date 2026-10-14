// 랭크(온라인 대결): 등수대로 점수를 얻고 잃는다. 브론즈부터 챌린저까지 9티어.
// 서버(점수 계산)와 화면(티어 표시)이 같이 쓴다.

export interface Tier {
  id: string;
  name: string;
  /** 이 티어가 시작하는 점수 */
  min: number;
  color: string;
  icon: string;
}

/** 300점마다 한 티어. 마스터 아래는 100점마다 단계(3 → 2 → 1) */
export const TIERS: Tier[] = [
  { id: 'bronze', name: '브론즈', min: 0, color: '#c98b5a', icon: '🥉' },
  { id: 'silver', name: '실버', min: 300, color: '#c9d3e0', icon: '🥈' },
  { id: 'gold', name: '골드', min: 600, color: '#ffd24a', icon: '🥇' },
  { id: 'platinum', name: '플래티넘', min: 900, color: '#5fe0c8', icon: '💠' },
  { id: 'emerald', name: '에메랄드', min: 1200, color: '#3ee07f', icon: '🟢' },
  { id: 'diamond', name: '다이아몬드', min: 1500, color: '#7fb8ff', icon: '💎' },
  { id: 'master', name: '마스터', min: 1800, color: '#c88bff', icon: '🔮' },
  { id: 'grandmaster', name: '그랜드마스터', min: 2100, color: '#ff6b81', icon: '🔥' },
  { id: 'challenger', name: '챌린저', min: 2400, color: '#ffe27a', icon: '👑' },
];
const DIVISION_FROM = TIERS.findIndex((t) => t.id === 'master');

/**
 * 사람 수별 등수 점수(1등부터). 혼자 남은 판(1명)은 점수 없음.
 * 학생들은 판을 많이 못 하니까 후하게: 2명 판에서 반만 이겨도(평균 +30) 10판이면 한 티어(300점).
 * 사람이 많을수록 조금 더 빨리(3명 평균 +33, 4명 평균 +35). 꼴등만 조금 잃음.
 */
export const PLACE_POINTS: Record<number, number[]> = {
  2: [70, -10],
  3: [75, 35, -10],
  4: [80, 50, 20, -10],
};

export interface TierInfo extends Tier {
  index: number;
  /** 마스터 아래는 3·2·1 단계, 위는 0 */
  div: number;
  /** '골드 2', '마스터' */
  label: string;
  /** 다음 단계(또는 티어)까지 남은 점수, 챌린저면 0 */
  toNext: number;
}

export function rankTier(points: number): TierInfo {
  const p = Math.max(0, Math.floor(points || 0));
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) if (p >= TIERS[i].min) index = i;
  const t = TIERS[index];
  const div = index < DIVISION_FROM ? 3 - Math.min(2, Math.floor((p - t.min) / 100)) : 0;
  const nextAt = index < DIVISION_FROM ? t.min + (4 - div) * 100 : (TIERS[index + 1]?.min ?? p);
  return { ...t, index, div, label: div ? `${t.name} ${div}` : t.name, toNext: Math.max(0, nextAt - p) };
}

/** 이번 판 점수 변화: 브론즈에서는 잃는 점수를 절반만(처음 하는 친구 배려), 0점 아래로는 안 내려감 */
export function rankDelta(place: number, players: number, points: number): number {
  const table = PLACE_POINTS[players];
  if (!table) return 0;
  let d = table[Math.max(0, Math.min(table.length - 1, place - 1))];
  if (d < 0 && rankTier(points).id === 'bronze') d = -Math.floor(-d / 2);
  return Math.max(-points, d) || 0; // -0 대신 0
}

/** 화면 안내용 한 줄: '1등 +30 · 2등 +15 · 3등 −10 · 4등 −20' */
export const placePointsText = (players: number) =>
  (PLACE_POINTS[players] ?? []).map((d, i) => `${i + 1}등 ${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`).join(' · ');
