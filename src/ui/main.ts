// 게임 화면: 상점·경제·합체·배치·라운드·메달, 가문/직업 판(늘 펼침), 두 겹 카드,
// 상대 판 구경, 박자 전투 장면(소리), 숫자 돌·보물 끼우기(미리보기 3줄 + 30박).
import './style.css';
import { DEFAULT_CONFIG, FAMILIES, ROLES, UNITS, UNIT_IDS, tierOf } from '../engine/data';
import { divisors, familiesOf, gcd, splitPair } from '../engine/math';
import { songText } from '../engine/describe';
import { formatBattleLog } from '../engine/log';
import type { BoardUnit, FamilyId, RoleId } from '../engine/types';
import {
  advance, boardCount, buy, buyXp, cellKey, chooseFreePick, chooseReward, createGame, currentPlan, findUnit,
  allUnits, income, move, opponentOf, ownedCount, ranking, reroll, resolveRound, sell, sellValue, toBattleBoard, toggleLock,
  type RoundOutcome,
} from '../game/game';
import { botFreePick, botPrep, botRewards } from '../game/bot';
import { ECON, SHOP_ODDS } from '../game/economy';
import {
  FAM_ORDER, ITEM_HELP, ITEM_LABEL, ITEM_NAME, ROLE_ORDER, checkItems, equip, isStoneItem, numberOf, previewEquip, secondSlotRound, slotCount,
  synergyOf, unequip,
} from '../game/items';
import type { BagItem, Difficulty, GameState, PlayerState, Slot, UnitInst } from '../game/types';
import { ART, charArt, famIcon, roleIcon } from './art/chars';
import { FAM_COLOR, ROLE_COLOR } from './art/parts';
import { BattleView } from './battle-view';
import { unlockAudio } from './sound';
import { battleInsight, momentText, type Moment } from './insight';
import { bindLoginInputs, handleLoginAction, loginBoxHtml, myRecord, refreshMe } from './login';
import { QUIZ, TUT_ROUNDS, TUT_STEPS, createTutorial, fixTutorialRewards, prepareTutorialRound, stepDone, tutorialAllows, type TutTalk } from '../game/tutorial';
import { readAloud } from './battle-view';
import { saveProgress } from '../net/api';
import { fetchGhosts, getAuth, saveGhost, saveRecord } from '../net/api';

// ---------------- 상태 ----------------
let g: GameState | null = null;
let selected:
  | { kind: 'unit'; uid: number }
  | { kind: 'shop'; index: number }
  | { kind: 'scout'; pid: number }
  | { kind: 'item'; index: number }
  | { kind: 'equip'; index: number; uid: number }
  | null = null;
let battle: BattleView | null = null;
let botsPreppedRound = -1;
/** 이번 판에서 만든 가장 큰 합창(게임 끝 '오늘의 수학 발견') */
let bestChorus: (Moment & { round: number }) | null = null;
/** 기록·유령 저장용: 라운드마다 내 판, 만난 친구, 3성, 변신 */
let myBoards: BoardUnit[][] = [];
const met = new Set<number>();
const three = new Set<number>();
const morphs = new Set<string>();
let recordSaved = false;
/** 튜토리얼 진행 */
let tut: {
  step: number;
  rerolled: boolean;
  selectedItem?: BagItem;
  said: Set<string>;
  /** 이 단계에 왔을 때 이미 해 둔 상태였으면 글만 읽고 [알겠어]로 넘김 */
  arrivedDone?: boolean;
  quiz?: { i: number; picked: number | null; score: number };
  finished?: boolean;
} | null = null;
const tutStep = () => (tut && !tut.finished ? TUT_STEPS[tut.step] : undefined);
const tutorialDoneLocal = () => {
  try {
    return localStorage.getItem('nc-tutorial-done') === '1';
  } catch {
    return false;
  }
};
let modal: { type: 'start' } | { type: 'result'; outcome: RoundOutcome } | null = { type: 'start' };
type StartDiff = Difficulty | 'mix';
let startDiff: StartDiff = 'easy';
try {
  const v = localStorage.getItem('nc_diff');
  if (v === 'easy' || v === 'normal' || v === 'hard' || v === 'mix') startDiff = v;
} catch {
  /* 기본 쉬움 */
}
const DIFF_LABEL: Record<Difficulty, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };
let toastMsg = '';
let toastTimer = 0;
const app = document.getElementById('app')!;
const me = () => g!.players[0];

const COST_COLOR = ['', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const stars = (n: number) => '★'.repeat(n);
/** 숫자 뒤 '와/과' (2·4·5·9로 끝나면 '와') */
const gwa = (n: number) => ([2, 4, 5, 9].includes(n % 10) ? '와' : '과');
const beatsOf = (n: number) => [1, 2, 3].map((k) => n * k).join('·') + '…';

function toast(msg: string) {
  toastMsg = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMsg = '';
    render();
  }, 2200);
}

