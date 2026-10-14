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
  /** 사람이 2명 모이면 이만큼 뒤 자동 시작(방장은 그 전에 시작 가능) */
  autoStartMs: 60_000,
  /** 방이 꽉 차면 */
  fullStartMs: 5_000,
  /** 선생님이 나눈 모둠 방: 첫 친구가 들어오고 이만큼 뒤(모두 오면 바로) */
  groupStartMs: 20_000,
  /** 선생님 반 대기실 인원 */
  classMax: 40,
  /** 감정 스티커 간격 */
  emoteGapMs: 2_000,
};

/** 빈자리를 채우는 컴퓨터(보통). 방장 기기가 대신 두므로 서버 계산이 없음 */
export const ONLINE_BOT_NAMES = ['컴퓨터 척척이', '컴퓨터 반짝이', '컴퓨터 쑥쑥이'];

/** 감정 스티커 8개: 캐릭터 + 한마디(자유 글 없음) */
export const EMOTES: { char: number; text: string }[] = [
  { char: 1, text: '짝짝짝!' },
  { char: 2, text: '와아!' },
  { char: 3, text: '좋은 수!' },
  { char: 4, text: '힘내!' },
  { char: 5, text: '고마워!' },
  { char: 6, text: '앗!' },
  { char: 7, text: '찡긋~' },
  { char: 9, text: '다음엔 이길 거야!' },
];

/** 선생님 반 시작: n명을 2~4명 모둠으로 고르게(크기 차이 1 이하) */
export function splitGroups(n: number, max = 4): number[] {
  if (n <= 0) return [];
  const k = Math.ceil(n / max);
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

export type RoomStatus = 'wait' | 'play' | 'done';
/** room: 보통 방 · class: 선생님 반 대기실(게임 없음) · group: 선생님이 나눈 모둠 방(목록에 안 보임) */
export type RoomKind = 'room' | 'class' | 'group';

export interface SeatInfo {
  nick: string;
  schoolName: string;
  points: number;
  online: boolean;
  bot?: boolean;
  teacher?: boolean;
}

export interface RoomInfo {
  id: string;
  kind: RoomKind;
  short: boolean;
  size: number;
  status: RoomStatus;
  host: number;
  seats: SeatInfo[];
  /** 빈자리 컴퓨터로 채우기 */
  fill: boolean;
  /** 자동 시작까지 남은 시간(없으면 null) */
  autoInMs: number | null;
  /** 반 대기실: 지금까지 시작한 모둠 수 */
  groups?: number;
}

export interface FinalPlace {
  seat: number;
  place: number;
  medals: number;
  before: number;
  after: number;
  delta: number;
  bot?: boolean;
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
  | {
      t: 'start'; seed: number; short: boolean; names: string[]; points: number[]; you: number; monsterIndex: number; remainMs: number;
      /** 컴퓨터 자리와, 그 컴퓨터를 대신 두는 자리(방장) */
      bots: number[]; driver: number;
      /** 사람이 2명 이상이라 점수가 걸린 판 */
      ranked: boolean;
    }
  | { t: 'ready'; round: number; n: number; of: number }
  | RoundMsg
  | { t: 'state'; round: number; remainMs: number; submitted: boolean }
  | { t: 'error'; code: string; error: string }
  | { t: 'emote'; seat: number; nick: string; id: number }
  /** 선생님이 모둠을 나눔: 이 방으로 옮겨 가요 */
  | { t: 'goto'; id: string }
  | { t: 'notice'; text: string };

export type ClientMsg =
  | { t: 'hello'; round: number }
  | { t: 'start' }
  | { t: 'ready'; round: number; board: BoardUnit[]; bots?: Record<number, BoardUnit[]> }
  | { t: 'leave' }
  | { t: 'emote'; id: number }
  | { t: 'fill'; on: boolean }
  | { t: 'classstart'; short: boolean };

export interface LobbyRoom {
  id: string;
  title: string;
  n: number;
  size: number;
  short: boolean;
  kind: RoomKind;
  /** 우리 학교 방 */
  mine: boolean;
}

export interface RankRow {
  nick: string;
  schoolName: string;
  points: number;
  ranked: number;
}

export const ROOM_ID = /^[A-Z2-9]{5}$/;
