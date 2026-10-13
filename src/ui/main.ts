// 게임 화면: 상점·경제·합체·배치·라운드·메달, 가문/직업 판(늘 펼침), 두 겹 카드,
// 상대 판 구경, 박자 전투 장면(소리). 아이템 끼우기는 4주차.
import './style.css';
import { DEFAULT_CONFIG, FAMILIES, ROLES, UNITS, UNIT_IDS, tierOf } from '../engine/data';
import { divisors, familiesOf, splitPair } from '../engine/math';
import { songText } from '../engine/describe';
import { formatBattleLog } from '../engine/log';
import type { BoardUnit, FamilyId, RoleId } from '../engine/types';
import {
  advance, boardCount, buy, buyXp, cellKey, chooseFreePick, chooseReward, createGame, currentPlan, findUnit,
  income, move, opponentOf, ownedCount, ranking, reroll, resolveRound, sell, sellValue, toggleLock,
  type RoundOutcome,
} from '../game/game';
import { botFreePick, botPrep, botRewards } from '../game/bot';
import { ECON, SHOP_ODDS } from '../game/economy';
import type { BagItem, GameState, PlayerState, Slot } from '../game/types';
import { ART, charArt, famIcon, roleIcon } from './art/chars';
import { FAM_COLOR, ROLE_COLOR } from './art/parts';
import { BattleView } from './battle-view';
import { unlockAudio } from './sound';
import { battleInsight, momentText, type Moment } from './insight';

// ---------------- 상태 ----------------
let g: GameState | null = null;
let selected: { kind: 'unit'; uid: number } | { kind: 'shop'; index: number } | { kind: 'scout'; pid: number } | null = null;
let battle: BattleView | null = null;
let botsPreppedRound = -1;
/** 이번 판에서 만든 가장 큰 합창(게임 끝 '오늘의 수학 발견') */
let bestChorus: (Moment & { round: number }) | null = null;
let modal: { type: 'start' } | { type: 'result'; outcome: RoundOutcome } | null = { type: 'start' };
let toastMsg = '';
let toastTimer = 0;
const app = document.getElementById('app')!;
const me = () => g!.players[0];

const ITEM_NAME: Record<BagItem, string> = {
  '+1': '더하기 돌 (+1)', '-1': '빼기 돌 (−1)', x2: '두 배 돌 (×2)', '/2': '반쪽 돌 (÷2)', x3: '세 배 돌 (×3)', '/3': '삼등분 돌 (÷3)',
  mic: '합창 마이크', glove: '손잡기 장갑', bag: '분신 주머니',
};
const FAM_ORDER: FamilyId[] = ['even', 'tri', 'five', 'prime', 'rich'];
const ROLE_ORDER: RoleId[] = ['knight', 'ninja', 'hunter', 'mage', 'singer', 'healer'];
const COST_COLOR = ['', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const stars = (n: number) => '★'.repeat(n);
const beatsOf = (n: number) => [1, 2, 3].map((k) => n * k).join('·') + '…';

function toast(msg: string) {
  toastMsg = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMsg = '';
    render();
  }, 2200);
}

// ---------------- 시너지 계산(보드 위 서로 다른 숫자 / 서로 다른 캐릭터) ----------------
function synergy(p: PlayerState) {
  const boardNums = new Set<number>();
  const benchNums = new Set<number>();
  const boardChars = new Set<number>();
  const benchChars = new Set<number>();
  for (const u of p.board.values()) { boardNums.add(u.char); boardChars.add(u.char); }
  for (const u of p.bench) if (u) { benchNums.add(u.char); benchChars.add(u.char); }
  const fam = {} as Record<FamilyId, { count: number; tier: number }>;
  for (const f of FAM_ORDER) {
    const count = [...boardNums].filter((n) => familiesOf(n).includes(f)).length;
    fam[f] = { count, tier: tierOf(count, DEFAULT_CONFIG.famTiers[f]) };
  }
  const role = {} as Record<RoleId, { count: number; tier: number }>;
  for (const r of ROLE_ORDER) {
    const count = [...boardChars].filter((c) => UNITS[c].role === r).length;
    role[r] = { count, tier: tierOf(count, DEFAULT_CONFIG.roleTiers) };
  }
  return { fam, role, boardNums, benchNums, boardChars, benchChars };
}