// ---------------- 시너지 계산(보드 위 서로 다른 지금 숫자 / 서로 다른 캐릭터) ----------------
function synergy(p: PlayerState) {
  const s = synergyOf([...p.board.values()]);
  const bench = p.bench.filter((u): u is UnitInst => u !== null);
  return {
    fam: s.fam, role: s.role, boardNums: s.nums, boardChars: s.chars,
    benchNums: new Set(bench.map(numberOf)), benchChars: new Set(bench.map((u) => u.char)),
  };
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
    // 돌로 생긴 로스터 밖 숫자는 점선 칩
    const extra = [...s.boardNums, ...s.benchNums].filter((n, i, a) => !UNIT_IDS.includes(n) && familiesOf(n).includes(f) && a.indexOf(n) === i);
    return `<div class="syn ${tier ? 'on' : ''}" style="--c:${FAM_COLOR[f]}">
      <div class="synhead">${famIcon(f, 20)}<span class="nm">${FAMILIES[f].name}</span><span class="cnt">${count}명</span></div>
      <div class="rule">${esc(FAMILIES[f].rule)}</div>
      <div class="steps">${tiers.map((t, i) => `<span class="${count >= t ? 'lit' : ''}">${t}명 ${famEffect(f, i)}</span>`).join('')}</div>
      <div class="members">${members.map((n) => `<span class="${s.boardNums.has(n) ? 'mb-on' : s.benchNums.has(n) ? 'mb-wait' : ''}">${n}</span>`).join('')}${extra.map((n) => `<span class="mb-stone ${s.boardNums.has(n) ? 'mb-on' : 'mb-wait'}" title="숫자 돌로 생긴 숫자">${n}</span>`).join('')}</div>
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
  return `<button class="card ${cant ? 'cant' : ''}" style="--cc:${COST_COLOR[u.cost]}" data-action="buy" data-i="${i}" data-char="${char}" title="눌러서 사기">
    <span class="info" data-action="shopinfo" data-i="${i}" title="자세히">i</span>
    <span class="cost">${u.cost}골드</span>
    <span class="pic">${charArt(char, 64)}</span>
    <span class="title">${char} ${esc(u.name)}</span>
    <span class="row">${chips(char)}</span>
    <span class="beats">♪ ${beatsOf(char)}박</span>
    ${band}
  </button>`;
}

/** 손잡기: 붙은 친구와 최대공약수 2 이상이면 방패(최대공약수 × 12, 장갑이면 2배, 한 친구 최대 190) */
function handshakes(p: PlayerState): Map<number, { shield: number; with: { num: number; g: number }[] }> {
  const C = DEFAULT_CONFIG;
  const units = [...p.board.entries()].map(([k, u]) => ({ u, row: Number(k[0]), col: Number(k[2]), num: numberOf(u) }));
  const out = new Map<number, { shield: number; with: { num: number; g: number }[] }>();
  for (const a of units) {
    let sum = 0;
    const w: { num: number; g: number }[] = [];
    for (const b of units) {
      if (a === b || Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) continue;
      const gg = gcd(a.num, b.num);
      if (gg < 2) continue;
      sum += gg * C.handshakePerGcd * (a.u.items.includes('glove') || b.u.items.includes('glove') ? 2 : 1);
      w.push({ num: b.num, g: gg });
    }
    if (sum) out.set(a.u.uid, { shield: Math.min(C.handshakeCap, sum), with: w });
  }
  return out;
}

function unitToken(u: UnitInst, size: number, hs?: { shield: number }) {
  const sel = (selected?.kind === 'unit' || selected?.kind === 'equip') && selected.uid === u.uid;
  let tag = '';
  if (selected?.kind === 'item' && g) {
    const item = me().bag[selected.index];
    if (item !== undefined) {
      const pv = previewEquip(g, me(), u, item);
      tag = pv.ok ? `<span class="pvtag ok">${pv.from === pv.to ? '✓' : `→${pv.to}`}</span>` : '<span class="pvtag no">✕</span>';
    }
  }
  const items = u.items.length ? `<span class="uitems">${u.items.map((it) => `<i>${ITEM_LABEL[it]}</i>`).join('')}</span>` : '';
  const hand = hs ? `<span class="hstag" title="손잡기 방패">🤝${hs.shield}</span>` : '';
  return `<button class="unit ${sel ? 'sel' : ''}" data-action="unit" data-uid="${u.uid}" draggable="true">
    <span class="stars">${stars(u.star)}</span>${charArt(u.char, size, { star: u.star, num: numberOf(u) })}<span class="nm">${esc(UNITS[u.char].name)}</span>${items}${tag}${hand}
  </button>`;
}

function boardHtml(p: PlayerState) {
  const hs = handshakes(p);
  let html = '';
  for (const row of [0, 1] as const) {
    html += `<div class="rowlabel">${row === 0 ? '앞줄 (상대 쪽)' : '뒷줄'}</div>`;
    for (let col = 0; col < 5; col++) {
      const u = p.board.get(cellKey(row, col));
      const target = selected?.kind === 'unit' && !u ? 'target' : '';
      html += `<div class="cell ${row === 0 ? 'front' : ''} ${target}" data-action="cell" data-row="${row}" data-col="${col}">${u ? unitToken(u, 54, hs.get(u.uid)) : ''}</div>`;
    }
  }
  return html;
}

function benchHtml(p: PlayerState) {
  return p.bench
    .map((u, i) => {
      const target = selected?.kind === 'unit' && !u ? 'target' : '';
      return `<div class="cell ${target}" data-action="benchslot" data-i="${i}">${u ? unitToken(u, 42) : ''}</div>`;
    })
    .join('');
}

function detailHtml(p: PlayerState) {
  if (!selected) return '';
  if (selected.kind === 'scout') return scoutHtml(selected.pid);
  if (selected.kind === 'item') return itemHtml(p, selected.index);
  if (selected.kind === 'equip') return equipHtml(p, selected.index, selected.uid);
  let char: number;
  let star = 1;
  let owned: { uid: number; value: number; unit: UnitInst } | null = null;
  if (selected.kind === 'shop') {
    const c = p.shop[selected.index];
    if (c === null) return '';
    char = c;
  } else {
    const f = findUnit(p, selected.uid);
    if (!f) return '';
    char = f.unit.char;
    star = f.unit.star;
    owned = { uid: f.unit.uid, value: sellValue(f.unit), unit: f.unit };
  }
  const u = UNITS[char];
  const num = owned ? numberOf(owned.unit) : char;
  const d = divisors(num);
  const pair = splitPair(num);
  const fams = familiesOf(num);
  const open = slotCount(g!);
  const slotsHtml = owned
    ? [0, 1].map((i) => {
        const it = owned!.unit.items[i];
        if (it !== undefined) return `<span class="islot full" title="${esc(ITEM_HELP[it])}">${ITEM_LABEL[it]} ${esc(ITEM_NAME[it])} <button class="btn small ghost" data-action="unequip" data-slot="${i}">빼기</button></span>`;
        return i < open ? '<span class="islot">빈 칸 — 가방의 돌을 눌러 끼워요</span>' : `<span class="islot lock">🔒 ${secondSlotRound(g!)}라운드에 열려요</span>`;
      }).join('')
    : '<span class="sub">사서 데려오면 칸 2개(두 번째는 6라운드부터)</span>';
  return `<aside class="drawer">
    <button class="btn small ghost close" data-action="close">닫기</button>
    <div style="display:flex;gap:10px;align-items:center">${charArt(char, 84, { star: star as 1 | 2 | 3, num })}
      <div><h3>${num !== char ? `${char} → <span style="color:#ffe27a">${num}</span>` : char} ${esc(u.name)}</h3><div class="sub">${esc(u.title)} · ${star}성 · ${u.cost}골드</div><div class="sub">"${esc(u.line)}"</div></div></div>
    <dl>
      <dt>가문</dt><dd>${fams.length ? fams.map((f) => `<div>${famIcon(f, 14)} <b>${FAMILIES[f].name}</b> — ${esc(FAMILIES[f].rule)}</div>`).join('') : '없음 (1은 2·3·5의 배수가 아니에요)'}</dd>
      <dt>직업</dt><dd>${roleIcon(u.role, 14)} <b>${ROLES[u.role].name}</b> — ${esc(ROLES[u.role].rule)}</dd>
      <dt>숨은 숫자</dt><dd>${esc(ART[char].hide)}</dd>
      ${num !== char ? `<dt>지금 숫자</dt><dd>${esc(owned ? numberExpr(owned.unit) : '')} <small class="sub">(모습·직업·성은 그대로)</small></dd>` : ''}
      <dt>노래 박</dt><dd>♪ ${[1, 2, 3, 4, 5].map((k) => num * k).filter((b) => b <= 48).join('·')}박 (${num}의 배수)</dd>
      <dt>노래</dt><dd>${esc(songText({ ...u, n: num }))}<br><small class="sub">값은 1성 / 2성 / 3성</small></dd>
      <dt>체력·공격</dt><dd>${u.hp * star} · ${u.atk * star} (${star}성)</dd>
      <dt>약수</dt><dd><div class="divs">${d.map((x) => `<span>${x}</span>`).join('')}</div><small class="sub">${d.length}개${d.length === 2 ? ' → 다이아' : d.length >= 6 ? ' → 부자' : ''}</small></dd>
      ${pair ? `<dt>쓰러지면</dt><dd>${fams.includes('rich') ? '부자 가문이 켜져 있으면 ' : '분신 주머니가 있으면 '}💥 ${pair[0]} + ${pair[1]} (${pair[0]} × ${pair[1]} = ${num})</dd>` : ''}
      <dt>남은 카드</dt><dd>${g!.pool[char]}장 남음</dd>
      ${owned && handshakes(p).get(owned.unit.uid) ? `<dt>손잡기</dt><dd>${handshakes(p).get(owned.unit.uid)!.with.map((w) => `🤝 ${num}${gwa(num)} ${w.num}: 최대공약수 ${w.g}`).join('<br>')}<br>→ 방패 <b>${handshakes(p).get(owned.unit.uid)!.shield}</b> <small class="sub">(최대공약수 × ${DEFAULT_CONFIG.handshakePerGcd})</small></dd>` : ''}
      <dt>아이템 칸</dt><dd class="islots">${slotsHtml}</dd>
    </dl>
    ${owned ? `<button class="btn" data-action="sell">팔기 (+${owned.value}골드)</button> <span class="sub">대기석·보드의 빈칸을 누르면 옮겨요</span>` : `<button class="btn gold" data-action="buy" data-i="${(selected as { index: number }).index}">사기 (${u.cost}골드)</button>`}
  </aside>`;
}

// ---------------- 숫자 돌 ----------------
function numberExpr(u: UnitInst): string {
  return checkItems(u.char, u.items).expr;
}

function itemHtml(p: PlayerState, index: number): string {
  const it = p.bag[index];
  if (it === undefined) return '';
  return `<aside class="drawer small">
    <button class="btn small ghost close" data-action="close">닫기</button>
    <h3>${ITEM_LABEL[it]} ${esc(ITEM_NAME[it])}</h3>
    <div class="sub">${esc(ITEM_HELP[it])}</div>
    <p>끼울 친구를 눌러요. 친구 위에 <b class="pvtag ok" style="position:static">→10</b> 처럼 바뀔 숫자가 보이고, <b class="pvtag no" style="position:static">✕</b>는 끼울 수 없어요.</p>
    <div class="sub">준비 시간에는 언제든 공짜로 빼고 바꿀 수 있어요. 돌은 써도 없어지지 않아요.</div>
  </aside>`;
}

function famChangeText(c: { fam: FamilyId; before: number; after: number; tierBefore: number; tierAfter: number }) {
  const tiers = DEFAULT_CONFIG.famTiers[c.fam];
  const note = c.tierAfter > c.tierBefore ? `<b class="up">(${tiers[c.tierAfter - 1]}명 효과 켜짐!)</b>` : c.tierAfter < c.tierBefore ? `<b class="down">(${tiers[c.tierBefore - 1]}명 효과 꺼짐)</b>` : '(효과는 그대로)';
  return `<div>${famIcon(c.fam, 14)} ${FAMILIES[c.fam].name} ${c.before}명 → ${c.after}명 ${note}</div>`;
}

function equipHtml(p: PlayerState, index: number, uid: number): string {
  const it = p.bag[index];
  const f = findUnit(p, uid);
  if (it === undefined || !f) return '';
  const u = f.unit;
  const pv = previewEquip(g!, p, u, it);
  const head = `<button class="btn small ghost close" data-action="close">닫기</button>
    <h3>${ITEM_LABEL[it]} ${esc(ITEM_NAME[it])} → ${esc(UNITS[u.char].name)}</h3>`;
  if (!pv.ok) {
    return `<aside class="drawer">${head}<div class="pv-big bad">✕ 끼울 수 없어요</div><div class="hl">${esc(pv.reason ?? '')}</div>
      <button class="btn ghost" data-action="close">다른 친구 고르기</button></aside>`;
  }
  const gems = pv.gained.map((x) => `<span class="chip" style="color:${FAM_COLOR[x]}">+ ${famIcon(x, 13)}${FAMILIES[x].name}</span>`)
    .concat(pv.lost.map((x) => `<span class="chip lost" style="color:${FAM_COLOR[x]}">− ${famIcon(x, 13)}${FAMILIES[x].name}</span>`)).join(' ');
  const song = pv.song
    ? `<div class="pv-song">30박 동안: 노래 ${pv.song.before[0]}번 × ${pv.song.before[1]} = <b>${pv.song.before[0] * pv.song.before[1]}</b> → ${pv.song.after[0]}번 × ${pv.song.after[1]} = <b>${pv.song.after[0] * pv.song.after[1]}</b><br><small>(30 ÷ 숫자 = 노래 횟수, 숫자 × ${UNITS[u.char].coef}${u.star > 1 ? ` × ${u.star}성` : ''} = 한 번 크기)</small></div>`
    : '';
  return `<aside class="drawer">${head}
    <div class="pv-arts">${charArt(u.char, 74, { star: u.star, num: pv.from })}<span class="pv-big">${pv.from} → ${pv.to}</span>${charArt(u.char, 74, { star: u.star, num: pv.to })}</div>
    <div class="sub" style="text-align:center">${esc(pv.expr)}</div>
    <div class="pv-line"><b>① 이 친구 보석</b> ${gems || '<span class="sub">보석은 그대로</span>'}</div>
    <div class="pv-line"><b>② 가문 판</b> ${pv.onBoard ? (pv.board.length ? pv.board.map(famChangeText).join('') : '<span class="sub">바뀌는 줄이 없어요</span>') : '<span class="sub">대기석 친구는 가문에 세지 않아요(보드에 올리면 세요)</span>'}</div>
    <div class="pv-line"><b>③ 노래</b> ♪ ${[1, 2, 3].map((k) => pv.to * k).join('·')}…박</div>
    ${song}
    ${pv.warnings.map((w) => `<div class="pv-warn">⚠ ${esc(w)}</div>`).join('')}
    <p><button class="btn gold" data-action="equipok">끼우기</button> <button class="btn ghost" data-action="close">취소</button></p>
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
    const diff = q.ghost ? '<small class="dtag">유령</small>' : q.isBot ? `<small class="dtag">${DIFF_LABEL[q.difficulty]}</small>` : '';
    return `<button class="scout ${vs ? 'vs' : ''} ${q.id === p.id ? 'me' : ''}" data-action="scout" data-pid="${q.id}">${av}<span>${esc(q.id === p.id ? '나' : q.name.replace('컴퓨터 ', ''))}</span>${diff}${tag}</button>`;
  });
  if (o?.kind === 'pve') items.push(`<button class="scout vs" data-action="scout" data-pid="-1">👾<span>${esc(o.name)}</span><em>이번 상대</em></button>`);
  return `<div class="scouts" title="얼굴을 누르면 그 판을 구경해요">${items.join('')}</div><span class="sub" style="color:var(--muted);flex:none">👀 눌러서 구경</span>`;
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
      ${loginBoxHtml()}
      <p>숫자 친구를 사 모아 덱을 짜요. <b>3번 친구는 3단 박(3·6·9…)에 노래</b>하고, 같은 박에 여럿이 노래하면 <b>합창!</b> 가문은 숫자가, 직업은 캐릭터가 정해요.</p>
      ${tutorialDoneLocal() || myRecord()?.tutorial
        ? '<p style="margin:6px 0"><button class="btn small ghost" data-action="tutorial">📖 튜토리얼 다시 하기</button></p>'
        : '<button class="choice tutbtn" data-action="tutorial"><b class="jua" style="font-size:22px">📖 처음이라면: 튜토리얼 한 판</b><br>하나쌤과 5라운드 (약 7분) — 규칙을 하나씩 해 보며 배워요</button>'}
      <div class="diffs">컴퓨터 난이도
        ${([['easy', '쉬움', '똑딱이 · 처음이라면'], ['normal', '보통', '척척이 · 가문을 노려요'], ['hard', '어려움', '번뜩이 · 미리 싸워 보고 골라요'], ['mix', '섞어서', '쉬움·보통·어려움 한 명씩']] as [StartDiff, string, string][])
          .map(([d, nm, sub]) => `<button class="diff ${startDiff === d ? 'on' : ''}" data-action="diff" data-d="${d}"><b class="jua">${nm}</b><small>${sub}</small></button>`).join('')}
      </div>
      <div class="choices">
        <button class="choice" data-action="start" data-bots="3" data-short="0"><b class="jua" style="font-size:20px">컴퓨터 3명과</b><br>12라운드 (약 12분)</button>
        <button class="choice" data-action="start" data-bots="1" data-short="0"><b class="jua" style="font-size:20px">컴퓨터 1명과</b><br>12라운드</button>
        <button class="choice" data-action="start" data-bots="3" data-short="1"><b class="jua" style="font-size:20px">짧은 판</b><br>8라운드 (약 8분)</button>
        ${getAuth() ? '<button class="choice" data-action="startghost"><b class="jua" style="font-size:20px">👻 친구 유령과</b><br>우리 학교 친구가 둔 판</button>' : ''}
      </div>
      <p class="sub" style="color:var(--muted)">몬스터를 이기면 숫자 돌을 받아요. 돌을 친구에게 끼우면 숫자가 바뀌어요. <a href="./dogam.html" style="color:var(--gold)">캐릭터 도감 보기</a></p>
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
  if (tut?.finished) return tutorialEndHtml();
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
    : `${tutDocked() ? `<div class="panel tut dock">${tutBubbleInner()}</div>` : `<div class="panel opp">${scoutsHtml(p)}</div>`}
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
        <div class="bag">가방 (${p.bag.length}/${ECON.bagSize}) <span class="sub" style="color:var(--muted)">${p.bag.length ? '돌을 누르고 → 친구를 눌러요' : '몬스터를 이기면 돌을 받아요'}</span>
          <div class="bagitems">${p.bag.map((it, i) => `<button class="item ${isStoneItem(it) ? 'stone' : 'treasure'} ${(selected?.kind === 'item' || selected?.kind === 'equip') && selected.index === i ? 'sel' : ''}" data-action="bagitem" data-i="${i}" draggable="true" title="${esc(ITEM_NAME[it])}: ${esc(ITEM_HELP[it])}">${ITEM_LABEL[it]}</button>`).join('')}</div></div>
        <div class="sellzone" data-action="sellzone">여기로 끌어 놓으면 팔기 (산 값 그대로)</div>
      </div>
    </footer>
  </div>
  ${detailHtml(p)}
  ${modalHtml()}
  ${toastMsg ? `<div class="toast">${esc(toastMsg)}</div>` : ''}`;
  if (battle) document.getElementById('bvhost')?.appendChild(battle.root);
  const step = tutStep();
  if (step && tutBubbleVisible()) {
    if (step.afterBattle) app.insertAdjacentHTML('beforeend', `<div class="tut float">${tutBubbleInner()}</div>`);
    if (step.highlight) document.querySelectorAll(step.highlight).forEach((el) => el.classList.add('tut-hl'));
  }
}

