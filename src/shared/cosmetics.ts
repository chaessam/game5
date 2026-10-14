// 3단계 '리그 꾸미기': 칭호(업적·티어)와 판 테마(티어). 게임 힘에는 영향 없음 — 보이는 것만.
// 서버(고른 것 검사)와 화면이 같이 쓴다.
import { TIERS } from './rank';

/** 칭호·테마를 여는 데 쓰는 내 기록 */
export interface Profile {
  games: number;
  firsts: number;
  ranked: number;
  bestPoints: number;
  tutorial: boolean;
  bestChorus: number;
  met: number;
  three: number;
  morphs: number;
}

export interface Title {
  id: string;
  name: string;
  /** 여는 방법(아이들에게 보이는 글) */
  how: string;
  ok: (p: Profile) => boolean;
}

const tierAt = (id: string) => TIERS.find((t) => t.id === id)!.min;

export const TITLES: Title[] = [
  { id: 'newbie', name: '합창단 새 단원', how: '튜토리얼 마치기', ok: (p) => p.tutorial },
  { id: 'first', name: '첫 1등', how: '아무 판에서나 1등 하기', ok: (p) => p.firsts >= 1 },
  { id: 'steady', name: '꾸준한 지휘자', how: '10판 하기', ok: (p) => p.games >= 10 },
  { id: 'fifty', name: '숫자체스 장인', how: '50판 하기', ok: (p) => p.games >= 50 },
  { id: 'chorus4', name: '4중창 지휘자', how: '한 박에 4명 몫 합창 만들기', ok: (p) => p.bestChorus >= 4 },
  { id: 'chorus5', name: '대합창 지휘자', how: '한 박에 5명 몫 이상 합창 만들기', ok: (p) => p.bestChorus >= 5 },
  { id: 'three', name: '3성 장인', how: '3성 친구 만들기', ok: (p) => p.three >= 1 },
  { id: 'collector', name: '숫자 수집가', how: '도감에서 친구 20명 만나기', ok: (p) => p.met >= 20 },
  { id: 'allmet', name: '도감 완성', how: '25명 모두 만나기', ok: (p) => p.met >= 25 },
  { id: 'morph', name: '변신 마법사', how: '숫자 돌로 10가지 변신 해 보기', ok: (p) => p.morphs >= 10 },
  { id: 'ranked', name: '온라인 도전자', how: '온라인 대결 5판', ok: (p) => p.ranked >= 5 },
  ...TIERS.slice(1).map((t) => ({ id: `tier_${t.id}`, name: `${t.icon} ${t.name} 합창단`, how: `${t.name} 티어 가 보기(${t.min}점)`, ok: (p: Profile) => p.bestPoints >= t.min })),
];

export interface Theme {
  id: string;
  name: string;
  /** 여는 티어(최고 점수 기준) */
  tier: string;
  /** 배경 위·아래, 칸 색 */
  bg: [string, string];
  cell: [string, string];
}

export const THEMES: Theme[] = [
  { id: 'basic', name: '보라 무대', tier: 'bronze', bg: ['#150f43', '#24135c'], cell: ['rgba(130,110,255,.12)', 'rgba(70,45,170,.25)'] },
  { id: 'sea', name: '푸른 바다', tier: 'silver', bg: ['#071d3a', '#0b3a5c'], cell: ['rgba(80,180,255,.14)', 'rgba(20,90,160,.3)'] },
  { id: 'forest', name: '초록 숲', tier: 'gold', bg: ['#0c2618', '#174a2a'], cell: ['rgba(90,220,140,.13)', 'rgba(30,110,60,.3)'] },
  { id: 'desert', name: '사막 노을', tier: 'platinum', bg: ['#3a1608', '#6b2e10'], cell: ['rgba(255,170,90,.14)', 'rgba(150,70,20,.3)'] },
  { id: 'garden', name: '꽃 정원', tier: 'emerald', bg: ['#2b0f2e', '#4d1d4a'], cell: ['rgba(255,140,200,.14)', 'rgba(150,50,120,.3)'] },
  { id: 'night', name: '별밤', tier: 'diamond', bg: ['#020617', '#0f1b4d'], cell: ['rgba(150,190,255,.12)', 'rgba(40,60,140,.3)'] },
  { id: 'aurora', name: '오로라', tier: 'master', bg: ['#04131f', '#123a3a'], cell: ['rgba(120,255,220,.13)', 'rgba(140,90,255,.25)'] },
  { id: 'volcano', name: '화산', tier: 'grandmaster', bg: ['#1a0303', '#4a0a0a'], cell: ['rgba(255,110,80,.15)', 'rgba(140,20,20,.32)'] },
  { id: 'golden', name: '황금 무대', tier: 'challenger', bg: ['#2a1c00', '#5a3c00'], cell: ['rgba(255,220,100,.16)', 'rgba(170,120,10,.3)'] },
];

export const titleById = (id?: string | null) => TITLES.find((t) => t.id === id);
export const themeById = (id?: string | null) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const unlockedTitles = (p: Profile) => TITLES.filter((t) => t.ok(p)).map((t) => t.id);
export const themeUnlocked = (p: Profile, id: string) => {
  const th = THEMES.find((t) => t.id === id);
  return !!th && p.bestPoints >= tierAt(th.tier);
};
/** 칭호 이름(이름 옆에 붙임) */
export const titleName = (id?: string | null) => titleById(id)?.name ?? '';
