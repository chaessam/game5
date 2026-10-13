// 숫자체스 Cloudflare 서버 (구구팡·구구단 디펜스와 같은 방식: Workers + SQLite Durable Object, 무료 플랜)
// - 게임 화면(dist/)은 Cloudflare가 바로 제공
// - Store(Durable Object 하나): 로그인(학교 + 닉네임 + 숫자 4자리), 내 기록·도감, 튜토리얼·말풍선 진행, 친구 유령 보드
// 1단계(혼자 하기)는 게임 계산을 모두 브라우저에서 하고, 서버는 저장만 합니다.
// 2단계(실시간 2~4인 방 목록)는 Lobby·Room Durable Object를 더할 예정입니다.
import { DurableObject } from 'cloudflare:workers';
import { normalizeNick, normalizeSchoolCode, identityError, pinOk } from '../src/shared/identity';
import { SCHOOLS_PATH, indexSchools, type SchoolIndex } from '../src/shared/schools';
import { UNITS } from '../src/engine/data';
import { applyStones } from '../src/engine/math';
import type { StoneOp } from '../src/engine/types';

interface Env {
  ASSETS: Fetcher;
  STORE: DurableObjectNamespace<Store>;
}

const DAY_MS = 24 * 3600 * 1000;

// ---- 로그인 (구구팡과 같은 규칙) ----
const PBKDF2_ITER = 60000;
const MAX_FAILS = 10; // 이만큼 틀리면
const LOCK_MS = 10 * 60 * 1000; // 10분 잠금
const SESSION_DAYS = 365; // 같은 기기 자동 로그인 기간
const SESSIONS_PER_ACCOUNT = 10; // 계정마다 기억하는 기기 수
const SESSION_TOUCH_MS = 30 * DAY_MS; // 마지막 사용 시각은 30일에 한 번만 고쳐 씀(쓰기 아끼기)
// 운영자(선생님) 계정: 전남광주 광산구 송우초등학교 채쌤
const ADMINS: [string, string][] = [['7402200', '채쌤']];
const isAdmin = (school: string, nick: string) => ADMINS.some(([s, n]) => s === school && n === nick);