// ---------------- 행동 ----------------
function check(r: { ok: boolean; reason?: string }) {
  if (!r.ok && r.reason) toast(r.reason);
  return r.ok;
}

function newGame(bots: number, short: boolean) {
  const mix: Difficulty[] = ['easy', 'normal', 'hard'];
  const difficulties = Array.from({ length: bots }, (_, i) => (startDiff === 'mix' ? mix[i % 3] : startDiff));
  g = createGame({ seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, bots, short, difficulties });
  for (const p of g.players) if (p.isBot) botFreePick(g, p);
  selected = null;
  modal = null;
  botsPreppedRound = -1;
  bestChorus = null;
  myBoards = [];
  met.clear();
  three.clear();
  morphs.clear();
  recordSaved = false;
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
  if (tut) fixTutorialRewards(g);
  else botRewards(g);
  selected = null;
  const p = me();
  myBoards.push(toBattleBoard(p));
  for (const u of p.board.values()) if (numberOf(u) !== u.char) morphs.add(`${u.char}>${numberOf(u)}`);
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
    speed: tut ? 0.5 : undefined,
    talk: tut ? tutorialTalk(outcome.round) : undefined,
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
  if (handleLoginAction(a, el, render)) return;
  if (a === 'startghost') {
    void startGhostGame();
    return;
  }
  if (a === 'diff') {
    startDiff = el.dataset.d as StartDiff;
    try {
      localStorage.setItem('nc_diff', startDiff);
    } catch {
      /* 무시 */
    }
    return render();
  }
  if (a === 'start') {
    newGame(Number(el.dataset.bots), el.dataset.short === '1');
    return render();
  }
  if (a === 'tutorial') {
    startTutorial();
    return render();
  }
  if (a === 'tutok' || a === 'quiz' || a === 'tutfinish' || a === 'tutread') {
    tutorialAction(a, el);
    return render();
  }
  if (!g || battle) return; // 전투 중에는 전투 화면 버튼만
  const p = me();
  if (tut) {
    const char = a === 'buy' ? p.shop[Number(el.dataset.i)] ?? undefined : undefined;
    const block = tutorialAllows(tutStep(), a, char);
    if (block) {
      toast(block);
      return render();
    }
    if (a === 'next' && tutStep()?.afterBattle) {
      toast('하나쌤 말풍선을 먼저 읽고 [알겠어]를 눌러 봐!');
      return render();
    }
  }
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
    case 'bagitem': {
      const i = Number(el.dataset.i);
      if (tut) tut.selectedItem = p.bag[i];
      selected = (selected?.kind === 'item' || selected?.kind === 'equip') && selected.index === i ? null : { kind: 'item', index: i };
      break;
    }
    case 'equipok':
      if (selected?.kind === 'equip') {
        const f = findUnit(p, selected.uid);
        const before = f ? numberOf(f.unit) : 0;
        if (f) {
          const r = equip(g, p, f.unit, selected.index);
          if (r.ok) {
            const after = numberOf(f.unit);
            toast(before === after ? `${UNITS[f.unit.char].name}에게 끼웠어요` : `${UNITS[f.unit.char].name}: ${before} → ${after}!`);
            selected = { kind: 'unit', uid: f.unit.uid };
          } else toast(r.reason);
        }
      }
      break;
    case 'unequip':
      if (selected?.kind === 'unit') {
        const f = findUnit(p, selected.uid);
        if (f) check(unequip(p, f.unit, Number(el.dataset.slot)));
      }
      break;
    case 'unit': {
      const uid = Number(el.dataset.uid);
      if (selected?.kind === 'item' || selected?.kind === 'equip') {
        selected = { kind: 'equip', index: selected.index, uid };
        break;
      }
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
      if (check(reroll(g, p)) && tut) tut.rerolled = true;
      break;
    case 'xp':
      check(buyXp(p));
      break;
    case 'lock':
      toggleLock(p);
      break;
    case 'ready':
      onReady();
      if (tut && battle && tutStep()?.expect.kind === 'ready') nextTutStep();
      break;
    case 'pick':
      check(chooseFreePick(g, p, Number(el.dataset.i)));
      break;
    case 'next':
      modal = null;
      if (g.phase === 'prep') {
        advance(g);
        if (tut) prepareTutorialRound(g);
      }
      break;
    case 'reward':
      check(chooseReward(g, p.id, Number(el.dataset.i)));
      advance(g);
      if (tut) prepareTutorialRound(g);
      break;
    case 'restart':
      g = null;
      modal = { type: 'start' };
      break;
  }
  prepBots();
  track();
  tutorialCheck();
  render();
});

