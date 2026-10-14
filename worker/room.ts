// 온라인 대결 방(Durable Object 하나 = 방 하나). WebSocket 잠자기(Hibernation)를 써서
// 라운드 사이에는 서버가 잠들어 무료 한도를 아낀다. 라운드마다: 모두의 보드를 한 번 받고 → 결과 계산 → 한 번 알림.
import { DurableObject } from 'cloudflare:workers';
import type { BoardUnit } from '../src/engine/types';
import { advance, createOnlineGame, currentPlan, deserializeGame, pairings, ranking, resolveRound, serializeGame } from '../src/game/game';
import type { GameState } from '../src/game/types';
import { cleanBoard, validBoard } from '../src/shared/board';
import { ONLINE, type ClientMsg, type FinalPlace, type RoomInfo, type RoomStatus, type RoundMsg, type ServerMsg } from '../src/shared/online';
import type { Env, Who } from './env';

interface Seat extends Who {
  left?: boolean;
}
interface RoomState {
  id: string;
  short: boolean;
  size: number;
  status: RoomStatus;
  host: number;
  seats: Seat[];
  seed: number;
  game: string;
  round: number;
  /** 이번 라운드에 받은 보드 */
  boards: (BoardUnit[] | null)[];
  /** 지난 라운드 보드(못 낸 친구는 이걸로) */
  last: BoardUnit[][];
  deadline: number;
  /** 지난 라운드 결과(다시 연결한 친구에게 다시 보냄) */
  results: RoundMsg[];
}
type Tag = { school: string; nick: string };

const same = (a: Tag, b: Tag) => a.school === b.school && a.nick === b.nick;

export class Room extends DurableObject<Env> {
  /** undefined = 아직 안 읽음, null = 방 없음 */
  st: RoomState | null | undefined;

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
    return t && this.st ? this.st.seats.findIndex((s) => same(s, t)) : -1;
  }
  /** 열려 있는 연결(닫히는 중인 것 빼고) */
  open(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
  }
  online(i: number): boolean {
    const s = this.st?.seats[i];
    return !!s && this.open().some((ws) => {
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
      id: st.id, short: st.short, size: st.size, status: st.status, host: st.host,
      seats: st.seats.map((s, i) => ({ nick: s.nick, schoolName: s.schoolName, points: s.points, online: this.online(i) && !s.left })),
    };
  }
  sendRoom() {
    this.broadcast((you) => ({ t: 'room', room: this.info(), you }));
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const who = JSON.parse(req.headers.get('x-who') || 'null') as Who | null;
    const id = req.headers.get('x-room') || '';
    if (!who) return new Response('no session', { status: 401 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ school: who.school, nick: who.nick } satisfies Tag);
    const err = await this.join(who, id, server);
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
      st = this.st = { id, short: info.short, size: info.size, status: 'wait', host: 0, seats: [], seed: 0, game: '', round: 0, boards: [], last: [], deadline: 0, results: [] };
    }
    // 같은 계정의 예전 연결(다른 탭)은 닫기
    for (const other of this.ctx.getWebSockets()) {
      const t = this.tagOf(other);
      if (other !== ws && t && same(t, who)) other.close(1000, 'replaced');
    }
    const i = st.seats.findIndex((s) => same(s, who));
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
    await this.save();
    await this.store().roomUpdate(st.id, st.seats.length);
    this.sendRoom();
    return null;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const st = await this.load();
    if (!st || typeof raw !== 'string' || raw.length > 20_000) return;
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
      case 'ready':
        if (st.status !== 'play' || m.round !== st.round || !validBoard(m.board)) return;
        st.boards[seat] = cleanBoard(m.board);
        await this.save();
        this.broadcast({ t: 'ready', round: st.round, n: st.boards.filter(Boolean).length, of: st.seats.length });
        if (st.seats.every((s, i) => st.boards[i] || s.left || !this.online(i))) await this.resolve();
        break;
      case 'leave':
        await this.leave(seat);
        ws.close(1000, 'leave');
        break;
    }
  }

  async webSocketClose(ws: WebSocket) {
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
    const keep = st.seats.filter((_, i) => this.online(i));
    if (keep.length < 2) return;
    st.seats = keep;
    st.host = 0;
    st.seed = (Math.random() * 2 ** 31) >>> 0;
    const g = createOnlineGame({ seed: st.seed, short: st.short, names: st.seats.map((s) => s.nick), mySeat: -1 });
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
    this.broadcast((you) => ({ t: 'start', seed: st.seed, short: st.short, names, points, you, monsterIndex: g.monsterIndex, remainMs: ONLINE.firstPrepMs }));
  }

  /** 라운드 마감: 받은 보드(없으면 지난 보드)로 결과 계산 → 모두에게 한 번 알림 */
  async resolve() {
    const st = this.st!;
    if (st.status !== 'play') return;
    const g = deserializeGame(st.game);
    const boards = st.seats.map((_, i) => st.boards[i] ?? st.last[i] ?? []);
    const pairs = currentPlan(g).kind === 'pvp' ? pairings(g) : undefined;
    const round = g.round;
    resolveRound(g, { boards, light: true });
    g.pendingRewards = [];
    advance(g);
    st.last = boards;
    st.boards = [];
    const over = g.phase === 'over';
    const msg: RoundMsg = { t: 'round', round, boards, pairs, medals: g.players.map((p) => p.medals), next: over ? null : { monsterIndex: g.monsterIndex, remainMs: ONLINE.prepMs } };
    if (over) {
      msg.final = await this.finish(g);
      st.status = 'done';
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

  /** 끝: 등수 → 랭크 점수(저장소에 한 번) */
  async finish(g: GameState): Promise<FinalPlace[]> {
    const st = this.st!;
    const order = ranking(g);
    const places = order.map((p, i) => ({ seat: p.id, place: i + 1, medals: p.medals }));
    let ranks: { before: number; after: number; delta: number }[] | null = null;
    try {
      ranks = await this.store().applyRanks(places.map((x) => ({ school: st.seats[x.seat].school, nick: st.seats[x.seat].nick, place: x.place, players: st.seats.length })));
    } catch {
      ranks = null; // 한도가 찼으면 점수만 못 남김
    }
    return places.map((x, i) => {
      const r = ranks?.[i] ?? { before: st.seats[x.seat].points, after: st.seats[x.seat].points, delta: 0 };
      return { ...x, ...r };
    });
  }

  async alarm() {
    const st = await this.load();
    if (!st) return;
    if (st.status === 'done') {
      await this.ctx.storage.deleteAll();
      this.st = null;
      return;
    }
    if (st.status !== 'play') return;
    if (Date.now() < st.deadline) {
      await this.ctx.storage.setAlarm(st.deadline + ONLINE.graceMs);
      return;
    }
    await this.resolve();
  }
}