// ---- 유령 ----
const GHOSTS_PER_SCHOOL = 40; // 학교마다 최근 보드 기록 몇 판만 둠
const MAX_GHOST_BYTES = 12000;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer);
async function sha256(text: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const bearer = (request: Request) => {
  const h = request.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

let schoolIndex: SchoolIndex | null = null;
async function loadSchools(env: Env): Promise<SchoolIndex> {
  if (schoolIndex) return schoolIndex;
  try {
    const res = await env.ASSETS.fetch(`https://assets.local${SCHOOLS_PATH}`);
    schoolIndex = indexSchools(await res.json());
  } catch {
    return indexSchools(null);
  }
  return schoolIndex;
}

const storeOf = (env: Env) => env.STORE.get(env.STORE.idFromName('main'));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      try {
        return await storeOf(env).fetch(request);
      } catch (e) {
        // 무료 플랜 하루 한도가 다 찼거나 서버 문제: 혼자 하기는 계속 할 수 있음
        const quota = /exceeded|free tier|limit/i.test(String((e as Error)?.message ?? e));
        return json({ ok: false, code: quota ? 'server_quota' : 'server_down', error: '온라인 저장을 지금 쓸 수 없어요. 게임은 계속 할 수 있어요.' }, 503);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

// ---------------- 보드 검사(유령) ----------------
const STONES = ['+1', '-1', 'x2', '/2', 'x3', '/3'];
const ITEMS = [...STONES, 'mic', 'glove', 'bag'];
interface GhostUnit { char: number; star: number; row: number; col: number; items?: string[] }
function validBoard(b: unknown): b is GhostUnit[] {
  if (!Array.isArray(b) || b.length > 8) return false;
  const seen = new Set<string>();
  for (const u of b as GhostUnit[]) {
    if (!u || !UNITS[u.char] || ![1, 2, 3].includes(u.star) || ![0, 1].includes(u.row) || !(u.col >= 0 && u.col <= 4)) return false;
    const k = `${u.row},${u.col}`;
    if (seen.has(k)) return false;
    seen.add(k);
    const items = u.items ?? [];
    if (!Array.isArray(items) || items.length > 2 || !items.every((i) => ITEMS.includes(i))) return false;
    if (!applyStones(u.char, items.filter((i) => STONES.includes(i)) as StoneOp[]).ok) return false;
  }
  return true;
}

// ---------------- 저장소 ----------------
type Account = { school: string; nick: string; pin_hash: string; salt: string; fails: number; locked_until: number; last: number };

export class Store extends DurableObject<Env> {
  sql: SqlStorage;
  limits = new Map<string, { w: number; ms: number; n: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        school TEXT NOT NULL, nick TEXT NOT NULL, pin_hash TEXT NOT NULL, salt TEXT NOT NULL,
        fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (school, nick)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, school TEXT NOT NULL, nick TEXT NOT NULL, created INTEGER, last INTEGER
      );
      CREATE INDEX IF NOT EXISTS sessions_account ON sessions (school, nick, last DESC);
      CREATE TABLE IF NOT EXISTS records (
        school TEXT NOT NULL, nick TEXT NOT NULL,
        games INTEGER NOT NULL DEFAULT 0, firsts INTEGER NOT NULL DEFAULT 0,
        medals INTEGER NOT NULL DEFAULT 0, best_medals INTEGER NOT NULL DEFAULT 0,
        best_chorus TEXT NOT NULL DEFAULT '', collection TEXT NOT NULL DEFAULT '{}',
        tutorial INTEGER NOT NULL DEFAULT 0, tips TEXT NOT NULL DEFAULT '',
        updated INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (school, nick)
      );
      CREATE TABLE IF NOT EXISTS ghosts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, school TEXT NOT NULL, nick TEXT NOT NULL,
        created INTEGER NOT NULL, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ghosts_school ON ghosts (school, created DESC);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = bearer(request);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        /* 빈 요청 */
      }
    }
    switch (`${request.method} ${url.pathname}`) {
      case 'POST /api/login': {
        const r = await this.login(body, ip);
        return json(r, r.ok ? 200 : (r.status as number) || 400);
      }
      case 'POST /api/logout':
        return json(await this.logout(token));
      case 'GET /api/me':
        return json(await this.me(token));
      case 'POST /api/progress':
        return json(await this.progress(token, body));
      case 'POST /api/record':
        return json(await this.record(token, body));
      case 'POST /api/ghost':
        return json(await this.saveGhost(token, body));
      case 'GET /api/ghosts':
        return json(await this.ghosts(token, Number(url.searchParams.get('n') || 3)));
      default:
        return json({ ok: false, error: 'not found' }, 404);
    }
  }

  // IP는 해시로 바꿔 서버 메모리에서만 셈(데이터베이스에 쓰지 않음)
  async limited(ip: string, kind: string, max: number, windowMs: number) {
    const key = `${kind}:${(await sha256(`numberchess-limit:${ip}`)).slice(0, 32)}`;
    const w = Math.floor(Date.now() / windowMs);
    if (this.limits.size > 5000) {
      for (const [k, v] of this.limits) if (v.w !== Math.floor(Date.now() / v.ms)) this.limits.delete(k);
    }
    let v = this.limits.get(key);
    if (!v || v.w !== w) {
      v = { w, ms: windowMs, n: 0 };
      this.limits.set(key, v);
    }
    v.n++;
    return v.n > max;
  }

  async newSession(school: string, nick: string) {
    const token = randomHex(32);
    const now = Date.now();
    this.sql.exec('INSERT INTO sessions (token_hash, school, nick, created, last) VALUES (?, ?, ?, ?, ?)', await sha256(token), school, nick, now, now);
    this.sql.exec(
      `DELETE FROM sessions WHERE school = ? AND nick = ? AND token_hash NOT IN
        (SELECT token_hash FROM sessions WHERE school = ? AND nick = ? ORDER BY last DESC LIMIT ${SESSIONS_PER_ACCOUNT})`,
      school, nick, school, nick,
    );
    return token;
  }

  async accountOf(token: string): Promise<{ school: string; nick: string } | null> {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const th = await sha256(token);
    const s = this.sql.exec<{ school: string; nick: string; last: number }>('SELECT school, nick, last FROM sessions WHERE token_hash = ?', th).toArray()[0];
    if (!s || Date.now() - s.last > SESSION_DAYS * DAY_MS) return null;
    if (Date.now() - s.last > SESSION_TOUCH_MS) this.sql.exec('UPDATE sessions SET last = ? WHERE token_hash = ?', Date.now(), th);
    return { school: s.school, nick: s.nick };
  }

  /** body: { schoolCode, nick, pin, create }. 계정이 없으면 { code: 'no_account' } — 화면에서 확인 후 create: true로 다시 */
  async login(body: Record<string, unknown>, ip: string): Promise<Record<string, unknown>> {
    if (await this.limited(ip, 'login', 600, 3600 * 1000)) return { ok: false, status: 429, error: '잠시 후 다시 해 주세요.' };
    const schoolCode = normalizeSchoolCode(body.schoolCode);
    const nick = normalizeNick(body.nick);
    const err = identityError({ schoolCode, nick });
    if (err) return { ok: false, error: err };
    const school = (await loadSchools(this.env)).byCode.get(schoolCode);
    if (!school) return { ok: false, error: '학교를 검색해서 다시 골라 주세요.' };
    const pin = String(body.pin ?? '');
    if (!pinOk(pin)) return { ok: false, error: '비밀번호는 숫자 4자리로 적어 주세요.', code: 'bad_pin' };
    const now = Date.now();
    const a = this.sql.exec<Account>('SELECT * FROM accounts WHERE school = ? AND nick = ?', school.code, nick).toArray()[0];
    if (!a) {
      if (!body.create) return { ok: false, status: 200, code: 'no_account' };
      if (await this.limited(ip, 'register', 300, DAY_MS)) return { ok: false, status: 429, error: '오늘 이 곳에서 만든 계정이 너무 많아요. 내일 다시 해 주세요.' };
      const salt = randomHex(16);
      this.sql.exec('INSERT INTO accounts (school, nick, pin_hash, salt, created, last) VALUES (?, ?, ?, ?, ?, ?)', school.code, nick, await hashPin(pin, salt), salt, now, now);
      return { ok: true, token: await this.newSession(school.code, nick), school: school.code, nick, created: true, teacher: isAdmin(school.code, nick) };
    }
    if (a.locked_until > now) {
      const min = Math.ceil((a.locked_until - now) / 60000);
      return { ok: false, status: 423, code: 'locked', error: `비밀번호를 ${MAX_FAILS}번 틀려서 잠겼어요. ${min}분 뒤에 다시 해 주세요.` };
    }
    if (!sameText(await hashPin(pin, a.salt), a.pin_hash)) {
      const fails = a.fails + 1;
      if (fails >= MAX_FAILS) {
        this.sql.exec('UPDATE accounts SET fails = 0, locked_until = ? WHERE school = ? AND nick = ?', now + LOCK_MS, school.code, nick);
        return { ok: false, status: 423, code: 'locked', error: `비밀번호를 ${MAX_FAILS}번 틀려서 10분 동안 잠겼어요.` };
      }
      this.sql.exec('UPDATE accounts SET fails = ? WHERE school = ? AND nick = ?', fails, school.code, nick);
      return { ok: false, status: 401, code: 'wrong_pin', error: `비밀번호가 틀렸어요. (남은 기회 ${MAX_FAILS - fails}번)` };
    }
    if (a.fails || a.locked_until || now - a.last > SESSION_TOUCH_MS) {
      this.sql.exec('UPDATE accounts SET fails = 0, locked_until = 0, last = ? WHERE school = ? AND nick = ?', now, school.code, nick);
    }
    return { ok: true, token: await this.newSession(school.code, nick), school: school.code, nick, teacher: isAdmin(school.code, nick) };
  }

  async logout(token: string) {
    if (token && /^[0-9a-f]{64}$/.test(token)) this.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(token));
    return { ok: true };
  }

  recordOf(school: string, nick: string) {
    const r = this.sql.exec<Record<string, string | number>>('SELECT * FROM records WHERE school = ? AND nick = ?', school, nick).toArray()[0];
    if (!r) return { games: 0, firsts: 0, medals: 0, bestMedals: 0, bestChorus: null, collection: {}, tutorial: false, tips: [] as string[] };
    const parse = (s: unknown, d: unknown) => {
      try {
        return s ? JSON.parse(String(s)) : d;
      } catch {
        return d;
      }
    };
    return {
      games: r.games, firsts: r.firsts, medals: r.medals, bestMedals: r.best_medals,
      bestChorus: parse(r.best_chorus, null), collection: parse(r.collection, {}), tutorial: !!r.tutorial,
      tips: String(r.tips || '').split(',').filter(Boolean),
    };
  }

  ensureRecord(school: string, nick: string) {
    this.sql.exec('INSERT INTO records (school, nick, updated) VALUES (?, ?, ?) ON CONFLICT (school, nick) DO NOTHING', school, nick, Date.now());
  }

  async me(token: string) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    return { ok: true, school: who.school, nick: who.nick, teacher: isAdmin(who.school, who.nick), record: this.recordOf(who.school, who.nick) };
  }

  /** 튜토리얼 끝, 본 말풍선(쉼표로 잇기) */
  async progress(token: string, body: Record<string, unknown>) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    this.ensureRecord(who.school, who.nick);
    const cur = this.recordOf(who.school, who.nick);
    const tips = new Set(cur.tips);
    for (const t of Array.isArray(body.tips) ? body.tips : []) if (/^[a-z0-9_]{1,24}$/.test(String(t))) tips.add(String(t));
    const tutorial = cur.tutorial || !!body.tutorialDone;
    this.sql.exec('UPDATE records SET tutorial = ?, tips = ?, updated = ? WHERE school = ? AND nick = ?', tutorial ? 1 : 0, [...tips].slice(0, 60).join(','), Date.now(), who.school, who.nick);
    return { ok: true };
  }

  /** 한 판 기록: { rank, players, medals, bestChorus: {beat, nums, count}, collection: { met, three, morphs } } */
  async record(token: string, body: Record<string, unknown>) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    const rank = Number(body.rank);
    const medals = Math.max(0, Math.min(200, Number(body.medals) || 0));
    if (!(rank >= 1 && rank <= 4)) return { ok: false, error: '기록이 이상해요.' };
    this.ensureRecord(who.school, who.nick);
    const cur = this.recordOf(who.school, who.nick);
    // 도감: 만난 친구, 3성, 변신해 본 숫자(캐릭터→숫자)
    const col = cur.collection as { met?: number[]; three?: number[]; morphs?: string[] };
    const inc = (body.collection ?? {}) as { met?: unknown[]; three?: unknown[]; morphs?: unknown[] };
    const nums = (a: unknown[] | undefined) => (a ?? []).map(Number).filter((n) => UNITS[n]);
    const merged = {
      met: [...new Set([...(col.met ?? []), ...nums(inc.met)])].sort((a, b) => a - b),
      three: [...new Set([...(col.three ?? []), ...nums(inc.three)])].sort((a, b) => a - b),
      morphs: [...new Set([...(col.morphs ?? []), ...(inc.morphs ?? []).map(String).filter((m) => /^\d{1,2}>\d{1,2}$/.test(m))])].slice(0, 300),
    };
    let best = cur.bestChorus as { count: number } | null;
    const bc = body.bestChorus as { beat?: number; nums?: number[]; count?: number } | undefined;
    if (bc && Number(bc.count) >= 2 && (!best || Number(bc.count) > best.count)) {
      best = { beat: Number(bc.beat), nums: (bc.nums ?? []).map(Number).slice(0, 8), count: Number(bc.count) } as { count: number };
    }
    this.sql.exec(
      `UPDATE records SET games = games + 1, firsts = firsts + ?, medals = medals + ?, best_medals = MAX(best_medals, ?),
        best_chorus = ?, collection = ?, updated = ? WHERE school = ? AND nick = ?`,
      rank === 1 ? 1 : 0, medals, medals, best ? JSON.stringify(best) : '', JSON.stringify(merged), Date.now(), who.school, who.nick,
    );
    return { ok: true, record: this.recordOf(who.school, who.nick) };
  }

  /** 친구 유령: 한 판의 라운드별 보드(최대 12라운드) */
  async saveGhost(token: string, body: Record<string, unknown>) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    const rounds = body.rounds;
    if (!Array.isArray(rounds) || !rounds.length || rounds.length > 12 || !rounds.every(validBoard)) return { ok: false, error: '보드 기록이 이상해요.' };
    const data = JSON.stringify({ rounds, level: Number(body.level) || 0 });
    if (data.length > MAX_GHOST_BYTES) return { ok: false, error: '기록이 너무 커요.' };
    this.sql.exec('INSERT INTO ghosts (school, nick, created, data) VALUES (?, ?, ?, ?)', who.school, who.nick, Date.now(), data);
    this.sql.exec(
      `DELETE FROM ghosts WHERE school = ? AND id NOT IN (SELECT id FROM ghosts WHERE school = ? ORDER BY created DESC LIMIT ${GHOSTS_PER_SCHOOL})`,
      who.school, who.school,
    );
    return { ok: true };
  }

  /** 같은 학교 친구 유령 n명(나 빼고, 사람마다 최근 한 판) */
  async ghosts(token: string, n: number) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    const rows = this.sql.exec<{ nick: string; data: string }>(
      `SELECT nick, data FROM ghosts WHERE school = ? AND nick != ? ORDER BY created DESC LIMIT ${GHOSTS_PER_SCHOOL}`,
      who.school, who.nick,
    ).toArray();
    const byNick = new Map<string, { nick: string; rounds: unknown[] }>();
    for (const r of rows) if (!byNick.has(r.nick)) byNick.set(r.nick, { nick: r.nick, rounds: JSON.parse(r.data).rounds });
    const list = [...byNick.values()];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return { ok: true, ghosts: list.slice(0, Math.max(1, Math.min(3, n))) };
  }
}