// ---------------- 튜토리얼 ----------------
function startTutorial() {
  battle?.stop();
  battle = null;
  g = createTutorial();
  tut = { step: 0, rerolled: false, said: new Set() };
  selected = null;
  modal = null;
  botsPreppedRound = -1;
  bestChorus = null;
  myBoards = [];
  recordSaved = true; // 튜토리얼은 기록·유령에 넣지 않음
}

/** 다음 단계로: 이미 해 둔 상태면 글을 읽을 수 있게 [알겠어]로 바꾼다 */
function nextTutStep() {
  if (!tut || !g) return;
  tut.step++;
  tut.rerolled = false;
  tut.selectedItem = undefined;
  const s = tutStep();
  tut.arrivedDone = !!s && !['ok', 'ready', 'selectItem', 'reroll'].includes(s.expect.kind) && stepDone(g, s, {});
}

/** 행동 단계가 이루어졌으면 다음 단계로(여러 개 한꺼번에도) */
function tutorialCheck() {
  if (!tut || !g) return;
  for (;;) {
    const s = tutStep();
    if (!s || s.round !== g.round || ['ok', 'ready'].includes(s.expect.kind) || tut.arrivedDone) break;
    if (!stepDone(g, s, { selectedItem: tut.selectedItem, rerolled: tut.rerolled })) break;
    nextTutStep();
  }
}

