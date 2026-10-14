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

export type RoomStatus = 'wait' | 'play' | 'done';

export interface SeatInfo {
  nick: string;
  schoolName: string;
  points: number;
  online: boolean;
  bot?: boolean;
  teacher?: boolean;
  title?: string;
}

export interface RoomInfo {
  id: string;
  short: boolean;
  size: number;
  status: RoomStatus;
  host: number;
  seats: SeatInfo[];
  /** 빈자리 컴퓨터로 채우기 */
  fill: boolean;
  /** 짝꿍 팀전 2:2 */
  teams: boolean;
  /** 자동 시작까지 남은 시간(없으면 null) */
  autoInMs: number | null;
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
  /** 자리마다 숫자 마법 카드(전투 효과 계산에 씀) */
  cards: string[][];
  medals: number[];
  next: { monsterIndex: number; remainMs: number } | null;
  /** 마지막 라운드: 등수와 랭크 점수 */
  final?: FinalPlace[];
  /** 몬스터 라운드: 몬스터(구경하는 친구가 장면을 다시 만들 때 씀) */
  monster?: { name: string; board: BoardUnit[] };
}

/** 구경하러 들어오면 한 번 받는 것: 지금까지의 라운드 결과로 장면을 다시 만들 수 있음 */
export interface SpecInfo {
  title: string;
  short: boolean;
  names: string[];
  points: number[];
  bots: number[];
  rule: string | null;
  teams: boolean;
  round: number;
  results: RoundMsg[];
}

export interface PlayingRoom {
  id: string;
  title: string;
  n: number;
  short: boolean;
}

export type ServerMsg =
  | { t: 'room'; room: RoomInfo; you: number }
  | {
      t: 'start'; seed: number; short: boolean; names: string[]; points: number[]; titles?: string[]; you: number; monsterIndex: number; remainMs: number;
      /** 컴퓨터 자리와, 그 컴퓨터를 대신 두는 자리(방장) */
      bots: number[]; driver: number;
      /** 사람이 2명 이상이라 점수가 걸린 판 */
      ranked: boolean;
      /** 이번 주 규칙 · 짝꿍 팀전 */
      rule: string | null;
      teams: boolean;
    }
  | { t: 'ready'; round: number; n: number; of: number }
  | RoundMsg
  | { t: 'state'; round: number; remainMs: number; submitted: boolean }
  | { t: 'error'; code: string; error: string }
  | { t: 'emote'; seat: number; nick: string; id: number }
  | { t: 'notice'; text: string }
  /** 짝꿍이 보낸 친구 */
  | { t: 'gift'; from: number; to: number; unit: GiftUnit }
  | { t: 'spec'; info: SpecInfo }
  /** 구경하는 친구 수 */
  | { t: 'watchers'; n: number };

export type ClientMsg =
  | { t: 'hello'; round: number }
  | { t: 'start' }
  | { t: 'ready'; round: number; board: BoardUnit[]; cards?: string[]; bots?: Record<number, BoardUnit[]>; botCards?: Record<number, string[]> }
  | { t: 'gift'; to: number; unit: GiftUnit }
  | { t: 'teams'; on: boolean }
  | { t: 'leave' }
  | { t: 'emote'; id: number }
  | { t: 'fill'; on: boolean };

export interface GiftUnit {
  char: number;
  star: 1 | 2 | 3;
  items: string[];
}

export interface LobbyRoom {
  id: string;
  title: string;
  n: number;
  size: number;
  short: boolean;
  /** 우리 학교 방 */
  mine: boolean;
}

export interface RankRow {
  nick: string;
  schoolName: string;
  points: number;
  ranked: number;
  title: string;
}

/** 선생님 학습 지표 한 줄 */
export interface ClassRow {
  nick: string;
  games: number;
  firsts: number;
  points: number;
  ranked: number;
  tutorial: boolean;
  quiz: number;
  tips: number;
  bestChorus: number;
  chorusBeat: number;
  met: number;
  three: number;
  morphs: number;
  updated: number;
}

export const ROOM_ID = /^[A-Z2-9]{5}$/;
