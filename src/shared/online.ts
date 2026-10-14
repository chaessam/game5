// 온라인 대결(랭크) 주고받는 말. 서버(Room)와 화면이 같이 쓴다.
// 서버는 라운드마다 모두의 보드를 한 번 모아 결과를 정하고, 상점·골드·아이템은 각자 기기에서 계산한다.
import type { BoardUnit } from '../engine/types';
import type { Pair } from '../game/game';

export const ONLINE = {
  maxPlayers: 4,
  /** 1라운드 준비(첫 친구 고르기 포함) */
  firstPrepMs: 75_000,
  /** 2라운드부터: 전투 보기(약 35초) + 준비 60초 */
  prepMs: 95_000,
  /** 마감 뒤 조금 더 기다림(늦게 도착한 준비 완료) */
  graceMs: 4_000,
  /** 아무도 연결되어 있지 않으면 남은 라운드를 빨리 끝냄 */
  emptyStepMs: 1_500,
};

export type RoomStatus = 'wait' | 'play' | 'done';

export interface SeatInfo {
  nick: string;
  schoolName: string;
  points: number;
  online: boolean;
}

export interface RoomInfo {
  id: string;
  short: boolean;
  size: number;
  status: RoomStatus;
  host: number;
  seats: SeatInfo[];
}

export interface FinalPlace {
  seat: number;
  place: number;
  medals: number;
  before: number;
  after: number;
  delta: number;
}

export interface RoundMsg {
  t: 'round';
  round: number;
  /** 자리마다 이번 라운드에 싸운 보드(못 낸 친구는 지난 보드) */
  boards: BoardUnit[][];
  pairs?: Pair[];
  medals: number[];
  next: { monsterIndex: number; remainMs: number } | null;
  /** 마지막 라운드: 등수와 랭크 점수 */
  final?: FinalPlace[];
}

export type ServerMsg =
  | { t: 'room'; room: RoomInfo; you: number }
  | { t: 'start'; seed: number; short: boolean; names: string[]; points: number[]; you: number; monsterIndex: number; remainMs: number }
  | { t: 'ready'; round: number; n: number; of: number }
  | RoundMsg
  | { t: 'state'; round: number; remainMs: number; submitted: boolean }
  | { t: 'error'; code: string; error: string };

export type ClientMsg =
  | { t: 'hello'; round: number }
  | { t: 'start' }
  | { t: 'ready'; round: number; board: BoardUnit[] }
  | { t: 'leave' };

export interface LobbyRoom {
  id: string;
  title: string;
  n: number;
  size: number;
  short: boolean;
}

export interface RankRow {
  nick: string;
  schoolName: string;
  points: number;
  ranked: number;
}

export const ROOM_ID = /^[A-Z2-9]{5}$/;