function famEffect(f: FamilyId, tierIdx: number): string {
  const C = DEFAULT_CONFIG;
  switch (f) {
    case 'even': return ['짝! 조금', '짝! 중간', '짝! 한 대 더'][tierIdx];
    case 'tri': return `방패 ${C.triShield[tierIdx + 1]}`;
    case 'five': return `공격 +${C.fiveAtk[tierIdx + 1]}`;
    case 'prime': return `${C.primeSongPct[tierIdx + 1] / 100}배`;
    case 'rich': return ['꼬마 4분의 1', '꼬마 3분의 1', '꼬마 절반'][tierIdx];
  }
}
function roleEffect(r: RoleId, tierIdx: number): string {
  const C = DEFAULT_CONFIG;
  switch (r) {
    case 'knight': return tierIdx ? '더 덜 아파, 친구도' : '덜 아파요';
    case 'ninja': return `공격 +${C.ninjaAtkPct[tierIdx + 1]}%`;
    case 'hunter': return `공격 +${C.hunterAtkPct[tierIdx + 1]}%`;
    case 'mage': return tierIdx ? '많이 더' : '조금 더';
    case 'singer': return tierIdx ? '한 배 더' : '반만큼 더';
    case 'healer': return tierIdx ? '많이 더' : '조금 더';
  }
}

function synPanels(p: PlayerState) {
  const s = synergy(p);
  const famRows = FAM_ORDER.map((f) => {
    const { count, tier } = s.fam[f];
    const tiers = DEFAULT_CONFIG.famTiers[f];
    const members = UNIT_IDS.filter((n) => familiesOf(n).includes(f));
    return `<div class="syn ${tier ? 'on' : ''}" style="--c:${FAM_COLOR[f]}">
      <div class="synhead">${famIcon(f, 20)}<span class="nm">${FAMILIES[f].name}</span><span class="cnt">${count}명</span></div>
      <div class="rule">${esc(FAMILIES[f].rule)}</div>
      <div class="steps">${tiers.map((t, i) => `<span class="${count >= t ? 'lit' : ''}">${t}명 ${famEffect(f, i)}</span>`).join('')}</div>
      <div class="members">${members.map((n) => `<span class="${s.boardNums.has(n) ? 'mb-on' : s.benchNums.has(n) ? 'mb-wait' : ''}">${n}</span>`).join('')}</div>
    </div>`;
  }).join('');
  const roleRows = ROLE_ORDER.map((r) => {
    const { count, tier } = s.role[r];
    const members = UNIT_IDS.filter((n) => UNITS[n].role === r);
    return `<div class="syn ${tier ? 'on' : ''}" style="--c:${ROLE_COLOR[r]}">
      <div class="synhead">${roleIcon(r, 20)}<span class="nm">${ROLES[r].name}</span><span class="cnt">${count}명</span></div>
      <div class="rule">${esc(ROLES[r].rule)}</div>
      <div class="steps">${DEFAULT_CONFIG.roleTiers.map((t, i) => `<span class="${count >= t ? 'lit' : ''}">${t}명 ${roleEffect(r, i)}</span>`).join('')}</div>
      <div class="members">${members.map((n) => `<span class="${s.boardChars.has(n) ? 'mb-on' : s.benchChars.has(n) ? 'mb-wait' : ''}">${n}</span>`).join('')}</div>
    </div>`;
  }).join('');
  return {
    left: `<div class="ptitle">숫자 가문 <small>숫자가 정해요 🔢</small></div>${famRows}`,
    right: `<div class="ptitle">직업 <small>캐릭터가 정해요 🧑</small></div>${roleRows}`,
  };
}

// ---------------- 카드 ----------------
function chips(char: number) {
  const fams = familiesOf(char).map((f) => `<span class="chip" style="color:${FAM_COLOR[f]}">${famIcon(f, 13)}${FAMILIES[f].name}</span>`).join('');
  const r = UNITS[char].role;
  return `${fams || '<span class="chip">가문 없음</span>'}<span class="chip role" style="color:${ROLE_COLOR[r]}">${roleIcon(r, 13)}${ROLES[r].name}</span>`;
}

function shopCard(p: PlayerState, i: number) {
  const char = p.shop[i];
  if (char === null) return `<div class="card empty"></div>`;
  const u = UNITS[char];
  const owned = ownedCount(p, char);
  const s = synergy(p);
  let band = '';
  if (owned === 2) band = `<span class="band merge">2장 모음 → 이걸 사면 2성!</span>`;
  else if (owned === 1) band = `<span class="band merge">1장 있음 → 3장이면 2성</span>`;
  else if (!s.boardNums.has(char)) {
    const f = familiesOf(char)[0];
    if (f) band = `<span class="band">놓으면: ${FAMILIES[f].name} ${s.fam[f].count}명 → ${s.fam[f].count + 1}명</span>`;
  }
  const cant = p.gold < u.cost;
  return `<button class="card ${cant ? 'cant' : ''}" style="--cc:${COST_COLOR[u.cost]}" data-action="buy" data-i="${i}" title="눌러서 사기">
    <span class="info" data-action="shopinfo" data-i="${i}" title="자세히">i</span>
    <span class="cost">${u.cost}골드</span>
    <span class="pic">${charArt(char, 64)}</span>
    <span class="title">${char} ${esc(u.name)}</span>
    <span class="row">${chips(char)}</span>
    <span class="beats">♪ ${beatsOf(char)}박</span>
    ${band}
  </button>`;
}

