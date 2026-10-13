import { ROLES } from '../engine/data';
import { META_DECKS } from '../sim/decks';
import { TARGETS, type FieldReport, type PowerReport } from '../sim/arena';
import type { WorkerRequest, WorkerResponse } from './worker';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const send = (m: WorkerRequest) => worker.postMessage(m);

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const inRange = (x: number, r: readonly [number, number]) => x >= r[0] && x <= r[1];
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function tile(label: string, value: string, ok: boolean, hint: string) {
  return `<div class="tile ${ok ? 'ok' : 'warn'}"><div class="tl">${label}</div><div class="tv">${value}</div><div class="th">${hint}</div></div>`;
}

function renderPower(p: PowerReport) {
  const max = Math.max(1.6, ...p.rows.map((r) => r.power));
  $('#power').innerHTML = `
    <div class="tiles">
      ${tile('덱 강도 퍼짐', p.logSd.toFixed(3), p.logSd <= 0.15, '작을수록 고름')}
      ${tile('전투 길이(중앙값)', `${p.medianBeats}박`, inRange(p.medianBeats, TARGETS.medianBeats), '목표 30~36박')}
      ${tile('48박 시간 초과', pct(p.timeoutRate), p.timeoutRate <= TARGETS.timeoutMax, '목표 8% 이하')}
      ${tile('36박까지 간 전투', pct(p.reach36), true, '큰 수 노래가 나올 기회')}
    </div>
    <table><thead><tr><th>덱</th><th>파워 지수 <small>(1.0 평균, 낮을수록 강함 · 목표 0.85~1.15)</small></th><th>1배일 때 승률</th></tr></thead><tbody>
    ${p.rows
      .map((r) => {
        const ok = inRange(r.power, TARGETS.power);
        const w = (100 * r.power) / max;
        return `<tr class="${ok ? '' : 'out'}"><td>${esc(r.deck)}</td><td><div class="bar"><span style="width:${w}%"></span><em>${r.power.toFixed(2)}</em></div></td><td>${pct(r.winRate)}</td></tr>`;
      })
      .join('')}
    </tbody></table>`;
}

function renderField(f: FieldReport) {
  $('#field').innerHTML = `
    <p class="meta">무작위 덱 ${f.comps}개 · ${f.battles}판 · 전투 중앙값 ${f.medianBeats}박 · 시간 초과 ${pct(f.timeoutRate)}</p>
    <table><thead><tr><th>숫자</th><th>이름</th><th>값</th><th>직업</th><th>출전 승률 <small>(목표 0.44~0.58)</small></th><th>노래 1번 이상</th><th>끝까지 생존</th></tr></thead><tbody>
    ${f.cards
      .map((c) => {
        const ok = inRange(c.winRate, TARGETS.cardWinRate);
        return `<tr class="${ok ? '' : 'out'}"><td><b>${c.char}</b></td><td>${esc(c.name)}</td><td>${c.cost}</td><td>${ROLES[c.role].name}</td><td>${c.winRate.toFixed(3)}</td><td>${pct(c.sangRate)}</td><td>${pct(c.aliveRate)}</td></tr>`;
      })
      .join('')}
    </tbody></table>`;
}

worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
  const m = ev.data;
  if (m.kind === 'progress') {
    $('#status').textContent = `${m.label} ${m.done} / ${m.total}`;
    ($('#bar') as HTMLProgressElement).value = m.done / m.total;
  } else if (m.kind === 'power') renderPower(m.report);
  else if (m.kind === 'field') renderField(m.report);
  else if (m.kind === 'done') {
    $('#status').textContent = `측정 끝 (${m.seconds.toFixed(1)}초)`;
    document.querySelectorAll<HTMLButtonElement>('.measure').forEach((b) => (b.disabled = false));
  } else if (m.kind === 'battle') $('#log').textContent = m.log;
};

document.querySelectorAll<HTMLButtonElement>('.measure').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.measure').forEach((b) => (b.disabled = true));
    $('#power').innerHTML = $('#field').innerHTML = '';
    send({ kind: 'measure', quick: btn.dataset.quick === '1' });
  }),
);

const options = Object.keys(META_DECKS).map((d) => `<option>${esc(d)}</option>`).join('');
$('#deckA').innerHTML = options;
$('#deckB').innerHTML = options;
($('#deckB') as HTMLSelectElement).selectedIndex = 2;
$('#fight').addEventListener('click', () =>
  send({
    kind: 'battle',
    a: ($('#deckA') as HTMLSelectElement).value,
    b: ($('#deckB') as HTMLSelectElement).value,
    showBasic: ($('#basic') as HTMLInputElement).checked,
  }),
);