function tutBubbleVisible(): boolean {
  const s = tutStep();
  if (!s || !g || battle) return false;
  if (s.afterBattle) return modal?.type === 'result';
  return g.phase === 'prep' && !modal && s.round === g.round;
}

/** 준비 화면에서는 말풍선이 가운데 위(구경 줄 자리)에 끼어 들어가 아무것도 가리지 않는다 */
const tutDocked = () => {
  const s = tutStep();
  return !!s && !s.afterBattle && tutBubbleVisible();
};

function tutBubbleInner(): string {
  const s = tutStep()!;
  const action = s.expect.kind === 'ok' || !!tut!.arrivedDone;
  return `<div class="who">${charArt(1, 46, { noNumber: true, noGems: true })}</div>
    <div class="txt">${esc(s.text)}${action ? '' : '<small>👆 반짝이는 곳을 눌러 해 봐!</small>'}</div>
    <div class="btns"><span class="prog">${s.round}/5라운드 · ${tut!.step + 1}/${TUT_STEPS.length}</span>
      <button class="btn small ghost" data-action="tutread" title="읽어 주기">🔊</button>${g && currentPlan(g)?.kind === 'pve' && s.id === 'boss' ? ' <button class="btn small ghost" data-action="scout" data-pid="-1">👀 로봇 판</button>' : ''}${action ? ' <button class="btn small gold" data-action="tutok">알겠어 ▶</button>' : ''}</div>`;
}