function unitToken(uid: number, char: number, star: number, size: number) {
  const sel = selected?.kind === 'unit' && selected.uid === uid;
  return `<button class="unit ${sel ? 'sel' : ''}" data-action="unit" data-uid="${uid}" draggable="true">
    <span class="stars">${stars(star)}</span>${charArt(char, size, { star: star as 1 | 2 | 3 })}<span class="nm">${esc(UNITS[char].name)}</span>
  </button>`;
}

function boardHtml(p: PlayerState) {
  let html = '';
  for (const row of [0, 1] as const) {
    html += `<div class="rowlabel">${row === 0 ? '앞줄 (상대 쪽)' : '뒷줄'}</div>`;
    for (let col = 0; col < 5; col++) {
      const u = p.board.get(cellKey(row, col));
      const target = selected?.kind === 'unit' && !u ? 'target' : '';
      html += `<div class="cell ${row === 0 ? 'front' : ''} ${target}" data-action="cell" data-row="${row}" data-col="${col}">${u ? unitToken(u.uid, u.char, u.star, 54) : ''}</div>`;
    }
  }
  return html;
}

function benchHtml(p: PlayerState) {
  return p.bench
    .map((u, i) => {
      const target = selected?.kind === 'unit' && !u ? 'target' : '';
      return `<div class="cell ${target}" data-action="benchslot" data-i="${i}">${u ? unitToken(u.uid, u.char, u.star, 42) : ''}</div>`;
    })
    .join('');
}

function detailHtml(p: PlayerState) {
  if (!selected) return '';
  if (selected.kind === 'scout') return scoutHtml(selected.pid);
  let char: number;
  let star = 1;
  let owned: { uid: number; value: number } | null = null;
  if (selected.kind === 'shop') {
    const c = p.shop[selected.index];
    if (c === null) return '';
    char = c;
  } else {
    const f = findUnit(p, selected.uid);
    if (!f) return '';
    char = f.unit.char;
    star = f.unit.star;
    owned = { uid: f.unit.uid, value: sellValue(f.unit) };
  }
  const u = UNITS[char];
  const d = divisors(char);
  const pair = splitPair(char);
  const fams = familiesOf(char);
  return `<aside class="drawer">
    <button class="btn small ghost close" data-action="close">닫기</button>
    <div style="display:flex;gap:10px;align-items:center">${charArt(char, 84, { star: star as 1 | 2 | 3 })}
      <div><h3>${char} ${esc(u.name)}</h3><div class="sub">${esc(u.title)} · ${star}성 · ${u.cost}골드</div><div class="sub">"${esc(u.line)}"</div></div></div>
    <dl>
      <dt>가문</dt><dd>${fams.length ? fams.map((f) => `<div>${famIcon(f, 14)} <b>${FAMILIES[f].name}</b> — ${esc(FAMILIES[f].rule)}</div>`).join('') : '없음 (1은 2·3·5의 배수가 아니에요)'}</dd>
      <dt>직업</dt><dd>${roleIcon(u.role, 14)} <b>${ROLES[u.role].name}</b> — ${esc(ROLES[u.role].rule)}</dd>
      <dt>숨은 숫자</dt><dd>${esc(ART[char].hide)}</dd>
      <dt>노래 박</dt><dd>♪ ${[1, 2, 3, 4, 5].map((k) => char * k).filter((b) => b <= 48).join('·')}박 (${char}의 배수)</dd>
      <dt>노래</dt><dd>${esc(songText(u))}<br><small class="sub">값은 1성 / 2성 / 3성</small></dd>
      <dt>체력·공격</dt><dd>${u.hp * star} · ${u.atk * star} (${star}성)</dd>
      <dt>약수</dt><dd><div class="divs">${d.map((x) => `<span>${x}</span>`).join('')}</div><small class="sub">${d.length}개${d.length === 2 ? ' → 다이아' : d.length >= 6 ? ' → 부자' : ''}</small></dd>
      ${pair ? `<dt>쓰러지면</dt><dd>${fams.includes('rich') ? '부자 가문이 켜져 있으면 ' : '분신 주머니가 있으면 '}💥 ${pair[0]} + ${pair[1]} (${pair[0]} × ${pair[1]} = ${char})</dd>` : ''}
      <dt>남은 카드</dt><dd>${g!.pool[char]}장 남음</dd>
      <dt>아이템 칸</dt><dd>2칸 (끼우기는 곧 열려요)</dd>
    </dl>
    ${owned ? `<button class="btn" data-action="sell">팔기 (+${owned.value}골드)</button> <span class="sub">대기석·보드의 빈칸을 누르면 옮겨요</span>` : `<button class="btn gold" data-action="buy" data-i="${(selected as { index: number }).index}">사기 (${u.cost}골드)</button>`}
  </aside>`;
}

