// 서버(Cloudflare Worker /api)와 이야기하기. 서버가 없거나(내 컴퓨터 vite) 한도가 차도 게임은 그대로 된다.
import type { BoardUnit } from '../engine/types';

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
  const r = await call<{ token: string; school: string; nick: string; created?: boolean; teacher?: boolean }>('POST', 'login', { schoolCode, nick, pin, create });
  if (r.ok) setAuth({ token: r.token, school: r.school, schoolName, nick: r.nick, teacher: r.teacher });
  return r;
}

export async function logout() {
  if (auth) await call('POST', 'logout');
  setAuth(null);
}

export const me = () => call<{ school: string; nick: string; teacher: boolean; record: MyRecord }>('GET', 'me');
export const saveProgress = (p: { tutorialDone?: boolean; tips?: string[] }) => (auth ? call('POST', 'progress', p) : Promise.resolve({ ok: false } as const));
export const saveRecord = (r: {
  rank: number;
  players: number;
  medals: number;
  bestChorus: { beat: number; nums: number[]; count: number } | null;
  collection: { met: number[]; three: number[]; morphs: string[] };
}) => (auth ? call<{ record: MyRecord }>('POST', 'record', r) : Promise.resolve({ ok: false } as const));
export const saveGhost = (rounds: BoardUnit[][], level: number) => (auth ? call('POST', 'ghost', { rounds, level }) : Promise.resolve({ ok: false } as const));
export const fetchGhosts = (n: number) => call<{ ghosts: { nick: string; rounds: BoardUnit[][] }[] }>('GET', `ghosts?n=${n}`);
