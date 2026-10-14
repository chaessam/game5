// 서버(Cloudflare Worker /api)와 이야기하기. 서버가 없거나(내 컴퓨터 vite) 한도가 차도 게임은 그대로 된다.
import type { BoardUnit } from '../engine/types';
import type { LobbyRoom, RankRow } from '../shared/online';

export interface Auth {
  token: string;
  school: string;
  schoolName: string;
  nick: string;
  teacher?: boolean;
}

export interface MyRecord {
  games: number;
  firsts: number;
  medals: number;
  bestMedals: number;
  bestChorus: { beat: number; nums: number[]; count: number } | null;
  collection: { met?: number[]; three?: number[]; morphs?: string[] };
  tutorial: boolean;
  tips: string[];
  /** 랭크 점수 · 랭크 판 수 */
  points: number;
  ranked: number;
}

const KEY = 'nc-auth';
let auth: Auth | null = null;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) auth = JSON.parse(raw) as Auth;
} catch {
  auth = null;
}

export const getAuth = () => auth;
function setAuth(a: Auth | null) {
  auth = a;
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장 못 해도 이번 접속 동안은 됨 */
  }
}

type Res<T> = ({ ok: true } & T) | { ok: false; error?: string; code?: string; offline?: boolean };

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Res<T>> {
  try {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return { ok: false, offline: true, error: '온라인 저장 서버가 없어요(혼자 하기는 돼요).' };
    const data = (await res.json()) as Res<T>;
    if (!data.ok && data.code === 'no_session') setAuth(null);
    return data;
  } catch {
    return { ok: false, offline: true, error: '서버에 연결할 수 없어요.' };
  }
}

export async function login(schoolCode: string, schoolName: string, nick: string, pin: string, create = false) {
  const r = await call<{ token: string; school: string; nick: string; created?: boolean; teacher?: boolean; record: MyRecord }>('POST', 'login', { schoolCode, nick, pin, create });
  if (r.ok) setAuth({ token: r.token, school: r.school, schoolName, nick: r.nick, teacher: r.teacher });
  return r;
}

export async function logout() {
  if (auth) await call('POST', 'logout');
  setAuth(null);
}

export const me = () => call<{ school: string; nick: string; teacher: boolean; record: MyRecord }>('GET', 'me');
// 서버 요청은 무료 한도를 아끼려고 꼭 필요할 때만: 페이지를 열 때 내 기록 1번, 들어갈 때 1번,
// 판이 끝날 때 1번(기록 + 본 말풍선 + 친구 유령을 한꺼번에), 튜토리얼을 마칠 때 1번.
export const saveProgress = (p: { tutorialDone?: boolean; tips?: string[] }) =>
  auth ? call<{ record: MyRecord }>('POST', 'progress', p) : Promise.resolve({ ok: false } as const);
export const saveRecord = (r: {
  rank: number;
  players: number;
  medals: number;
  bestChorus: { beat: number; nums: number[]; count: number } | null;
  collection: { met: number[]; three: number[]; morphs: string[] };
  tips: string[];
  ghost: { rounds: BoardUnit[][]; level: number } | null;
}) => (auth ? call<{ record: MyRecord }>('POST', 'record', r) : Promise.resolve({ ok: false } as const));
export const fetchGhosts = (n: number) => call<{ ghosts: { nick: string; rounds: BoardUnit[][] }[] }>('GET', `ghosts?n=${n}`);

// ---- 온라인 대결(랭크) ----
// 방 목록은 방 고르는 화면이 열려 있을 때만 몇 초마다 1번, 게임 중에는 WebSocket 하나(라운드마다 보드 1번)
export const listRooms = () => call<{ rooms: LobbyRoom[] }>('GET', 'rooms');
export const createRoom = (short: boolean, kind: 'room' | 'class' = 'room') => call<{ id: string }>('POST', 'rooms', { short, size: 4, kind });
export const fetchRanking = (scope: 'school' | 'all') => call<{ rows: RankRow[] }>('GET', `ranking?scope=${scope}`);
export const roomSocketUrl = (id: string) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/room/${id}/ws?t=${encodeURIComponent(auth?.token ?? '')}`;