// ---------------- 상대 구경 ----------------
interface ScoutUnit { char: number; star: number; row: number; col: number }

function bestUnit(q: PlayerState) {
  const list = [...q.board.values()];
  const pool = list.length ? list : (q.bench.filter(Boolean) as NonNullable<(typeof q.bench)[number]>[]);
  return pool.slice().sort((a, b) => UNITS[b.char].cost * 3 ** (b.star - 1) - UNITS[a.char].cost * 3 ** (a.star - 1))[0] ?? null;
}

function scoutsHtml(p: PlayerState) {
  const o = opponentOf(g!, p.id);
  const vsId = o?.kind === 'pvp' ? o.id : null;
  const items = g!.players.map((q) => {
    const top = bestUnit(q);
    const av = top ? charArt(top.char, 30, { star: top.star, noNumber: true, noGems: true }) : '<span style="width:30px;text-align:center">🙂</span>';
    const vs = q.id === vsId;
    const tag = vs ? `<em>${o?.kind === 'pvp' && o.mirror ? '거울 상대' : '이번 상대'}</em>` : '';
    return `<button class="scout ${vs ? 'vs' : ''} ${q.id === p.id ? 'me' : ''}" data-action="scout" data-pid="${q.id}">${av}<span>${esc(q.id === p.id ? '나' : q.name)}</span>${tag}</button>`;
  });
  if (o?.kind === 'pve') items.push(`<button class="scout vs" data-action="scout" data-pid="-1">👾<span>${esc(o.name)}</span><em>이번 상대</em></button>`);
  return `<div class="scouts">${items.join('')}</div><span class="sub" style="color:var(--muted)">얼굴을 누르면 그 판을 구경해요</span>`;
}

function scoutHtml(pid: number): string {
  const p = me();
  let title: string;
  let units: ScoutUnit[];
  let note = '';
  if (pid === -1) {
    const o = opponentOf(g!, p.id);
    if (!o || o.kind !== 'pve') return '';
    title = `👾 ${o.name}`;
    units = o.board.map((b: BoardUnit) => ({ char: b.char, star: b.star, row: b.row, col: b.col }));
    note = '몬스터 라운드: 이기면 메달 2개와 2골드, 끝나면 보상 상자!';
  } else {
    const q = g!.players[pid];
    if (!q) return '';
    title = q.id === p.id ? '내 판' : q.name;
    units = [...q.board.entries()].map(([k, u]) => {
      const [row, col] = k.split(',').map(Number);
      return { char: u.char, star: u.star, row, col };
    });
    const o = opponentOf(g!, p.id);
    if (o?.kind === 'pvp' && o.id === q.id) note = '이번 상대예요! 어디에 누가 있는지 보고 내 판을 바꿔 봐요.';
    if (!units.length) note = '아직 판에 아무도 없어요.';
  }
  const at = (row: number, col: number) => units.find((u) => u.row === row && u.col === col);
  let grid = '';
  for (const row of [0, 1]) {
    grid += `<div class="lbl">${row === 0 ? '앞줄' : '뒷줄'}</div>`;
    for (let col = 0; col < 5; col++) {
      const u = at(row, col);
      grid += `<div class="sc">${u ? `<span class="st">${stars(u.star)}</span>${charArt(u.char, 52, { star: u.star as 1 | 2 | 3 })}` : ''}</div>`;
    }
  }
  const nums = new Set(units.map((u) => u.char));
  const famChips = FAM_ORDER.map((f) => {
    const c = [...nums].filter((n) => familiesOf(n).includes(f)).length;
    if (!c) return '';
    const on = tierOf(c, DEFAULT_CONFIG.famTiers[f]) > 0;
    return `<span class="chip ${on ? '' : 'dim'}" style="color:${FAM_COLOR[f]}">${famIcon(f, 14)}${FAMILIES[f].name} ${c}</span>`;
  }).join('');
  const roleChips = ROLE_ORDER.map((r) => {
    const c = [...nums].filter((n) => UNITS[n].role === r).length;
    if (!c) return '';
    const on = tierOf(c, DEFAULT_CONFIG.roleTiers) > 0;
    return `<span class="chip ${on ? '' : 'dim'}" style="color:${ROLE_COLOR[r]}">${roleIcon(r, 14)}${ROLES[r].name} ${c}</span>`;
  }).join('');
  return `<aside class="drawer">
    <button class="btn small ghost close" data-action="close">닫기</button>
    <h3>${esc(title)}</h3>
    ${note ? `<div class="sub">${esc(note)}</div>` : ''}
    <div class="sgrid">${grid}</div>
    <div class="sub">켜진 가문·직업 (흐린 건 아직 안 켜짐)</div>
    <div class="ssyn">${famChips}${roleChips || ''}</div>
  </aside>`;
}

