import type { Store } from './index';
import type { Room } from './room';

export interface Env {
  ASSETS: Fetcher;
  STORE: DurableObjectNamespace<Store>;
  ROOM: DurableObjectNamespace<Room>;
}

/** 들어간 사람(방에 넘겨 주는 정보) */
export interface Who {
  school: string;
  nick: string;
  schoolName: string;
  points: number;
}
