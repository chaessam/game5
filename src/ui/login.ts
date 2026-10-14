// 들어가기 상자: 학교(검색해서 고르기) + 닉네임 + 숫자 4자리. 구구팡·구구단 디펜스와 같은 방식.
import { countSameName, indexSchools, placeOf, searchSchools, shortSchool, type School, type SchoolIndex } from '../shared/schools';
import { identityError, normalizeNick, pinOk } from '../shared/identity';
import { getAuth, login, logout, me, type MyRecord } from '../net/api';
import { rankTier } from '../shared/rank';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 무시 */
    }
  },
};

let picked: Pick<School, 'code' | 'name' | 'sido' | 'addr'> | null = null;
try {
  picked = JSON.parse(store.get('nc-school') || 'null');
} catch {
  picked = null;
}
let nick = store.get('nc-nick') || '';
let pin = '';
let busy = false;
let message = '';
let record: MyRecord | null = null;
let idx: SchoolIndex | null = null;
let idxLoading: Promise<SchoolIndex | null> | null = null;

export const myRecord = () => record;
export function setLocalRecord(r: MyRecord | null) {
  record = r;
}

async function loadIndex(): Promise<SchoolIndex | null> {
  if (idx) return idx;
  idxLoading ??= fetch('./data/schools.json')
    .then((r) => r.json())
    .then((d) => (idx = indexSchools(d)))
    .catch(() => null);
  return idxLoading;
}

/** 로그인되어 있으면 서버 기록을 불러온다 */
export async function refreshMe(): Promise<void> {
  if (!getAuth()) return;
  const r = await me();
  if (r.ok) record = r.record;
}

export function loginBoxHtml(): string {
  const a = getAuth();
  if (a) {
    return `<div class="loginbox in"><span>🏫 <b>${esc(shortSchool(a.schoolName))}</b> · <b>${esc(a.nick)}</b>${a.teacher ? ' <span class="tag">선생님</span>' : ''}</span>
      ${record ? `<span class="tier sm" style="--tc:${rankTier(record.points).color}">${rankTier(record.points).icon} ${rankTier(record.points).label}</span><span class="sub">${record.points}점 · 판 ${record.games} · 1등 ${record.firsts}${record.bestChorus ? ` · 최고 합창 ${record.bestChorus.count}명` : ''}</span>` : ''}
      <button class="btn small ghost" data-action="logout">나가기</button></div>`;
  }
  return `<div class="loginbox">
    <div class="lrow">
      <div class="school"><input id="nc-school" maxlength="30" autocomplete="off" placeholder="학교 검색 (예: 송우초)" value="${picked ? esc(picked.name) : ''}">
        <ul id="nc-school-list" class="slist"></ul></div>
      <input id="nc-nick" maxlength="10" autocomplete="off" placeholder="닉네임" value="${esc(nick)}">
      <input id="nc-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="비밀번호 4자리" value="${esc(pin)}">
      <button class="btn gold" data-action="login" ${busy ? 'disabled' : ''}>들어가기</button>
    </div>
    <div class="sub">${picked ? `📍 ${esc(placeOf(picked))} ${esc(picked.name)}` : '학교 이름을 검색해서 골라요.'} 처음이면 계정이 새로 만들어져요.<br>들어가지 않아도 할 수 있어요. (기록은 저장 안 돼요)</div>
    ${message ? `<div class="lmsg">${esc(message)}</div>` : ''}
  </div>`;
}

let results: School[] = [];
function showList(items: School[] | string) {
  const ul = document.getElementById('nc-school-list');
  if (!ul) return;
  if (typeof items === 'string') {
    ul.innerHTML = `<li class="info">${esc(items)}</li>`;
    ul.classList.add('show');
    return;
  }
  results = items;
  ul.innerHTML = items
    .map((s, i) => `<li data-action="pickschool" data-i="${i}" class="${idx && countSameName(idx, s.name) > 1 ? 'dup' : ''}"><span>${esc(s.name)}</span><small>${esc(placeOf(s))}</small></li>`)
    .join('');
  ul.classList.toggle('show', items.length > 0);
}

/** 입력 칸 이벤트(다시 그리지 않고 목록만 바꿈) */
export function bindLoginInputs(root: HTMLElement) {
  root.addEventListener('input', async (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.id === 'nc-nick') {
      nick = el.value;
      store.set('nc-nick', normalizeNick(nick));
    } else if (el.id === 'nc-pin') {
      const v = el.value.replace(/[^0-9]/g, '').slice(0, 4);
      if (v !== el.value) el.value = v;
      pin = v;
    } else if (el.id === 'nc-school') {
      picked = null;
      const q = el.value;
      if (!q.trim()) return showList([]);
      const index = await loadIndex();
      if ((document.getElementById('nc-school') as HTMLInputElement | null)?.value !== q) return;
      if (!index || !index.list.length) return showList('학교 목록을 불러올 수 없어요.');
      const found = searchSchools(index, q, 30);
      showList(found.length ? found : '찾는 학교가 없어요. 이름을 다시 확인해 주세요.');
    }
  });
  root.addEventListener('keydown', (ev) => {
    const el = ev.target as HTMLElement;
    if ((el.id === 'nc-pin' || el.id === 'nc-nick') && ev.key === 'Enter') {
      (document.querySelector('[data-action="login"]') as HTMLButtonElement | null)?.click();
    }
  });
}

/** 들어가기 관련 버튼이면 처리하고 true */
export function handleLoginAction(action: string, el: HTMLElement, rerender: () => void): boolean {
  if (action === 'pickschool') {
    const s = results[Number(el.dataset.i)];
    if (s) {
      picked = { code: s.code, name: s.name, sido: s.sido, addr: s.addr };
      store.set('nc-school', JSON.stringify(picked));
    }
    rerender();
    return true;
  }
  if (action === 'logout') {
    void logout().then(() => {
      record = null;
      rerender();
    });
    return true;
  }
  if (action === 'login') {
    void doLogin(false, rerender);
    return true;
  }
  return false;
}

async function doLogin(create: boolean, rerender: () => void) {
  const n = normalizeNick(nick);
  const err = identityError({ schoolCode: picked?.code ?? '', nick: n });
  if (err || !picked) {
    message = err ?? '학교를 검색해서 골라 주세요.';
    return rerender();
  }
  if (!pinOk(pin)) {
    message = '비밀번호는 숫자 4자리로 적어 주세요.';
    return rerender();
  }
  busy = true;
  message = '';
  rerender();
  const r = await login(picked.code, picked.name, n, pin, create);
  busy = false;
  if (!r.ok && r.code === 'no_account') {
    const where = `${shortSchool(picked.name)} ${n}`;
    if (window.confirm(`처음 왔네요!\n"${where}" 계정을 이 비밀번호로 만들까요?\n비밀번호는 꼭 기억해 주세요.`)) return doLogin(true, rerender);
    return rerender();
  }
  if (!r.ok) {
    message = r.error ?? '들어가지 못했어요.';
    if (r.code === 'wrong_pin') pin = '';
    return rerender();
  }
  pin = '';
  message = '';
  record = r.record; // 들어갈 때 받은 기록(내 기록을 다시 읽지 않음)
  rerender();
}