// ---------------- 모달 ----------------
function modalHtml(): string {
  if (!g || modal?.type === 'start') {
    return `<div class="modal"><div class="box">
      <h2>숫자체스: 합창 대작전</h2>
      <p>숫자 친구를 사 모아 덱을 짜요. <b>3번 친구는 3단 박(3·6·9…)에 노래</b>하고, 같은 박에 여럿이 노래하면 <b>합창!</b> 가문은 숫자가, 직업은 캐릭터가 정해요.</p>
      <div class="choices">
        <button class="choice" data-action="start" data-bots="3" data-short="0"><b class="jua" style="font-size:20px">컴퓨터 3명과</b><br>12라운드 (약 12분)</button>
        <button class="choice" data-action="start" data-bots="1" data-short="0"><b class="jua" style="font-size:20px">컴퓨터 1명과</b><br>12라운드</button>
        <button class="choice" data-action="start" data-bots="3" data-short="1"><b class="jua" style="font-size:20px">짧은 판</b><br>8라운드 (약 8분)</button>
      </div>
      <p class="sub" style="color:var(--muted)">시험판: 컴퓨터는 아직 '쉬움'이에요. 숫자 돌 끼우기는 곧 열려요. <a href="./dogam.html" style="color:var(--gold)">캐릭터 도감 보기</a></p>
    </div></div>`;
  }
  if (battle) return '';
  const p = me();
  if (g.phase === 'freePick') {
    const c = g.freePick[p.id] ?? [];
    return `<div class="modal"><div class="box"><h2>첫 친구를 골라요</h2><p>1골드 친구 3명 중 1명을 공짜로 데려가요.</p>
      <div class="choices">${c.map((ch, i) => `<button class="choice" data-action="pick" data-i="${i}">${charArt(ch, 90)}<div class="jua" style="font-size:20px">${ch} ${esc(UNITS[ch].name)}</div><div class="row" style="justify-content:center;display:flex;gap:4px;flex-wrap:wrap">${chips(ch)}</div><div class="sub">♪ ${beatsOf(ch)}박</div></button>`).join('')}</div></div></div>`;
  }
  if (modal?.type === 'result') return resultHtml(modal.outcome);
  const reward = g.pendingRewards.find((r) => r.playerId === p.id);
  if (g.phase === 'reward' && reward) {
    return `<div class="modal"><div class="box"><h2>보상 고르기</h2><p>몬스터 라운드 보상이에요. 하나를 골라요. ${reward.options.length > 3 ? '<b>(상자 하나 더!)</b>' : ''}</p>
      <div class="choices">${reward.options.map((opt, i) => `<button class="choice" data-action="reward" data-i="${i}">🎁<br>${opt.map((it) => `<div>${ITEM_NAME[it]}</div>`).join('')}${reward.cardCost?.[i] ? `<div>${reward.cardCost[i]}골드 친구 1명</div>` : ''}</button>`).join('')}</div>
      <p class="sub" style="color:var(--muted)">돌은 가방에 들어가요. 친구에게 끼워 숫자를 바꾸는 건 곧 열려요.</p></div></div>`;
  }
  if (g.phase === 'over') {
    const r = ranking(g);
    const mine = p;
    const best = Math.max(0, ...mine.history.map((h) => h.medals));
    return `<div class="modal"><div class="box"><h2>게임 끝!</h2>
      <div class="hl">👑 1등: <b>${esc(r[0].name)}</b></div>
      <div class="hl">내 메달 <b class="jua" style="font-size:22px">${mine.medals}개</b> · 이긴 판 ${mine.wins}번 · 한 라운드 최고 메달 ${best}개</div>
      ${bestChorus ? `<div class="hl tip">🔎 오늘의 수학 발견: ${bestChorus.round}라운드 <b>${bestChorus.beat}박</b>에 ${[...bestChorus.nums].sort((a, b) => a - b).join('·')}가 함께 노래했어요 — 모두 ${bestChorus.beat}의 약수! <span class="sub">(${bestChorus.beat}의 약수: ${divisors(bestChorus.beat).join(', ')})</span></div>` : ''}
      <button class="btn gold" data-action="restart">새 게임</button></div></div>`;
  }
  return '';
}