/** 전투 중 하나쌤 대사(라운드 대본) */
function tutorialTalk(round: number) {
  const talk: TutTalk[] = TUT_ROUNDS[round]?.talk ?? [];
  return (beat: number, evs: import('../engine/types').BattleEvent[], v: { side: 0 | 1; result: import('../engine/battle').BattleResult }) => {
    const out: string[] = [];
    const team = (id: number) => v.result.fighters.find((f) => f.id === id)?.team;
    talk.forEach((t, i) => {
      const key = `${round}:${i}`;
      if (tut?.said.has(key)) return;
      const hit =
        (t.beat !== undefined && t.beat === beat) ||
        (t.on === 'rehearsal' && evs.some((e) => e.type === 'song' && e.rehearsal)) ||
        (t.on === 'split' && evs.some((e) => e.type === 'split' && team(e.unit) !== v.side)) ||
        (t.on === 'stunMine' && evs.some((e) => e.type === 'stun' && team(e.tgt) === v.side));
      if (hit) {
        tut?.said.add(key);
        out.push(t.text);
      }
    });
    return out;
  };
}

function tutorialAction(a: string, el: HTMLElement) {
  if (!tut) return;
  if (a === 'tutread') {
    const s = tutStep();
    if (s) readAloud(s.text);
    return;
  }
  if (a === 'tutok') {
    const s = tutStep();
    if (s?.expect.kind === 'ok' || tut.arrivedDone) nextTutStep();
    if (tut.step >= TUT_STEPS.length) {
      tut.finished = true;
      tut.quiz = { i: 0, picked: null, score: 0 };
      modal = null;
    }
    tutorialCheck();
    return;
  }
  if (a === 'quiz' && tut.quiz) {
    const q = tut.quiz;
    if (q.picked === null) {
      q.picked = Number(el.dataset.i);
      if (q.picked === QUIZ[q.i].answer) q.score++;
    } else {
      q.i++;
      q.picked = null;
    }
    return;
  }
  if (a === 'tutfinish') {
    try {
      localStorage.setItem('nc-tutorial-done', '1');
    } catch {
      /* 무시 */
    }
    void saveProgress({ tutorialDone: true });
    const next = el.dataset.next;
    tut = null;
    g = null;
    modal = { type: 'start' };
    if (next === 'easy1') {
      startDiff = 'easy';
      newGame(1, false);
    }
  }
}

