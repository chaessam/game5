// 온라인 대결 방(Durable Object 하나 = 방 하나). WebSocket 잠자기(Hibernation)를 써서
// 라운드 사이에는 서버가 잠들어 무료 한도를 아낀다. 라운드마다: 모두의 보드를 한 번 받고 → 결과 계산 → 한 번 알림.
// 빈자리 컴퓨터(보통)는 방장 기기가 대신 두고 보드를 함께 보낸다(서버 계산 없음). 점수는 사람끼리 등수로.
import { DurableObject } from 'cloudflare:workers';
import type { BoardUnit } from '../src/engine/types';
import { advance, createOnlineGame, currentPlan, deserializeGame, pairings, ranking, resolveRound, serializeGame } from '../src/game/game';
import type { GameState } from '../src/game/types';
import { cleanBoard, validBoard } from '../src/shared/board';
import { ruleOfWeek, validCards } from '../src/game/magic';
import { UNITS } from '../src/engine/data';
import {
  EMOTES, ONLINE, ONLINE_BOT_NAMES,
  type ClientMsg, type FinalPlace, type RoomInfo, type RoomStatus, type RoundMsg, type ServerMsg,
} from '../src/shared/online';
import type { Env, Who } from './env';

interface Seat extends Who {
  left?: boolean;
  bot?: boolean;
}
type Tag = { school: string; nick: string };
interface RoomState {
  id: string;
  short: boolean;
  size: number;
  status: RoomStatus;
  host: number;
  seats: Seat[];
  /** 빈자리 컴퓨터로 채우기 */
  fill: boolean;
  /** 짝꿍 팀전 2:2 */
  teams?: boolean;
  /** 이번 주 규칙(시작할 때 정함) */
  rule?: string | null;
  /** 자리마다 숫자 마법 카드(가장 최근에 받은 것) */
  cards?: string[][];
  /** 자리마다 짝꿍에게 친구를 보낸 라운드 */
  gifts?: number[];
  /** 자동 시작 시각 */
  autoAt: number | null;
  seed: number;
  game: string;
  round: number;
  /** 컴퓨터 자리와 그 보드를 대신 보내는 자리(방장) */
  bots: number[];
  driver: number;
  /** 사람 2명 이상 → 점수가 걸린 판 */
  ranked: boolean;
  /** 이번 라운드에 받은 보드 */
  boards: (BoardUnit[] | null)[];
  /** 지난 라운드 보드(못 낸 친구는 이걸로) */
  last: BoardUnit[][];
  deadline: number;
  /** 지난 라운드 결과(다시 연결한 친구에게 다시 보냄) */
  results: RoundMsg[];
}

const same = (a: Tag, b: Tag) => a.school === b.school && a.nick === b.nick;

export class Room extends DurableObject<Env> {
  /** undefined = 아직 안 읽음, null = 방 없음 */
  st: RoomState | null | undefined;
  /** 감정 스티커 간격(메모리만) */
  lastEmote = new Map<string, number>();

  async load(): Promise<RoomState | null> {
    if (this.st === undefined) this.st = (await this.ctx.storage.get<RoomState>('st')) ?? null;
    return this.st;
  }
  async save() {
    if (this.st) await this.ctx.storage.put('st', this.st);
  }
  store() {
    return this.env.STORE.get(this.env.STORE.idFromName('main'));
  }

