// 숫자체스 Cloudflare 서버 (구구팡·구구단 디펜스와 같은 방식: Workers + SQLite Durable Object, 무료 플랜)
// - 게임 화면(dist/)은 Cloudflare가 바로 제공
// - Store(Durable Object 하나): 로그인(학교 + 닉네임 + 숫자 4자리), 내 기록·도감, 튜토리얼·말풍선 진행, 친구 유령 보드
// 1단계(혼자 하기)는 게임 계산을 모두 브라우저에서 하고, 서버는 저장만 합니다.
// 2단계 온라인 대결(랭크): 방 목록은 Store, 방마다 Room(Durable Object, WebSocket 잠자기)이 라운드 결과를 정함.
import { DurableObject } from 'cloudflare:workers';
import { normalizeNick, normalizeSchoolCode, identityError, pinOk } from '../src/shared/identity';
import { SCHOOLS_PATH, indexSchools, shortSchool, type SchoolIndex } from '../src/shared/schools';
import { UNITS } from '../src/engine/data';
import { validBoard } from '../src/shared/board';
import { rankDelta } from '../src/shared/rank';
import { ONLINE, ROOM_ID, type LobbyRoom, type RankRow, type RoomKind } from '../src/shared/online';
import type { Env, Who } from './env';
export { Room } from './room';

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
    const url = new URL(request.url);
    const { pathname } = url;
    const roomWs = pathname.match(/^\/api\/room\/([A-Z2-9]{5})\/ws$/);
    if (roomWs) {
      // 방 연결: 비밀번호 대신 들어가기 표(token)로 누군지 확인한 뒤 방에 넘김(방은 표를 모름)
      if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'websocket only' }, 426);
      try {
        const who = await storeOf(env).whoIs(url.searchParams.get('t') || '');
        if (!who) return json({ ok: false, code: 'no_session', error: '먼저 들어가기를 해 주세요.' }, 401);
        const headers = new Headers(request.headers);
        headers.set('x-who', encodeURIComponent(JSON.stringify(who))); // 한글 닉네임: 헤더는 ASCII만 안전
        headers.set('x-room', roomWs[1]);
        return await env.ROOM.get(env.ROOM.idFromName(roomWs[1])).fetch(new Request(request, { headers }));
      } catch {
        return json({ ok: false, code: 'server_down', error: '온라인 대결 서버를 지금 쓸 수 없어요.' }, 503);
      }
    }
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

