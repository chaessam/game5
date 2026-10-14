// 온라인 대결 방 연결 하나. 끊기면 몇 번 다시 잇고, 이어지면 'hello'로 놓친 라운드 결과를 다시 받는다.
import type { ClientMsg, ServerMsg } from '../shared/online';
import { roomSocketUrl } from './api';

/** 서버가 일부러 닫은 이유(다시 잇지 않음) */
const FINAL = new Set(['full', 'started', 'ended', 'no_room', 'replaced', 'leave', 'not_playing']);

export type ConnStatus = 'open' | 'retry' | 'closed';

export class RoomConn {
  private ws: WebSocket | null = null;
  private stopped = false;
  private tries = 0;

  constructor(
    readonly id: string,
    private onMsg: (m: ServerMsg) => void,
    private onStatus: (s: ConnStatus, reason?: string) => void,
    /** 다시 이을 때 내가 어디까지 했는지(그 라운드부터 결과를 다시 받음) */
    private round: () => number,
    /** 구경하기 */
    private spec = false,
  ) {
    this.connect();
  }

  private connect() {
    if (this.stopped) return;
    const ws = new WebSocket(roomSocketUrl(this.id, this.spec));
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.onStatus('open');
      this.send({ t: 'hello', round: this.round() });
    };
    ws.onmessage = (e) => {
      try {
        this.onMsg(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        /* 이상한 말은 무시 */
      }
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped || FINAL.has(e.reason)) {
        this.stopped = true;
        this.onStatus('closed', e.reason);
        return;
      }
      if (this.tries++ < 10) {
        this.onStatus('retry');
        setTimeout(() => this.connect(), Math.min(15_000, 1000 * 2 ** Math.min(this.tries, 4)));
      } else {
        this.stopped = true;
        this.onStatus('closed', 'lost');
      }
    };
  }

  send(m: ClientMsg): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }

  /** 방에서 나가기 */
  leave() {
    this.send({ t: 'leave' });
    this.stop();
  }
  stop() {
    this.stopped = true;
    this.ws?.close(1000, 'leave');
    this.ws = null;
  }
}