  tagOf(ws: WebSocket): Tag | null {
    try {
      return ws.deserializeAttachment() as Tag;
    } catch {
      return null;
    }
  }
  seatOf(ws: WebSocket): number {
    const t = this.tagOf(ws);
    return t && this.st ? this.st.seats.findIndex((s) => !s.bot && same(s, t)) : -1;
  }
  /** 열려 있는 연결(닫히는 중인 것 빼고) */
  open(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
  }
  online(i: number): boolean {
    const s = this.st?.seats[i];
    return !!s && !s.bot && this.open().some((ws) => {
      const t = this.tagOf(ws);
      return !!t && same(t, s);
    });
  }
  send(ws: WebSocket, m: ServerMsg) {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      /* 이미 끊김 */
    }
  }
  broadcast(m: ServerMsg | ((seat: number) => ServerMsg)) {
    for (const ws of this.open()) this.send(ws, typeof m === 'function' ? m(this.seatOf(ws)) : m);
  }
  info(): RoomInfo {
    const st = this.st!;
    return {
      id: st.id, short: st.short, size: st.size, status: st.status, host: st.host, fill: st.fill, teams: !!st.teams,
      autoInMs: st.status === 'wait' && st.autoAt ? Math.max(0, st.autoAt - Date.now()) : null,
      seats: st.seats.map((s, i) => ({
        nick: s.nick, schoolName: s.schoolName, points: s.points, online: s.bot ? true : this.online(i) && !s.left,
        ...(s.bot ? { bot: true } : {}), ...(s.teacher ? { teacher: true } : {}),
      })),
    };
  }
  sendRoom() {
    this.broadcast((you) => ({ t: 'room', room: this.info(), you }));
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    let who: Who | null = null;
    try {
      who = JSON.parse(decodeURIComponent(req.headers.get('x-who') || '')) as Who;
    } catch {
      who = null;
    }
    const id = req.headers.get('x-room') || '';
    if (!who) return new Response('no session', { status: 401 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ school: who.school, nick: who.nick } satisfies Tag);
    // 같은 순간 여러 친구가 들어와도 방이 두 번 만들어지지 않게 한 번에 하나씩
    const err = await this.ctx.blockConcurrencyWhile(() => this.join(who!, id, server));
    if (err) {
      this.send(server, { t: 'error', code: err[0], error: err[1] });
      server.close(1000, err[0]);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /** 들어오기(처음·다시 연결). 문제가 있으면 [코드, 안내] */
  async join(who: Who, id: string, ws: WebSocket): Promise<[string, string] | null> {
    let st = await this.load();
    if (!st) {
      const info = await this.store().roomInfo(id);
      if (!info) return ['no_room', '없어진 방이에요. 방 목록을 새로 고쳐 봐요.'];
      st = this.st = {
        id, short: info.short, size: info.size, status: 'wait', host: 0,
        seats: [], fill: true, autoAt: null,
        seed: 0, game: '', round: 0, bots: [], driver: 0, ranked: false, boards: [], last: [], deadline: 0, results: [],
      };
    }
    // 같은 계정의 예전 연결(다른 탭·새로고침 전)은 닫기
    for (const other of this.ctx.getWebSockets()) {
      const t = this.tagOf(other);
      if (other !== ws && t && same(t, who)) other.close(1000, 'replaced');
    }
    const i = st.seats.findIndex((s) => !s.bot && same(s, who));
    if (st.status === 'done') return ['ended', '이미 끝난 방이에요.'];
    if (st.status === 'play') {
      if (i < 0) return ['started', '이미 시작한 방이에요.'];
      st.seats[i].left = false;
      await this.save();
      return null; // 'hello'를 받으면 지난 결과를 다시 보냄
    }
    if (i < 0) {
      if (st.seats.length >= st.size) return ['full', '방이 꽉 찼어요.'];
      st.seats.push({ ...who });
    } else st.seats[i] = { ...st.seats[i], ...who };
    await this.updateAuto();
    await this.save();
    await this.store().roomUpdate(st.id, st.seats.length);
    this.sendRoom();
    return null;
  }

  /** 자동 시작: 사람이 2명 모이면 60초 뒤, 꽉 차면 5초 뒤 */
  async updateAuto() {
    const st = this.st!;
    if (st.status !== 'wait') return;
    const now = Date.now();
    const humans = st.seats.filter((s, i) => !s.bot && this.online(i)).length;
    if (humans >= st.size) st.autoAt = Math.min(st.autoAt ?? Infinity, now + ONLINE.fullStartMs);
    else if (humans >= 2) st.autoAt = st.autoAt ?? now + ONLINE.autoStartMs;
    else st.autoAt = null;
    if (st.autoAt) await this.ctx.storage.setAlarm(st.autoAt);
    else await this.ctx.storage.deleteAlarm();
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(() => this.onMessage(ws, raw));
  }

  async onMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const st = await this.load();
    if (!st || typeof raw !== 'string' || raw.length > 40_000) return;
    let m: ClientMsg;
    try {
      m = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    const seat = this.seatOf(ws);
    if (seat < 0) return;
    switch (m.t) {
      case 'hello':
        this.send(ws, { t: 'room', room: this.info(), you: seat });
        if (st.status !== 'wait') {
          for (const r of st.results) if (r.round >= Number(m.round || 0)) this.send(ws, r);
          if (st.status === 'play') this.send(ws, { t: 'state', round: st.round, remainMs: Math.max(0, st.deadline - Date.now()), submitted: !!st.boards[seat] });
        }
        break;
      case 'start':
        if (st.status === 'wait' && seat === st.host) await this.start();
        break;
      case 'fill':
        if (st.status === 'wait' && seat === st.host) {
          st.fill = !!m.on;
          await this.save();
          this.sendRoom();
        }
        break;
      case 'teams':
        if (st.status === 'wait' && seat === st.host) {
          st.teams = !!m.on;
          if (st.teams) st.fill = true; // 팀전은 4자리가 꼭 차야 함
          await this.save();
          this.sendRoom();
        }
        break;
      case 'gift': {
        // 짝꿍에게 친구 보내기: 같은 팀, 라운드마다 1번. 저장 없이 받는 사람(컴퓨터 짝꿍이면 방장)에게만 전달
        if (st.status !== 'play' || !st.teams) return;
        const to = Number(m.to);
        const g = deserializeGame(st.game);
        if (!g.teams || to === seat || g.teams[to] !== g.teams[seat]) return;
        st.gifts ??= [];
        if (st.gifts[seat] === st.round) return;
        const u = m.unit;
        if (!u || !UNITS[u.char] || ![1, 2, 3].includes(u.star) || !Array.isArray(u.items) || u.items.length > 2) return;
        st.gifts[seat] = st.round;
        await this.save();
        const target = st.seats[to]?.bot ? st.driver : to;
        for (const w of this.open()) if (this.seatOf(w) === target) this.send(w, { t: 'gift', from: seat, to, unit: { char: u.char, star: u.star, items: u.items.slice(0, 2) } });
        break;
      }
      case 'ready': {
        if (st.status !== 'play' || m.round !== st.round || !validBoard(m.board)) return;
        st.boards[seat] = cleanBoard(m.board);
        const total = st.short ? 8 : 12;
        st.cards ??= st.seats.map(() => []);
        if (validCards(m.cards ?? [], st.round, total)) st.cards[seat] = m.cards ?? [];
        // 방장이 컴퓨터 보드도 함께 보냄
        if (seat === st.driver && m.bots && typeof m.bots === 'object') {
          for (const b of st.bots) {
            const board = (m.bots as Record<number, unknown>)[b];
            if (validBoard(board)) st.boards[b] = cleanBoard(board);
            const bc = (m.botCards as Record<number, unknown> | undefined)?.[b];
            if (validCards(bc ?? [], st.round, total)) st.cards[b] = (bc as string[]) ?? [];
          }
        }
        await this.save();
        this.broadcast({ t: 'ready', round: st.round, n: st.seats.filter((s, i) => !s.bot && st.boards[i]).length, of: st.seats.filter((s) => !s.bot).length });
        const driverOn = this.online(st.driver);
        if (st.seats.every((s, i) => st.boards[i] || s.left || (s.bot ? !driverOn : !this.online(i)))) await this.resolve();
        break;
      }
      case 'emote': {
        const id = Number(m.id);
        if (!(id >= 0 && id < EMOTES.length)) return;
        const key = `${st.seats[seat].school}/${st.seats[seat].nick}`;
        const now = Date.now();
        if (now - (this.lastEmote.get(key) ?? 0) < ONLINE.emoteGapMs) return;
        this.lastEmote.set(key, now);
        this.broadcast({ t: 'emote', seat, nick: st.seats[seat].nick, id });
        break;
      }
      case 'leave':
        await this.leave(seat);
        ws.close(1000, 'leave');
        break;
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.ctx.blockConcurrencyWhile(() => this.onClose(ws));
  }

  async onClose(ws: WebSocket) {
    const st = await this.load();
    if (!st) return;
    // 기다리는 방에서 나가면 자리 비움(다시 들어올 수 있음). 게임 중에는 자리를 두고 지난 보드로 계속
    if (st.status === 'wait') {
      const seat = this.seatOf(ws);
      if (seat >= 0 && !this.online(seat)) await this.leave(seat);
    }
  }

  async leave(seat: number) {
    const st = this.st!;
    if (st.status === 'wait') {
      st.seats.splice(seat, 1);
      if (st.host >= st.seats.length || st.host === seat) st.host = 0;
      else if (seat < st.host) st.host--;
      if (!st.seats.length) {
        await this.store().roomRemove(st.id);
        await this.ctx.storage.deleteAll();
        this.st = null;
        return;
      }
      await this.updateAuto();
      await this.save();
      await this.store().roomUpdate(st.id, st.seats.length);
      this.sendRoom();
    } else if (st.status === 'play') {
      st.seats[seat].left = true;
      await this.save();
    }
  }

  async start() {
    const st = this.st!;
    const keep = st.seats.filter((s, i) => !s.bot && this.online(i));
    // 사람 2명부터
    if (keep.length < 2) {
      st.autoAt = null;
      await this.save();
      this.sendRoom();
      return;
    }
    st.seats = keep;
    st.host = 0;
    st.ranked = keep.length >= 2;
    st.bots = [];
    const bot = (k: number): Seat => ({ school: '', nick: ONLINE_BOT_NAMES[k], schoolName: '', points: 0, teacher: false, bot: true });
    if (st.teams) {
      // 팀전: 0·1번 자리 대 2·3번 자리. 사람이 2명이면 서로 다른 팀(짝꿍은 컴퓨터)
      const h = keep;
      st.seats = h.length === 2 ? [h[0], bot(0), h[1], bot(1)] : h.length === 3 ? [h[0], h[1], h[2], bot(0)] : h.slice(0, 4);
      st.seats.forEach((s, i) => s.bot && st.bots.push(i));
    } else if (st.fill) {
      while (st.seats.length < ONLINE.maxPlayers) {
        st.bots.push(st.seats.length);
        st.seats.push(bot(st.bots.length - 1));
      }
    }
    st.rule = ruleOfWeek().id;
    st.cards = st.seats.map(() => []);
    st.gifts = [];
    st.driver = 0;
    st.autoAt = null;
    st.seed = (Math.random() * 2 ** 31) >>> 0;
    const g = createOnlineGame({ seed: st.seed, short: st.short, names: st.seats.map((s) => s.nick), mySeat: -1, rule: st.rule, teams: !!st.teams });
    st.game = serializeGame(g);
    st.status = 'play';
    st.round = g.round;
    st.boards = [];
    st.last = st.seats.map(() => []);
    st.results = [];
    st.deadline = Date.now() + ONLINE.firstPrepMs;
    await this.ctx.storage.setAlarm(st.deadline + ONLINE.graceMs);
    await this.save();
    await this.store().roomRemove(st.id); // 시작한 방은 목록에서 빠짐
    const names = st.seats.map((s) => s.nick);
    const points = st.seats.map((s) => s.points);
    this.broadcast((you) => ({
      t: 'start', seed: st.seed, short: st.short, names, points, you, monsterIndex: g.monsterIndex, remainMs: ONLINE.firstPrepMs,
      bots: st.bots, driver: st.driver, ranked: st.ranked, rule: st.rule ?? null, teams: !!st.teams,
    }));
  }

  /** 라운드 마감: 받은 보드(없으면 지난 보드)로 결과 계산 → 모두에게 한 번 알림 */
  async resolve() {
    const st = this.st!;
    if (st.status !== 'play') return;
    const g = deserializeGame(st.game);
    const boards = st.seats.map((_, i) => st.boards[i] ?? st.last[i] ?? []);
    const pairs = currentPlan(g).kind === 'pvp' ? pairings(g) : undefined;
    const round = g.round;
    const cards = st.seats.map((_, i) => st.cards?.[i] ?? []);
    resolveRound(g, { boards, cards, light: true });
    g.pendingRewards = [];
    advance(g);
    st.last = boards;
    st.boards = [];
    const over = g.phase === 'over';
    const msg: RoundMsg = { t: 'round', round, boards, pairs, cards, medals: g.players.map((p) => p.medals), next: over ? null : { monsterIndex: g.monsterIndex, remainMs: ONLINE.prepMs } };
    if (over) {
      st.status = 'done';
      msg.final = await this.finish(g);
      await this.ctx.storage.setAlarm(Date.now() + 10 * 60_000); // 10분 뒤 방 정리
    } else {
      st.round = g.round;
      const nobody = !this.open().length;
      st.deadline = Date.now() + (nobody ? ONLINE.emptyStepMs : ONLINE.prepMs);
      await this.ctx.storage.setAlarm(st.deadline + (nobody ? 0 : ONLINE.graceMs));
    }
    st.game = serializeGame(g);
    st.results.push(msg);
    await this.save();
    this.broadcast(msg);
  }

  /** 끝: 사람끼리 등수 → 랭크 점수(저장소에 한 번). 컴퓨터는 점수 없음 */
  async finish(g: GameState): Promise<FinalPlace[]> {
    const st = this.st!;
    const order = ranking(g);
    const people = order.filter((p) => !st.seats[p.id].bot);
    let ranks: { before: number; after: number; delta: number }[] | null = null;
    // 팀전: 이긴 팀 사람은 1등, 진 팀 사람은 2등(2명 표). 두 팀에 모두 사람이 있을 때만 점수
    const teamOf = (id: number) => g.teams?.[id] ?? 0;
    const winTeam = g.teams ? teamOf(order[0].id) : 0;
    const bothTeams = !g.teams || new Set(people.map((p) => teamOf(p.id))).size === 2;
    if (st.ranked && people.length >= 2 && bothTeams) {
      try {
        ranks = await this.store().applyRanks(people.map((p, i) => ({
          school: st.seats[p.id].school, nick: st.seats[p.id].nick,
          place: g.teams ? (teamOf(p.id) === winTeam ? 1 : 2) : i + 1, players: g.teams ? 2 : people.length,
        })));
      } catch {
        ranks = null; // 한도가 찼으면 점수만 못 남김
      }
    }
    return order.map((p, i) => {
      const seat = st.seats[p.id];
      const r = ranks?.[people.indexOf(p)] ?? { before: seat.points, after: seat.points, delta: 0 };
      return { seat: p.id, place: i + 1, medals: p.medals, ...r, ...(seat.bot ? { bot: true } : {}) };
    });
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(() => this.onAlarm());
  }

  async onAlarm() {
    const st = await this.load();
    if (!st) return;
    if (st.status === 'done') {
      await this.ctx.storage.deleteAll();
      this.st = null;
      return;
    }
    if (st.status === 'wait') {
      if (st.autoAt && Date.now() >= st.autoAt - 100) await this.start();
      else if (st.autoAt) await this.ctx.storage.setAlarm(st.autoAt);
      return;
    }
    if (Date.now() < st.deadline) {
      await this.ctx.storage.setAlarm(st.deadline + ONLINE.graceMs);
      return;
    }
    await this.resolve();
  }
}