// ---------------- 저장소 ----------------
interface MyRecord {
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
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, short INTEGER NOT NULL, size INTEGER NOT NULL,
        n INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL
      );
    `);
    // 방 종류(보통 방·선생님 반 대기실·모둠 방), 학교, 모둠 친구 칸(예전 표에 없으면 더함)
    const roomCols = this.sql.exec<{ name: string }>('PRAGMA table_info(rooms)').toArray().map((c) => c.name);
    if (!roomCols.includes('kind')) {
      this.sql.exec(`
        ALTER TABLE rooms ADD COLUMN kind TEXT NOT NULL DEFAULT 'room';
        ALTER TABLE rooms ADD COLUMN school TEXT NOT NULL DEFAULT '';
        ALTER TABLE rooms ADD COLUMN members TEXT NOT NULL DEFAULT '';
      `);
    }
    // 랭크 점수 칸(예전 표에 없으면 더함)
    const cols = this.sql.exec<{ name: string }>('PRAGMA table_info(records)').toArray().map((c) => c.name);
    if (!cols.includes('points')) {
      this.sql.exec(`
        ALTER TABLE records ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE records ADD COLUMN ranked INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE records ADD COLUMN rank_firsts INTEGER NOT NULL DEFAULT 0;
      `);
    }
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS records_points ON records (points DESC);
      CREATE INDEX IF NOT EXISTS records_school_points ON records (school, points DESC);
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
      case 'GET /api/rooms':
        return json(await this.listRooms(token));
      case 'POST /api/rooms':
        return json(await this.createRoom(token, body, ip));
      case 'GET /api/ranking':
        return json(await this.ranking(token, url.searchParams.get('scope') === 'school' ? 'school' : 'all'));
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
      return { ok: true, token: await this.newSession(school.code, nick), school: school.code, nick, created: true, teacher: isAdmin(school.code, nick), record: this.readRecord(school.code, nick) };
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
    return { ok: true, token: await this.newSession(school.code, nick), school: school.code, nick, teacher: isAdmin(school.code, nick), record: this.readRecord(school.code, nick) };
  }

  async logout(token: string) {
    if (token && /^[0-9a-f]{64}$/.test(token)) this.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(token));
    return { ok: true };
  }

  // ---- 내 기록: 한 사람 한 줄. 읽기 1줄 + 쓰기 1줄(UPSERT)로 끝내 무료 한도를 아낀다 ----
  readRecord(school: string, nick: string): MyRecord {
    const r = this.sql.exec<Record<string, string | number>>('SELECT * FROM records WHERE school = ? AND nick = ?', school, nick).toArray()[0];
    const empty: MyRecord = { games: 0, firsts: 0, medals: 0, bestMedals: 0, bestChorus: null, collection: {}, tutorial: false, tips: [], points: 0, ranked: 0 };
    if (!r) return empty;
    const parse = <T>(v: unknown, d: T): T => {
      try {
        return v ? (JSON.parse(String(v)) as T) : d;
      } catch {
        return d;
      }
    };
    return {
      games: Number(r.games), firsts: Number(r.firsts), medals: Number(r.medals), bestMedals: Number(r.best_medals),
      bestChorus: parse(r.best_chorus, null), collection: parse(r.collection, {}), tutorial: !!r.tutorial,
      tips: String(r.tips || '').split(',').filter(Boolean),
      points: Number(r.points) || 0, ranked: Number(r.ranked) || 0,
    };
  }

  writeRecord(school: string, nick: string, r: MyRecord) {
    this.sql.exec(
      `INSERT INTO records (school, nick, games, firsts, medals, best_medals, best_chorus, collection, tutorial, tips, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (school, nick) DO UPDATE SET games = excluded.games, firsts = excluded.firsts, medals = excluded.medals,
         best_medals = excluded.best_medals, best_chorus = excluded.best_chorus, collection = excluded.collection,
         tutorial = excluded.tutorial, tips = excluded.tips, updated = excluded.updated`,
      school, nick, r.games, r.firsts, r.medals, r.bestMedals, r.bestChorus ? JSON.stringify(r.bestChorus) : '',
      JSON.stringify(r.collection), r.tutorial ? 1 : 0, r.tips.slice(0, 60).join(','), Date.now(),
    );
  }

  /** 본 말풍선·튜토리얼 끝을 기록에 합친다(바뀐 게 있을 때만 true) */
  mergeProgress(r: MyRecord, body: Record<string, unknown>): boolean {
    const before = r.tips.length;
    const tips = new Set(r.tips);
    for (const t of Array.isArray(body.tips) ? body.tips.slice(0, 30) : []) if (/^[a-z0-9_]{1,24}$/.test(String(t))) tips.add(String(t));
    r.tips = [...tips];
    const tut = r.tutorial || !!body.tutorialDone;
    const changed = tut !== r.tutorial || r.tips.length !== before;
    r.tutorial = tut;
    return changed;
  }

  async me(token: string) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    return { ok: true, school: who.school, nick: who.nick, teacher: isAdmin(who.school, who.nick), record: this.readRecord(who.school, who.nick) };
  }

  /** 튜토리얼 끝(+ 그동안 본 말풍선). 바뀐 게 없으면 쓰지 않음 */
  async progress(token: string, body: Record<string, unknown>) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    const r = this.readRecord(who.school, who.nick);
    if (this.mergeProgress(r, body)) this.writeRecord(who.school, who.nick, r);
    return { ok: true, record: r };
  }

  /**
   * 한 판 기록(판이 끝날 때 한 번): { rank, medals, bestChorus, collection: { met, three, morphs }, tips?, ghost?: { rounds, level } }
   * 기록·말풍선·친구 유령을 요청 하나로 받는다.
   */
  async record(token: string, body: Record<string, unknown>) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    const rank = Number(body.rank);
    const medals = Math.max(0, Math.min(200, Number(body.medals) || 0));
    if (!(rank >= 1 && rank <= 4)) return { ok: false, error: '기록이 이상해요.' };
    const r = this.readRecord(who.school, who.nick);
    // 도감: 만난 친구, 3성, 변신해 본 숫자(캐릭터>숫자)
    const col = r.collection;
    const inc = (body.collection ?? {}) as { met?: unknown[]; three?: unknown[]; morphs?: unknown[] };
    const nums = (a: unknown[] | undefined) => (Array.isArray(a) ? a : []).slice(0, 40).map(Number).filter((n) => UNITS[n]);
    r.collection = {
      met: [...new Set([...(col.met ?? []), ...nums(inc.met)])].sort((a, b) => a - b),
      three: [...new Set([...(col.three ?? []), ...nums(inc.three)])].sort((a, b) => a - b),
      morphs: [...new Set([...(col.morphs ?? []), ...(Array.isArray(inc.morphs) ? inc.morphs : []).slice(0, 40).map(String).filter((m) => /^\d{1,2}>\d{1,2}$/.test(m))])].slice(0, 300),
    };
    const bc = body.bestChorus as { beat?: number; nums?: number[]; count?: number } | undefined;
    if (bc && Number(bc.count) >= 2 && Number(bc.count) <= 8 && (!r.bestChorus || Number(bc.count) > r.bestChorus.count)) {
      r.bestChorus = { beat: Number(bc.beat), nums: (Array.isArray(bc.nums) ? bc.nums : []).map(Number).slice(0, 8), count: Number(bc.count) };
    }
    r.games++;
    if (rank === 1) r.firsts++;
    r.medals += medals;
    r.bestMedals = Math.max(r.bestMedals, medals);
    this.mergeProgress(r, body);
    this.writeRecord(who.school, who.nick, r);
    const ghost = body.ghost as { rounds?: unknown; level?: unknown } | undefined;
    if (ghost) this.addGhost(who.school, who.nick, ghost.rounds, ghost.level);
    return { ok: true, record: r };
  }

  /** 친구 유령 한 판(라운드별 보드). 오래된 것 정리는 10판에 한 번만(읽기 아끼기) */
  addGhost(school: string, nick: string, rounds: unknown, level: unknown): boolean {
    if (!Array.isArray(rounds) || !rounds.length || rounds.length > 12 || !rounds.every(validBoard)) return false;
    const data = JSON.stringify({ rounds, level: Number(level) || 0 });
    if (data.length > MAX_GHOST_BYTES) return false;
    const { id } = this.sql.exec<{ id: number }>('INSERT INTO ghosts (school, nick, created, data) VALUES (?, ?, ?, ?) RETURNING id', school, nick, Date.now(), data).one();
    if (id % 10 === 0) {
      this.sql.exec(
        `DELETE FROM ghosts WHERE school = ? AND id NOT IN (SELECT id FROM ghosts WHERE school = ? ORDER BY created DESC LIMIT ${GHOSTS_PER_SCHOOL})`,
        school, school,
      );
    }
    return true;
  }

  async saveGhost(token: string, body: Record<string, unknown>) {
    const who = await this.accountOf(token);
    if (!who) return { ok: false, code: 'no_session' };
    return this.addGhost(who.school, who.nick, body.rounds, body.level) ? { ok: true } : { ok: false, error: '보드 기록이 이상해요.' };
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

  // ---------------- 온라인 대결(랭크) ----------------
  /** 방 연결 전 확인(Worker → RPC): 누구인지 + 학교 이름 + 지금 점수 */
  async whoIs(token: string): Promise<Who | null> {
    const who = await this.accountOf(token);
    if (!who) return null;
    const school = (await loadSchools(this.env)).byCode.get(who.school);
    const p = this.sql.exec<{ points: number }>('SELECT points FROM records WHERE school = ? AND nick = ?', who.school, who.nick).toArray()[0];
    return { ...who, schoolName: school ? shortSchool(school.name) : '', points: Number(p?.points) || 0, teacher: isAdmin(who.school, who.nick) };
  }

  /** 기다리는 방 목록(시작한 방·오래된 방·모둠 방은 안 보임). 우리 학교 방 먼저, 선생님 반 대기실은 그 학교만 */
  async listRooms(token: string): Promise<{ ok: true; rooms: LobbyRoom[] }> {
    const who = token ? await this.accountOf(token) : null;
    const rows = this.sql.exec<{ id: string; title: string; n: number; size: number; short: number; kind: string; school: string }>(
      "SELECT id, title, n, size, short, kind, school FROM rooms WHERE updated > ? AND kind != 'group' AND n < size ORDER BY updated DESC LIMIT 40",
      Date.now() - 20 * 60_000,
    ).toArray();
    const rooms = rows
      .filter((r) => r.kind !== 'class' || r.school === who?.school)
      .map((r) => ({ id: r.id, title: r.title, n: r.n, size: r.size, short: !!r.short, kind: r.kind as RoomKind, mine: !!who && r.school === who.school }))
      .sort((a, b) => Number(b.kind === 'class') - Number(a.kind === 'class') || Number(b.mine) - Number(a.mine) || b.n - a.n)
      .slice(0, 20);
    return { ok: true, rooms };
  }

  async createRoom(token: string, body: Record<string, unknown>, ip: string) {
    const who = await this.whoIs(token);
    if (!who) return { ok: false, code: 'no_session', error: '먼저 들어가기를 해 주세요.' };
    if (await this.limited(ip, 'room', 120, 3600 * 1000)) return { ok: false, error: '방을 너무 많이 만들었어요. 잠시 후에 해 주세요.' };
    const now = Date.now();
    this.sql.exec('DELETE FROM rooms WHERE updated < ?', now - 3600 * 1000); // 한 시간 지난 방 정리
    const cls = body.kind === 'class';
    if (cls && !who.teacher) return { ok: false, error: '선생님 계정만 반 대기실을 열 수 있어요.' };
    const size = cls ? ONLINE.classMax : Math.max(2, Math.min(4, Number(body.size) || 4));
    const id = this.newRoomId();
    const title = cls ? `🍎 ${who.nick} 선생님 반 대기실` : `${who.schoolName} ${who.nick}의 방`;
    this.sql.exec(
      'INSERT INTO rooms (id, title, short, size, n, created, updated, kind, school) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)',
      id, title, body.short ? 1 : 0, size, now, now, cls ? 'class' : 'room', who.school,
    );
    return { ok: true, id };
  }

  newRoomId(): string {
    const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    do id = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ABC[b % ABC.length]).join('');
    while (this.sql.exec('SELECT 1 FROM rooms WHERE id = ?', id).toArray().length);
    return id;
  }

  /** 반 대기실(Room) → 저장소 RPC: 선생님이 나눈 모둠 방(목록에 안 보임, 정해진 친구만) */
  createGroupRoom(o: { school: string; title: string; short: boolean; members: { school: string; nick: string }[] }): string {
    const id = this.newRoomId();
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO rooms (id, title, short, size, n, created, updated, kind, school, members) VALUES (?, ?, ?, 4, 0, ?, ?, 'group', ?, ?)",
      id, o.title, o.short ? 1 : 0, now, now, o.school, JSON.stringify(o.members.slice(0, 4)),
    );
    return id;
  }

  /** 방(Room) → 저장소 RPC */
  roomInfo(id: string): { kind: RoomKind; short: boolean; size: number; school: string; members: { school: string; nick: string }[] | null } | null {
    if (!ROOM_ID.test(id)) return null;
    const r = this.sql.exec<{ short: number; size: number; kind: string; school: string; members: string }>('SELECT short, size, kind, school, members FROM rooms WHERE id = ?', id).toArray()[0];
    if (!r) return null;
    let members: { school: string; nick: string }[] | null = null;
    try {
      members = r.members ? JSON.parse(r.members) : null;
    } catch {
      members = null;
    }
    return { kind: (r.kind || 'room') as RoomKind, short: !!r.short, size: r.size, school: r.school, members };
  }
  roomUpdate(id: string, n: number) {
    this.sql.exec('UPDATE rooms SET n = ?, updated = ? WHERE id = ?', n, Date.now(), id);
  }
  roomRemove(id: string) {
    this.sql.exec('DELETE FROM rooms WHERE id = ?', id);
  }

  /** 판이 끝난 방에서 한 번: 등수대로 점수(읽기 1 + 쓰기 1 / 사람) */
  applyRanks(list: { school: string; nick: string; place: number; players: number }[]) {
    return list.map((x) => {
      const r = this.sql.exec<{ points: number }>('SELECT points FROM records WHERE school = ? AND nick = ?', x.school, x.nick).toArray()[0];
      const before = Number(r?.points) || 0;
      const delta = rankDelta(x.place, x.players, before);
      const after = before + delta;
      this.sql.exec(
        `INSERT INTO records (school, nick, points, ranked, rank_firsts, updated) VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT (school, nick) DO UPDATE SET points = excluded.points, ranked = records.ranked + 1,
           rank_firsts = records.rank_firsts + excluded.rank_firsts, updated = excluded.updated`,
        x.school, x.nick, after, x.place === 1 ? 1 : 0, Date.now(),
      );
      return { before, after, delta };
    });
  }

  /** 랭킹 30명(전체 또는 우리 학교) */
  async ranking(token: string, scope: 'school' | 'all') {
    const who = await this.accountOf(token);
    if (scope === 'school' && !who) return { ok: false, code: 'no_session', error: '먼저 들어가기를 해 주세요.' };
    const rows = (scope === 'school'
      ? this.sql.exec<{ school: string; nick: string; points: number; ranked: number }>('SELECT school, nick, points, ranked FROM records WHERE school = ? AND ranked > 0 ORDER BY points DESC LIMIT 30', who!.school)
      : this.sql.exec<{ school: string; nick: string; points: number; ranked: number }>('SELECT school, nick, points, ranked FROM records WHERE ranked > 0 ORDER BY points DESC LIMIT 30')
    ).toArray();
    const idx = await loadSchools(this.env);
    const list: RankRow[] = rows.map((r) => ({ nick: r.nick, schoolName: shortSchool(idx.byCode.get(r.school)?.name ?? ''), points: r.points, ranked: r.ranked }));
    return { ok: true, rows: list };
  }
}