function tutorialEndHtml(): string {
  const q = tut!.quiz!;
  if (q.i < QUIZ.length) {
    const item = QUIZ[q.i];
    return `<div class="modal"><div class="box quiz"><h2>마무리 퀴즈 ${q.i + 1}/${QUIZ.length}</h2>
      <div class="q">${esc(item.q)}</div>
      <div class="opts">${item.choices.map((c, i) => `<button class="choice opt ${q.picked !== null ? (i === item.answer ? 'ok' : i === q.picked ? 'no' : '') : ''}" data-action="quiz" data-i="${i}">${esc(c)}</button>`).join('')}</div>
      ${q.picked !== null ? `<div class="hl">${q.picked === item.answer ? '정답! ' : '아쉬워요. '}${esc(item.why)}</div><p><button class="btn gold" data-action="quiz">다음 ▶</button></p>` : ''}
    </div></div>`;
  }
  return `<div class="modal"><div class="box"><h2>🎉 칭호: 합창단 새 단원!</h2>
    <div class="hl">튜토리얼을 마쳤어요. 퀴즈 ${q.score}/${QUIZ.length}개 맞혔어요.</div>
    <div class="hl tip">세 줄만 기억해! ① 3번 친구는 3단 박에 노래 ② 같은 박이면 합창 ③ 가문은 숫자가, 직업은 캐릭터가</div>
    <p><button class="btn gold" data-action="tutfinish" data-next="easy1">컴퓨터 1명과 한 판 (쉬움) ▶</button> <button class="btn ghost" data-action="tutfinish">처음 화면</button></p>
  </div></div>`;
}

