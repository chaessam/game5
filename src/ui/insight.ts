// 전투 결과 풀이: 결정적 장면, 다음 판 팁 한 줄, 칭찬 배지, 가장 큰 합창.
import type { BattleResult, Fighter } from '../engine/battle';

export interface Moment {
  beat: number;
  nums: number[];
  count: number;
  damage: number;
}

export interface Insight {
  best: Moment | null;
  foeBest: Moment | null;
  bigChorus: Moment | null;
  tip: string;
  badges: string[];
}

const join = (ns: number[]) => [...ns].sort((a, b) => a - b).join('·');

export function battleInsight(r: BattleResult, side: 0 | 1): Insight {
  const byId = new Map<number, Fighter>(r.fighters.map((f) => [f.id, f]));
  const team = (id: number) => byId.get(id)?.team;
  const win = r.winner === side;
  const dmgBy = [new Map<number, number>(), new Map<number, number>()];
  const chorus = [new Map<number, { nums: number[]; count: number; prime: boolean }>(), new Map<number, { nums: number[]; count: number; prime: boolean }>()];
  let stunsOnMe = 0;
  let primeSolos = 0;
  let handshakes = 0;
  let revived = false;
  let earlyDowns = 0;
  for (const e of r.events) {
    if (e.type === 'damage' && !e.basic) {
      const t = team(e.src)!;
      dmgBy[t].set(e.beat, (dmgBy[t].get(e.beat) ?? 0) + e.amount);
    } else if (e.type === 'chorus') {
      chorus[e.team].set(e.beat, { nums: e.singers.map((id) => byId.get(id)?.num ?? 0), count: e.count, prime: e.prime });
      if (e.team === side && e.prime) primeSolos++;
    } else if (e.type === 'stun' && team(e.tgt) === side) stunsOnMe++;
    else if (e.type === 'handshake' && team(e.unit) === side) handshakes++;
    else if (e.type === 'revive' && team(e.tgt) === side) revived = true;
    else if (e.type === 'death' && team(e.unit) === side && !byId.get(e.unit)?.minion && e.beat < 12) earlyDowns++;
  }
  const moment = (t: 0 | 1): Moment | null => {
    let best: Moment | null = null;
    for (const [beat, damage] of dmgBy[t]) {
      if (beat === 0) continue;
      const c = chorus[t].get(beat);
      if (!c) continue;
      if (!best || damage > best.damage) best = { beat, nums: c.nums, count: c.count, damage };
    }
    return best;
  };
  let bigChorus: Moment | null = null;
  for (const [beat, c] of chorus[side]) {
    if (c.count >= 2 && (!bigChorus || c.count > bigChorus.count)) bigChorus = { beat, nums: c.nums, count: c.count, damage: dmgBy[side].get(beat) ?? 0 };
  }
  const best = moment(side);
  const foeBest = moment((1 - side) as 0 | 1);
  const mineCount = r.fighters.filter((f) => f.team === side && !f.minion).length;

  let tip: string;
  if (!bigChorus) tip = '같은 박에 노래하는 숫자를 모아 봐요. 2·3·6은 6박에, 2·4·8은 8박에 함께 노래해요(그 박의 약수 친구들).';
  else if (!win && foeBest && foeBest.count >= 3) tip = `상대는 ${foeBest.beat}박에 ${foeBest.count}명 합창(${join(foeBest.nums)})! 우리도 한 박의 약수를 여럿 모으면 큰 합창이 돼요.`;
  else if (stunsOnMe >= 3) tip = `멈춤을 ${stunsOnMe}번 당했어요. 앞줄에 기사를 두면 '나부터 때려!' 하고 대신 맞아 줘요.`;
  else if (handshakes === 0 && mineCount >= 3) tip = '붙어 있는 두 친구의 최대공약수가 2 이상이면 손잡기 방패가 생겨요. 예: 4와 6 → 최대공약수 2 → 방패 24.';
  else if (earlyDowns >= 2) tip = '친구가 일찍 쓰러졌어요. 닌자는 뒷줄부터 때려요 — 약한 친구는 기사 뒤에 숨겨 봐요.';
  else if (win) tip = '좋아요! 레벨을 올려 친구를 한 명 더 놓거나, 같은 친구 3장을 모아 2성을 만들어 봐요.';
  else tip = "상점 카드의 '놓으면: 가문 ○명 → ○명' 띠를 보고 가문 단계를 켜 봐요.";

  const badges: string[] = [];
  if (bigChorus && bigChorus.count >= 4) badges.push('🎵 합창 대장');
  if (primeSolos >= 2) badges.push('◆ 단단 쾅');
  if (handshakes >= 4) badges.push('🤝 손잡기 장인');
  if (revived) badges.push('✨ 다시 일어섰어요');
  if (win && r.beats <= 24) badges.push('⚡ 빠른 승리');
  if (win && r.survivors[side] >= 4) badges.push('🛡 끝까지 버텼어요');
  return { best, foeBest, bigChorus, tip, badges };
}

export function momentText(m: Moment, mine: boolean): string {
  const who = mine ? '우리' : '상대';
  const what = m.count >= 2 ? `${m.count}명 합창(${join(m.nums)})` : `${join(m.nums)} 노래`;
  return `${m.beat}박에 ${who} ${what} → 피해 ${m.damage}`;
}