function resultHtml(o: RoundOutcome) {
  const p = me();
  const fight = o.fights.find((f) => f.a === p.id || (!f.mirror && f.b === p.id));
  if (!fight) return '';
  const side = fight.a === p.id ? 0 : 1;
  const r = fight.result;
  const res = r.winner === 'draw' ? 'draw' : r.winner === side ? 'win' : 'loss';
  const oppLabel = side === 0 ? fight.label : g!.players[fight.a].name;
  const ins = battleInsight(r, side);
  const medals = o.medals[p.id] ?? 0;
  const gold = o.gold[p.id] ?? 0;
  const word = res === 'win' ? '<span class="win">이겼어요!</span>' : res === 'draw' ? '비겼어요' : '<span class="loss">아쉽게 졌어요</span>';
  const others = o.fights.filter((f) => f !== fight && !f.mirror).map((f) => `${esc(g!.players[f.a].name)} vs ${esc(f.label)}`).join(' · ');
  const log = `(나 = ${side === 0 ? 'A' : 'B'})\n` + formatBattleLog(r, { hideBasic: true });
  return `<div class="modal"><div class="box">
    <div class="sub" style="color:var(--muted)">${o.round}라운드 · ${o.kind === 'pve' ? '몬스터' : '친구 대결'} · 상대: ${esc(oppLabel)}</div>
    <h2>${word}</h2>
    <div class="hl">메달 <b class="jua" style="font-size:22px">+${medals}</b>${gold ? ` · 골드 +${gold}` : ''} · 전투 ${r.beats}박${r.timeout ? ' (시간 끝 판정)' : ''} · 살아남은 친구 ${r.survivors[side]}명</div>
    ${ins.badges.length ? `<div class="badges">${ins.badges.map((b) => `<span>${b}</span>`).join('')}</div>` : ''}
    ${ins.bigChorus ? `<div class="hl">🎵 가장 큰 합창: <b>${ins.bigChorus.beat}박</b>에 ${[...ins.bigChorus.nums].sort((a, b) => a - b).join('·')} — ${ins.bigChorus.count}명 몫! <span class="sub">(모두 ${ins.bigChorus.beat}의 약수)</span></div>` : ''}
    <div class="hl">🎬 결정적 장면: ${ins.best ? esc(momentText(ins.best, true)) : '우리 노래가 아직 약했어요'}${ins.foeBest ? `<br><span class="sub" style="color:var(--muted)">상대: ${esc(momentText(ins.foeBest, false))}</span>` : ''}</div>
    <div class="hl tip">💡 다음 판 팁: ${esc(ins.tip)}</div>
    ${others ? `<div class="sub" style="color:var(--muted)">다른 대결: ${others}</div>` : ''}
    <details><summary>전투 기록 보기 (글자)</summary><pre>${esc(log)}</pre></details>
    <p><button class="btn ghost" data-action="replay">↺ 전투 다시 보기</button> <button class="btn gold" data-action="next">다음 ▶</button></p>
  </div></div>`;
}

