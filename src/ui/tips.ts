// 처음 보는 순간 말풍선(기획서 8절): 기능을 숨기지 않고, 처음 생긴 순간에 한 번만 하나쌤이 한 줄로 알려 준다.
// 본 것은 이 기기에 저장하고(들어가 있으면 서버에도), 수학 수첩에서 다시 볼 수 있다.
import type { BattleResult } from '../engine/battle';
import type { BattleEvent } from '../engine/types';
import { DEFAULT_CONFIG, UNITS } from '../engine/data';
import { income } from '../game/game';
import { isStoneItem, numberOf } from '../game/items';
import type { PlayerState } from '../game/types';

export const TIPS: Record<string, { title: string; text: string }> = {
  ninja: { title: '닌자', text: '닌자는 적의 뒷줄부터 때려요. 약한 친구는 기사 뒤에 숨겨 봐요.' },
  hunter: { title: '헌터', text: '헌터는 가장 먼 적을 쏴요. 먼 칸이라고 안전하지 않아요!' },
  stun: { title: '멈춤', text: '멈춘 친구는 그동안 노래도 공격도 못 해요. 멈추는 박 = 숫자 ÷ 몇(나머지는 버림).' },
  weak: { title: '약하게', text: '약해진 친구는 그동안 기본 공격이 절반이 돼요.' },
  tri: { title: '세모 방패', text: '3의 배수 박마다 세모 친구들이 초록 방패를 채워요.' },
  five: { title: '하이파이브', text: '5의 배수 박마다 하이파이브 친구들 공격력이 쑥! 6번까지 쌓여요.' },
  hot: { title: '뜨거운 박', text: `${DEFAULT_CONFIG.hotBeatFrom}박부터는 기본 공격이 ${DEFAULT_CONFIG.hotBasicPct / 100}배! 오래 끌수록 위험해요.` },
  timeout: { title: '48박 판정', text: '48박까지 못 끝내면 남은 친구 수로, 같으면 남은 체력으로 이긴 쪽을 정해요.' },
  split: { title: '부자 분열', text: '부자 가문이 켜져 있으면 쓰러질 때 곱셈 짝 꼬마 둘로 나뉘어요. 12 = 3 × 4!' },
  bag: { title: '분신 주머니', text: '분신 주머니를 낀 친구는 부자가 아니어도 쓰러지면 곱셈 짝 꼬마 둘로 나뉘어요.' },
  revive: { title: '되살리기', text: '달님 여왕(30)은 가장 먼저 쓰러진 친구를 한 판에 한 번 되살려요.' },
  coins: { title: '약수 금화', text: '36은 판에 있는 36의 약수 친구 수만큼 금화를 받아 튼튼해져요(최대 7개).' },
  treasure: { title: '보물', text: '보물은 숫자를 바꾸지 않아요. 카드에 적힌 대로 작동해요. 친구를 눌러 끼워 봐요.' },
  rare: { title: '희귀 돌', text: '×3, ÷3은 드문 돌이에요. ÷3은 3의 배수에만 끼울 수 있어요.' },
  twin: { title: '같은 숫자 둘', text: '가문은 서로 다른 숫자만 세요. 같은 친구는 3장 모아 2성으로!' },
  streak: { title: '연승·연패', text: '연속으로 이기거나 지면 골드를 더 받아요. 지고 있어도 역전할 수 있어요!' },
};

let seen = new Set<string>();
/** 서버에 아직 안 보낸 말풍선(판이 끝날 때 기록과 함께 한 번에 보냄) */
let pending = new Set<string>();
try {
  seen = new Set((localStorage.getItem('nc-tips') || '').split(',').filter(Boolean));
  pending = new Set((localStorage.getItem('nc-tips-pending') || '').split(',').filter(Boolean));
} catch {
  /* 기본 비어 있음 */
}

export const seenTips = () => [...seen].filter((t) => TIPS[t]);
export function mergeSeen(list: string[]) {
  list.forEach((t) => seen.add(t));
  persist();
}
function persist() {
  try {
    localStorage.setItem('nc-tips', [...seen].join(','));
    localStorage.setItem('nc-tips-pending', [...pending].join(','));
  } catch {
    /* 무시 */
  }
}
export function markSeen(id: string) {
  if (seen.has(id)) return;
  seen.add(id);
  pending.add(id);
  persist();
}
export const pendingTips = () => [...pending];
/** 서버에 보낸 뒤 */
export function clearPending(sent: string[]) {
  sent.forEach((t) => pending.delete(t));
  persist();
}

const tipLine = (id: string) => `💡 처음 보는 ${TIPS[id].title}! ${TIPS[id].text}`;

/** 전투 박마다: 처음 생긴 일이면 하나쌤 한 줄(한 박에 하나만) */
export function battleTips(beat: number, evs: BattleEvent[], v: { side: 0 | 1; result: BattleResult }): string[] {
  const f = (id: number) => v.result.fighters.find((x) => x.id === id);
  const mine = (id: number) => f(id)?.team === v.side;
  const cand: string[] = [];
  for (const e of evs) {
    if (e.type === 'damage' && e.basic && !mine(e.src) && mine(e.tgt)) {
      const src = f(e.src);
      const role = src && !src.minion ? UNITS[src.char]?.role : null;
      if (role === 'ninja') cand.push('ninja');
      if (role === 'hunter') cand.push('hunter');
    } else if (e.type === 'stun' && mine(e.tgt)) cand.push('stun');
    else if (e.type === 'weak' && mine(e.tgt)) cand.push('weak');
    else if (e.type === 'familyBeat' && e.team === v.side) cand.push(e.family === 'tri' ? 'tri' : 'five');
    else if (e.type === 'split') cand.push(f(e.unit)?.items.includes('bag') && !f(e.unit)?.fams.includes('rich') ? 'bag' : 'split');
    else if (e.type === 'revive') cand.push('revive');
    else if (e.type === 'coins' && e.coins > 0) cand.push('coins');
  }
  if (beat === DEFAULT_CONFIG.hotBeatFrom) cand.push('hot');
  if (v.result.timeout && beat === v.result.beats) cand.push('timeout');
  const id = cand.find((c) => !seen.has(c));
  if (!id) return [];
  markSeen(id);
  return [tipLine(id)];
}

/** 준비 화면에서 처음 생긴 일(보여 줄 것 하나) */
export function prepTip(p: PlayerState): string | null {
  const nums = [...p.board.values()].map(numberOf);
  const cand: string[] = [];
  if (p.bag.some((i) => !isStoneItem(i))) cand.push('treasure');
  if (p.bag.some((i) => i === 'x3' || i === '/3')) cand.push('rare');
  if (new Set(nums).size < nums.length) cand.push('twin');
  if (income(p).streak > 0) cand.push('streak');
  return cand.find((c) => !seen.has(c)) ?? null;
}
export const prepTipLine = (id: string) => tipLine(id);
