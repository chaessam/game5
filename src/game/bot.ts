// 컴퓨터 플레이어(2주차 임시: '쉬움' 수준). 4주차에 보통·어려움 AI로 바꾼다.
// 컴퓨터도 사람과 같은 규칙·같은 확률·같은 카드 풀을 쓰고 정보를 엿보지 않는다.

import { UNITS } from '../engine/data';
import { ECON } from './economy';
import { allUnits, buy, cellKey, chooseFreePick, chooseReward, ownedCount, rand } from './game';
import type { GameState, PlayerState, UnitInst } from './types';

const value = (u: UnitInst) => UNITS[u.char].cost * 3 ** (u.star - 1);

/** 가치가 큰 친구부터 레벨만큼 보드에(기사는 앞줄, 나머지는 뒷줄) */
export function arrangeBoard(p: PlayerState) {
  const units = allUnits(p).sort((a, b) => value(b) - value(a) || a.uid - b.uid);
  const onBoard = units.slice(0, p.level);
  const rest = units.slice(p.level);
  p.board.clear();
  const cols = [2, 1, 3, 0, 4];
  const used = new Set<string>();
  const place = (u: UnitInst) => {
    const pref: (0 | 1)[] = UNITS[u.char].role === 'knight' ? [0, 1] : [1, 0];
    for (const row of pref) {
      for (const col of cols) {
        const k = cellKey(row, col);
        if (!used.has(k)) {
          used.add(k);
          p.board.set(k, u);
          return;
        }
      }
    }
  };
  // 앞줄이 비지 않게: 기사가 없으면 체력 큰 친구를 앞줄에
  const knights = onBoard.filter((u) => UNITS[u.char].role === 'knight');
  const others = onBoard.filter((u) => UNITS[u.char].role !== 'knight');
  knights.forEach(place);
  if (!knights.length && others.length) {
    const tank = others.sort((a, b) => UNITS[b.char].hp * b.star - UNITS[a.char].hp * a.star)[0];
    used.add(cellKey(0, 2));
    p.board.set(cellKey(0, 2), tank);
    others.filter((u) => u !== tank).forEach(place);
  } else others.forEach(place);
  p.bench = Array(ECON.benchSize).fill(null);
  rest.slice(0, ECON.benchSize).forEach((u, i) => (p.bench[i] = u));
}

export function botFreePick(g: GameState, p: PlayerState) {
  const c = g.freePick[p.id];
  if (c?.length) chooseFreePick(g, p, Math.floor(rand(g) * c.length));
}

export function botPrep(g: GameState, p: PlayerState) {
  // 1) 이미 가진 친구(합체 노리기) 먼저
  p.shop.forEach((c, i) => {
    if (c !== null && ownedCount(p, c) > 0 && p.gold >= UNITS[c].cost) buy(g, p, i);
  });
  // 2) 남은 골드로 아무거나(쉬움: 저금하지 않음)
  for (let i = 0; i < p.shop.length; i++) {
    const c = p.shop[i];
    if (c === null || p.gold < UNITS[c].cost) continue;
    if (rand(g) < 0.6) buy(g, p, i);
  }
  arrangeBoard(p);
}

export function botRewards(g: GameState) {
  for (const r of g.pendingRewards.slice()) {
    const p = g.players[r.playerId];
    if (p.isBot) chooseReward(g, p.id, Math.floor(rand(g) * r.options.length));
  }
}