// ---------------- 그리기 ----------------
function render() {
  if (!g) {
    app.innerHTML = modalHtml();
    return;
  }
  const p = me();
  const plan = currentPlan(g);
  const inc = income(p);
  const syn = synPanels(p);
  const odds = SHOP_ODDS[p.level].map((x, i) => `${i + 1}골드 ${x}%`).join(' · ');
  const need = ECON.xpToNext[p.level];
  const center = battle
    ? `<div class="panel bv-host" id="bvhost"></div>`
    : `<div class="panel opp">${scoutsHtml(p)}</div>
      <div class="panel board">${boardHtml(p)}</div>
      <div class="cap">놓을 수 있는 자리 <b>${'●'.repeat(boardCount(p))}${'○'.repeat(Math.max(0, p.level - boardCount(p)))}</b> (레벨 ${p.level} → ${p.level}명) · 친구를 누르고 → 빈칸을 누르면 옮겨요</div>
      <div class="panel bench">${benchHtml(p)}</div>`;
  app.innerHTML = `
  <div class="app ${battle ? 'battling' : ''}">
    <header class="top">
      <div class="logo">숫자체스<small>합창 대작전</small></div>
      <div class="round"><b class="jua" style="font-size:20px">${g.round}라운드</b> <span class="sub" style="color:var(--muted)">(${g.rounds.length}라운드까지)</span>
        <span class="tag ${plan.kind}">${plan.kind === 'pve' ? '몬스터' : '친구 대결'}</span></div>
      <div class="stat">🏅<span class="big">${p.medals}</span><small>메달</small></div>
      <div class="stat">🪙<span class="big" style="color:var(--gold)">${p.gold}</span><small>다음 수입 = ${inc.base} + 저금 ${inc.interest}${inc.streak ? ` + ${p.winStreak >= 2 ? '연승' : '연패'} ${inc.streak}` : ''} = ${inc.total}</small></div>
      <div class="lv"><b class="jua" style="font-size:18px">레벨 ${p.level}</b>
        ${p.level < ECON.maxLevel ? `<span class="xpbar"><i style="width:${(100 * p.xp) / need}%"></i></span><small class="sub" style="color:var(--muted)">${p.xp}/${need}</small>
        <button class="btn small" data-action="xp" ${p.gold < ECON.xpCost ? 'disabled' : ''}>레벨업 +4 (4골드)</button>` : '<small>최고 레벨</small>'}</div>
      ${battle ? '<span class="ready tag" style="font-size:16px">🎵 전투 중…</span>' : '<button class="btn gold ready" data-action="ready">준비 완료 ▶</button>'}
    </header>
    <aside class="panel left">${syn.left}</aside>
    <section class="center">${center}</section>
    <aside class="panel right">${syn.right}</aside>
    <footer class="shopbar">
      <div class="panel"><div class="cards">${p.shop.map((_, i) => shopCard(p, i)).join('')}</div></div>
      <div class="panel side">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-action="reroll" ${p.gold < ECON.rerollCost ? 'disabled' : ''}>새로고침 (2골드)</button>
          <button class="btn ${p.shopLocked ? 'on' : 'ghost'}" data-action="lock">${p.shopLocked ? '🔒 잠김' : '🔓 잠금'}</button>
        </div>
        <div class="odds">레벨 ${p.level} 상점: ${odds}</div>
        <div class="bag">가방 (${p.bag.length}/${ECON.bagSize}): ${p.bag.length ? p.bag.map((b) => ITEM_NAME[b]).join(', ') : '비어 있음'}</div>
        <div class="sellzone" data-action="sellzone">여기로 끌어 놓으면 팔기 (산 값 그대로)</div>
      </div>
    </footer>
  </div>
  ${detailHtml(p)}
  ${modalHtml()}
  ${toastMsg ? `<div class="toast">${esc(toastMsg)}</div>` : ''}`;
  if (battle) document.getElementById('bvhost')?.appendChild(battle.root);
}

// ---------------- 행동 ----------------
function check(r: { ok: boolean; reason?: string }) {
  if (!r.ok && r.reason) toast(r.reason);
  return r.ok;
}

function newGame(bots: number, short: boolean) {
  g = createGame({ seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, bots, short });
  for (const p of g.players) if (p.isBot) botFreePick(g, p);
  selected = null;
  modal = null;
  botsPreppedRound = -1;
  bestChorus = null;
  battle?.stop();
  battle = null;
}

/** 컴퓨터는 라운드가 시작할 때 미리 배치한다(그래야 구경한 판 = 실제로 싸울 판) */
function prepBots() {
  if (!g || g.phase !== 'prep' || botsPreppedRound === g.round) return;
  for (const q of g.players) if (q.isBot) botPrep(g, q);
  botsPreppedRound = g.round;
}

function onReady() {
  if (!g || g.phase !== 'prep' || battle) return;
  unlockAudio();
  prepBots();
  const outcome = resolveRound(g);
  botRewards(g);
  selected = null;
  const p = me();
  const fight = outcome.fights.find((f) => f.a === p.id || (!f.mirror && f.b === p.id));
  if (fight) {
    const big = battleInsight(fight.result, fight.a === p.id ? 0 : 1).bigChorus;
    if (big && (!bestChorus || big.count > bestChorus.count)) bestChorus = { ...big, round: outcome.round };
  }
  startBattle(outcome);
}

function startBattle(outcome: RoundOutcome) {
  const p = me();
  const fight = outcome.fights.find((f) => f.a === p.id || (!f.mirror && f.b === p.id));
  modal = null;
  if (!fight) {
    modal = { type: 'result', outcome };
    return;
  }
  const side = fight.a === p.id ? 0 : 1;
  const oppName = side === 0 ? fight.label : g!.players[fight.a].name;
  battle?.stop();
  battle = new BattleView({
    result: fight.result,
    side,
    oppName,
    onDone: () => {
      battle?.stop();
      battle = null;
      modal = { type: 'result', outcome };
      render();
    },
  });
}

