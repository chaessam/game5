// 전투 사건 목록 → 사람이 읽는 글자 로그(1주차 '글자 로그' 확인용).

import { UNITS } from './data';
import type { BattleResult, Fighter } from './battle';
import type { BattleEvent } from './types';

const TEAM = ['A', 'B'];

export function fighterName(f: Fighter): string {
  if (f.minion) return `${TEAM[f.team]}·꼬마${f.num}`;
  const def = UNITS[f.char];
  const star = f.star > 1 ? `${f.star}성 ` : '';
  const changed = f.num !== f.char ? `(${f.char}→${f.num})` : '';
  return `${TEAM[f.team]}·${star}${f.num}${changed} ${def.name}`;
}

const pct = (p: number) => (p % 100 === 0 ? `${p / 100}배` : `${(p / 100).toFixed(2).replace(/0$/, '')}배`);

export function formatEvent(e: BattleEvent, byId: Map<number, Fighter>): string {
  const nm = (id: number) => (byId.get(id) ? fighterName(byId.get(id)!) : `#${id}`);
  switch (e.type) {
    case 'coins':
      return `${nm(e.unit)} 약수 금화 ${e.coins}개 (${e.nums.join('·') || '없음'})`;
    case 'handshake':
      return `${nm(e.unit)} 손잡기 방패 ${e.shield}`;
    case 'familyBeat':
      return e.family === 'tri'
        ? `${TEAM[e.team]} 세모 방패 ${e.value}까지 채움`
        : `${TEAM[e.team]} 하이파이브 공격력 +${e.value}`;
    case 'chorus': {
      const who = e.singers.map((id) => byId.get(id)?.num ?? '?').join('·');
      const tag = e.prime ? ' [다이아끼리]' : e.count >= 2 ? ` [합창 ${e.count}명]` : '';
      return `${TEAM[e.team]} 노래: ${who}${tag}`;
    }
    case 'song':
      return `  ♪ ${nm(e.unit)}${e.rehearsal ? ' 몸풀기' : ''} (${pct(e.mult)})`;
    case 'damage':
      return `    ${nm(e.src)} → ${nm(e.tgt)} ${e.basic ? '공격' : '피해'} ${e.amount}${e.absorbed ? ` (방패 ${e.absorbed})` : ''}`;
    case 'heal':
      return `    ${nm(e.src)} → ${nm(e.tgt)} 회복 ${e.amount}`;
    case 'shield':
      return `    ${nm(e.src)} → ${nm(e.tgt)} 방패 ${e.amount}`;
    case 'stun':
      return `    ${nm(e.src)} → ${nm(e.tgt)} ${e.beats}박 멈춤`;
    case 'weak':
      return `    ${nm(e.src)} → ${nm(e.tgt)} ${e.beats}박 약하게`;
    case 'death':
      return `  ✖ ${nm(e.unit)} 쓰러짐`;
    case 'revive':
      return `  ✚ ${nm(e.src)}가 ${nm(e.tgt)}를 되살림 (체력 ${e.hp})`;
    case 'split':
      return `  💥 ${nm(e.unit)} → ${e.minions.map((m) => nm(m)).join(' + ')}`;
  }
}

export interface LogOptions {
  /** 기본 공격 줄을 뺄지(노래·쓰러짐만 보기) */
  hideBasic?: boolean;
}

export function formatBattleLog(r: BattleResult, opts: LogOptions = {}): string {
  const byId = new Map(r.fighters.map((f) => [f.id, f]));
  const lines: string[] = [];
  let curBeat = -1;
  for (const e of r.events) {
    if (opts.hideBasic && e.type === 'damage' && e.basic) continue;
    if (e.beat !== curBeat) {
      curBeat = e.beat;
      lines.push(curBeat === 0 ? '── 0박 (준비) ──' : `── ${curBeat}박 ──`);
    }
    lines.push(formatEvent(e, byId));
  }
  const w = r.winner === 'draw' ? '무승부' : `${TEAM[r.winner]} 승리`;
  lines.push(`== ${w} · ${r.beats}박${r.timeout ? ' (시간 끝 판정)' : ''} · 살아남은 친구 A ${r.survivors[0]} / B ${r.survivors[1]} ==`);
  return lines.join('\n');
}