/** 만난 친구·3성 모으기, 판이 끝나면 기록·유령 저장(들어가 있을 때만) */
function track() {
  if (!g) return;
  for (const u of allUnits(me())) {
    met.add(u.char);
    if (u.star === 3) three.add(u.char);
  }
  if (g.phase === 'over' && !recordSaved && getAuth()) {
    recordSaved = true;
    const rank = ranking(g).findIndex((q) => q.id === 0) + 1;
    void saveRecord({
      rank, players: g.players.length, medals: me().medals,
      bestChorus: bestChorus ? { beat: bestChorus.beat, nums: bestChorus.nums, count: bestChorus.count } : null,
      collection: { met: [...met], three: [...three], morphs: [...morphs] },
    }).then(() => refreshMe());
    if (myBoards.length && !g.players.some((q) => q.ghost)) void saveGhost(myBoards, me().level);
  }
}

async function startGhostGame() {
  const r = await fetchGhosts(3);
  if (!r.ok || !r.ghosts.length) {
    toast(r.ok ? '아직 우리 학교 친구 유령이 없어요. 친구들이 한 판씩 하면 생겨요!' : (r.error ?? '유령을 불러오지 못했어요.'));
    return render();
  }
  newGame(r.ghosts.length, false);
  r.ghosts.forEach((gh, i) => {
    const q = g!.players[i + 1];
    q.ghost = gh.rounds;
    q.name = `👻 ${gh.nick}`;
  });
  render();
}

// 마우스 끌어 놓기(태블릿은 누르기 → 누르기)
app.addEventListener('dragstart', (ev) => {
  const it = (ev.target as HTMLElement).closest<HTMLElement>('[data-action="bagitem"]');
  if (it && ev.dataTransfer) {
    ev.dataTransfer.setData('text/plain', `item:${it.dataset.i}`);
    return;
  }
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-uid]');
  if (el && ev.dataTransfer) ev.dataTransfer.setData('text/plain', el.dataset.uid!);
});
app.addEventListener('dragover', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action="cell"],[data-action="benchslot"],[data-action="sellzone"],[data-action="unit"]');
  if (el) ev.preventDefault();
});
app.addEventListener('drop', (ev) => {
  ev.preventDefault();
  if (!g || battle) return;
  const data = ev.dataTransfer?.getData('text/plain') ?? '';
  if (data.startsWith('item:')) {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-action="unit"]');
    if (target) {
      selected = { kind: 'equip', index: Number(data.slice(5)), uid: Number(target.dataset.uid) };
      render();
    }
    return;
  }
  const uid = Number(data);
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

bindLoginInputs(app);
void refreshMe().then(() => render());
render();

// 개발·테스트용: 콘솔에서 상태 보기
(window as unknown as { __game: () => GameState | null }).__game = () => g;