function slotFromEl(el: HTMLElement): Slot | null {
  const a = el.dataset.action;
  if (a === 'cell') return { kind: 'board', row: Number(el.dataset.row) as 0 | 1, col: Number(el.dataset.col) };
  if (a === 'benchslot') return { kind: 'bench', index: Number(el.dataset.i) };
  return null;
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const a = el.dataset.action!;
  if (a === 'start') {
    newGame(Number(el.dataset.bots), el.dataset.short === '1');
    return render();
  }
  if (!g || battle) return; // 전투 중에는 전투 화면 버튼만
  const p = me();
  switch (a) {
    case 'scout': {
      const pid = Number(el.dataset.pid);
      selected = selected?.kind === 'scout' && selected.pid === pid ? null : { kind: 'scout', pid };
      break;
    }
    case 'replay':
      if (modal?.type === 'result') {
        unlockAudio();
        startBattle(modal.outcome);
      }
      break;
    case 'shopinfo':
      ev.stopPropagation();
      selected = { kind: 'shop', index: Number(el.dataset.i) };
      break;
    case 'buy': {
      const i = Number(el.dataset.i);
      const char = p.shop[i];
      const r = buy(g, p, i);
      if (check(r)) {
        if (r.ok && r.merged) toast(`${UNITS[r.merged.char].name} ${r.merged.star}성 합체!`);
        else if (char !== null) toast(`${char} ${UNITS[char].name}을(를) 데려왔어요`);
        if (selected?.kind === 'shop') selected = null;
      }
      break;
    }
    case 'unit': {
      const uid = Number(el.dataset.uid);
      if (selected?.kind === 'unit' && selected.uid !== uid) {
        // 다른 친구를 누르면 자리 바꾸기
        const target = findUnit(p, uid);
        if (target) check(move(p, selected.uid, target.slot));
        selected = null;
      } else selected = selected?.kind === 'unit' && selected.uid === uid ? null : { kind: 'unit', uid };
      break;
    }
    case 'cell':
    case 'benchslot':
      if (selected?.kind === 'unit') {
        const slot = slotFromEl(el);
        if (slot && check(move(p, selected.uid, slot))) selected = null;
      }
      break;
    case 'sell':
      if (selected?.kind === 'unit') {
        const f = findUnit(p, selected.uid);
        if (f && check(sell(g, p, selected.uid))) toast(`${UNITS[f.unit.char].name}을(를) 팔았어요 (+${sellValue(f.unit)}골드)`);
        selected = null;
      }
      break;
    case 'close':
      selected = null;
      break;
    case 'reroll':
      check(reroll(g, p));
      break;
    case 'xp':
      check(buyXp(p));
      break;
    case 'lock':
      toggleLock(p);
      break;
    case 'ready':
      onReady();
      break;
    case 'pick':
      check(chooseFreePick(g, p, Number(el.dataset.i)));
      break;
    case 'next':
      modal = null;
      if (g.phase === 'prep') advance(g);
      break;
    case 'reward':
      check(chooseReward(g, p.id, Number(el.dataset.i)));
      advance(g);
      break;
    case 'restart':
      g = null;
      modal = { type: 'start' };
      break;
  }
  prepBots();
  render();
});

// 마우스 끌어 놓기(태블릿은 누르기 → 누르기)
app.addEventListener('dragstart', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-uid]');
  if (el && ev.dataTransfer) ev.dataTransfer.setData('text/plain', el.dataset.uid!);
});
app.addEventListener('dragover', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action="cell"],[data-action="benchslot"],[data-action="sellzone"],[data-action="unit"]');
  if (el) ev.preventDefault();
});
app.addEventListener('drop', (ev) => {
  ev.preventDefault();
  if (!g) return;
  const uid = Number(ev.dataTransfer?.getData('text/plain'));
  if (!uid) return;
  const p = me();
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'sellzone') {
    const f = findUnit(p, uid);
    if (f && check(sell(g, p, uid))) toast(`${UNITS[f.unit.char].name}을(를) 팔았어요 (+${sellValue(f.unit)}골드)`);
  } else if (el.dataset.action === 'unit') {
    const target = findUnit(p, Number(el.dataset.uid));
    if (target) check(move(p, uid, target.slot));
  } else {
    const cell = el.closest<HTMLElement>('[data-action="cell"],[data-action="benchslot"]');
    const slot = cell ? slotFromEl(cell) : null;
    if (slot) check(move(p, uid, slot));
  }
  selected = null;
  render();
});

render();

// 개발·테스트용: 콘솔에서 상태 보기
(window as unknown as { __game: () => GameState | null }).__game = () => g;
