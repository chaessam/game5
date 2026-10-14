// 전투 장면: 엔진이 남긴 사건(events)과 박자 스냅샷(frames)을 박마다 재생한다.
// 위 = 상대(뒷줄·앞줄), 아래 = 우리(앞줄·뒷줄). 같은 세로줄끼리 마주 본다.
import type { BattleResult, Fighter, FrameUnit } from '../engine/battle';
import type { BattleEvent } from '../engine/types';
import { DEFAULT_CONFIG, UNITS } from '../engine/data';
import { josa, josaOnly } from '../shared/josa';
import { charArt, charColor, minionArt } from './art/chars';
import { isMuted, playDown, playEnd, playSong, playTick, setMuted, unlockAudio } from './sound';

export interface BattleViewOpts {
  result: BattleResult;
  /** 우리 팀 번호(아래쪽) */
  side: 0 | 1;
  oppName: string;
  /** 관전: 아래 팀 이름(없으면 '우리 팀') */
  myName?: string;
  /** 끝나거나 건너뛰면 */
  onDone: () => void;
  /** 박이 끝날 때 하나쌤이 할 말(튜토리얼·처음 보는 순간). 말이 있으면 멈추고 [계속]을 기다린다 */
  talk?: (beat: number, events: BattleEvent[], view: { side: 0 | 1; result: BattleResult }) => string[];
  /** 이 전투만의 빠르기(튜토리얼은 천천히) */
  speed?: number;
}

/** 브라우저 내장 한국어 음성으로 읽어 주기 */
export function readAloud(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/[①②③]/g, ''));
    u.lang = 'ko-KR';
    u.rate = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* 음성 없음 */
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const eunNeun = (n: number) => josaOnly(n, '은/는');
const pctText = (p: number) => (p % 100 === 0 ? `${p / 100}배` : `${(p / 100).toFixed(2).replace(/0$/, '')}배`);

/** 빠르기: 1배 → 2배 → 천천히(0.5배) */
const SPEEDS = [1, 2, 0.5];
const speedLabel = (v: number) => (v === 0.5 ? '천천히' : `${v}배 빠르기`);
let speed = 1;
try {
  const v = Number(localStorage.getItem('nc_speed'));
  if (SPEEDS.includes(v)) speed = v;
} catch {
  /* 기본 1배 */
}

export class BattleView {
  readonly root: HTMLElement;
  private r: BattleResult;
  private side: 0 | 1;
  private byId: Map<number, Fighter>;
  private els = new Map<number, HTMLElement>();
  private evByBeat = new Map<number, BattleEvent[]>();
  private stopped = false;
  private finished = false;
  private logLines: string[] = [];
  private opts: BattleViewOpts;
  private talked = new Set<number>();
  private alive = new Set<number>();

  private resume: (() => void) | null = null;
  private savedSpeed: number | null = null;

  constructor(opts: BattleViewOpts) {
    this.opts = opts;
    if (opts.speed) {
      this.savedSpeed = speed;
      speed = opts.speed;
    }
    this.r = opts.result;
    this.side = opts.side;
    this.byId = new Map(this.r.fighters.map((f) => [f.id, f]));
    for (const e of this.r.events) {
      const list = this.evByBeat.get(e.beat) ?? [];
      list.push(e);
      this.evByBeat.set(e.beat, list);
    }
    this.root = document.createElement('div');
    this.root.className = 'bv';
    this.root.innerHTML = this.skeleton();
    this.root.addEventListener('click', (ev) => this.onClick(ev));
    this.buildFighters();
    this.applyFrame(this.r.frames[0], false);
    this.prophecy(0);
    void this.play();
  }

  /** 다른 화면으로 넘어갈 때 */
  stop() {
    this.stopped = true;
    this.resume?.();
    if (this.savedSpeed !== null) {
      speed = this.savedSpeed;
      this.savedSpeed = null;
    }
  }

  // ---------------- 뼈대 ----------------
  private skeleton(): string {
    const maxBeat = DEFAULT_CONFIG.maxBeat;
    const mine = this.r.fighters.filter((f) => f.team === this.side && !f.minion);
    const primeOn = this.r.synergy[this.side].fam.prime > 0;
    const cells: string[] = [];
    for (let b = 1; b <= maxBeat; b++) {
      const singers = mine.filter((f) => f.num !== 1 && b % f.num === 0);
      const n = singers.length;
      const hot = b >= DEFAULT_CONFIG.hotBeatFrom;
      const prime = primeOn && n > 0 && singers.every((f) => f.fams.includes('prime'));
      const title = n ? `${b}박: ${singers.map((f) => f.num).sort((x, y) => x - y).join('·')} — 모두 ${b}의 약수` : `${b}박: 노래하는 우리 친구 없음`;
      cells.push(`<div class="sb ${n >= 2 ? 'ch' : ''} ${prime ? 'pr' : ''} ${hot ? 'hot' : ''}" data-b="${b}" data-bv="sb" data-sb="${b}" title="${title}"><span>${b}</span><i>${prime ? '◆' : '●'.repeat(Math.min(n, 4))}</i></div>`);
    }
    let grid = '';
    // 화면 줄: 0 = 상대 뒷줄, 1 = 상대 앞줄, 2 = 우리 앞줄, 3 = 우리 뒷줄
    for (let vr = 0; vr < 4; vr++) {
      if (vr === 2) grid += `<div class="bv-mid"><span>▲ 상대</span><span>우리 ▼</span></div>`;
      for (let col = 0; col < 5; col++) grid += `<div class="bc ${vr < 2 ? 'foe' : 'mine'}" id="bc-${vr}-${col}"></div>`;
    }
    return `
      <div class="bv-head">
        <div class="bv-beat"><b class="jua">준비</b></div>
        <div class="bv-cap">곧 시작해요! 같은 박에 노래하면 <b>합창</b>이에요.</div>
        <div class="bv-ctrl">
          <button class="btn small ghost" data-bv="speed">${speedLabel(speed)}</button>
          <button class="btn small ghost" data-bv="sound">${isMuted() ? '🔇 소리 끔' : '🔊 소리'}</button>
          <button class="btn small gold" data-bv="skip">결과 보기 ▶</button>
        </div>
      </div>
      <div class="bv-next"></div>
      <div class="bv-strip" title="박자 줄: 동그라미 = 그 박에 노래하는 우리 친구 수, 금테 = 합창 박, 빨강 = 뜨거운 박">${cells.join('')}</div>
      <div class="bv-arena">
        <div class="bv-label foe">상대: <b>${esc(this.opts.oppName)}</b></div>
        <div class="bv-grid">${grid}</div>
        <div class="bv-label mine"><b>${esc(this.opts.myName ?? '우리 팀')}</b></div>
        <div class="bv-fx"></div>
      </div>
      <div class="bv-log"></div>`;
  }

  private cellOf(f: Fighter): HTMLElement | null {
    const mine = f.team === this.side;
    const vr = mine ? (f.row === 0 ? 2 : 3) : f.row === 0 ? 1 : 0;
    return this.root.querySelector<HTMLElement>(`#bc-${vr}-${f.col}`);
  }

  private fighterEl(f: Fighter): HTMLElement {
    const el = document.createElement('div');
    const mine = f.team === this.side;
    el.className = `bf ${mine ? 'mine' : 'foe'} ${f.minion ? 'minion' : ''}`;
    el.dataset.id = String(f.id);
    let art: string;
    if (f.minion) {
      const parent = this.r.fighters.find((p) => p.team === f.team && p.split && !p.minion && p.row === f.row && p.col === f.col);
      art = minionArt(f.num, 44, parent ? charColor(parent.char) : '#C79BFF');
    } else art = charArt(f.char, 70, { num: f.num, star: f.star });
    const stars = f.minion ? '' : `<span class="bf-stars">${'★'.repeat(f.star)}</span>`;
    el.innerHTML = `${stars}<div class="bf-art">${art}</div><div class="bf-bar"><i class="bf-hp"></i></div><div class="bf-shbar"><i class="bf-sh"></i></div><div class="bf-st"></div>`;
    return el;
  }

  private buildFighters() {
    for (const f of this.r.fighters) {
      if (f.minion) continue;
      const el = this.fighterEl(f);
      this.els.set(f.id, el);
      this.cellOf(f)?.appendChild(el);
    }
  }

  private name(id: number): string {
    const f = this.byId.get(id);
    if (!f) return '?';
    const who = f.team === this.side ? '' : '상대 ';
    return f.minion ? `${who}꼬마 ${f.num}` : `${who}${f.num} ${UNITS[f.char].name}`;
  }

  // ---------------- 상태 적용 ----------------
  private applyFrame(frame: { units: Record<number, FrameUnit> } | undefined, animateDeath: boolean) {
    if (!frame) return;
    for (const [idStr, u] of Object.entries(frame.units)) {
      const id = Number(idStr);
      let el = this.els.get(id);
      if (!el) {
        const f = this.byId.get(id);
        if (!f || !u.alive) continue;
        el = this.fighterEl(f);
        el.classList.add('pop-in');
        this.els.set(id, el);
        this.cellOf(f)?.appendChild(el);
      }
      const hp = el.querySelector<HTMLElement>('.bf-hp')!;
      hp.style.width = `${Math.max(0, Math.min(100, (100 * u.hp) / Math.max(1, u.maxHp)))}%`;
      hp.classList.toggle('low', u.hp < u.maxHp * 0.35);
      el.querySelector<HTMLElement>('.bf-sh')!.style.width = `${Math.min(100, (100 * u.shield) / Math.max(1, u.maxHp))}%`;
      el.querySelector<HTMLElement>('.bf-st')!.textContent = u.stun ? '💫' : u.weak ? '💧' : '';
      if (u.alive) this.alive.add(id);
      else this.alive.delete(id);
      const wasDead = el.classList.contains('dead');
      el.classList.toggle('dead', !u.alive);
      if (!u.alive && !wasDead && animateDeath) playDown();
    }
  }

  private pop(id: number, text: string, cls: string, delay = 0) {
    const el = this.els.get(id);
    if (!el) return;
    window.setTimeout(() => {
      if (this.stopped) return;
      const s = document.createElement('span');
      s.className = `pop ${cls}`;
      s.textContent = text;
      el.appendChild(s);
      window.setTimeout(() => s.remove(), 1100);
    }, delay / speed);
  }

  private flash(id: number, cls: string, ms: number) {
    const el = this.els.get(id);
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }

  private banner(text: string, cls: string, ms = 1100) {
    const fx = this.root.querySelector<HTMLElement>('.bv-fx')!;
    const b = document.createElement('div');
    b.className = `bv-banner ${cls}`;
    b.innerHTML = text;
    fx.appendChild(b);
    if (ms > 0) window.setTimeout(() => b.remove(), ms / speed + 200);
    return b;
  }

  private caption(html: string) {
    this.root.querySelector<HTMLElement>('.bv-cap')!.innerHTML = html;
  }

  private log(lines: string[]) {
    if (!lines.length) return;
    this.logLines = lines.concat(this.logLines).slice(0, 4);
    this.root.querySelector<HTMLElement>('.bv-log')!.innerHTML = this.logLines.map((l) => `<div>${l}</div>`).join('');
  }

  private bubble(id: number, text: string) {
    const el = this.els.get(id);
    if (!el) return;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    el.appendChild(b);
    window.setTimeout(() => b.remove(), 1500 / speed);
  }

  /** 다음 합창 예고: 지금 살아 있는 우리 친구 기준 */
  private prophecy(beat: number) {
    const box = this.root.querySelector<HTMLElement>('.bv-next')!;
    const mine = this.r.fighters.filter((f) => f.team === this.side && !f.minion && this.alive.has(f.id) && f.num !== 1);
    for (let b = beat + 1; b <= DEFAULT_CONFIG.maxBeat; b++) {
      const s = mine.filter((f) => b % f.num === 0);
      if (s.length >= 2) {
        const list = s.map((f) => f.num).sort((x, y) => x - y).join('·');
        box.innerHTML = `다음 합창 예고: <b>${b}박</b> · ${s.length}명 (${list}) <small>— ${b}의 약수끼리 함께!</small>`;
        return;
      }
    }
    box.innerHTML = '<small>남은 박에 합창이 없어요. 같은 박에 노래하는 숫자를 모아 봐요.</small>';
  }

  // ---------------- 한 박 ----------------
  /** 이 박의 사건을 보여 주고 노래가 있었는지 돌려준다 */
  private showBeat(beat: number): boolean {
    const evs = this.evByBeat.get(beat) ?? [];
    const lines: string[] = [];
    let cap = '';
    let sang = false;
    const nums = (ids: number[]) => ids.map((id) => this.byId.get(id)?.num ?? 0);

    // 노래·합창
    for (const e of evs) {
      if (e.type !== 'chorus') continue;
      sang = true;
      const mine = e.team === this.side;
      const ns = nums(e.singers);
      const list = [...ns].sort((a, b) => a - b).join('·');
      const song = evs.find((x) => x.type === 'song' && e.singers.includes(x.unit) && !x.rehearsal) as Extract<BattleEvent, { type: 'song' }> | undefined;
      const mult = song ? pctText(song.mult) : '';
      let bubbles = 0;
      for (const id of e.singers) {
        this.flash(id, 'sing', 650);
        this.pop(id, '♪', 'note');
        const f = this.byId.get(id);
        if (f && !f.minion && !this.talked.has(id) && bubbles < 2) {
          this.talked.add(id);
          bubbles++;
          this.bubble(id, UNITS[f.char].line);
        }
      }
      playSong(ns, mine, e.count >= 2);
      let line: string;
      if (e.prime) line = `◆ 다이아${e.count >= 2 ? '끼리 합창' : ' 혼자 노래'}! ${list} (${mult})`;
      else if (e.count >= 2) line = `🎵 합창 ${e.count}명 몫! ${list} (${mult}) — ${beat}${eunNeun(beat)} ${list}의 배수`;
      else line = `♪ ${this.name(e.singers[0])} 노래`;
      if (mine) {
        if (e.count >= 2 || e.prime) this.banner(`${e.prime ? '◆ 다이아 쾅!' : `🎵 합창 ${e.count}명!`} <small>${list}</small>`, 'mine');
        cap = `<b>${beat}박</b> 우리 ${line.replace(/^♪ /, '')}`;
        lines.push(`<span class="me">우리</span> ${line}`);
      } else {
        if (e.count >= 2) this.banner(`상대 ${e.prime ? '다이아 합창' : `합창 ${e.count}명`} <small>${list}</small>`, 'foe');
        if (!cap) cap = `<b>${beat}박</b> 상대 ${line.replace(/^♪ 상대 /, '')}`;
        lines.push(`<span class="op">상대</span> ${line.replace('상대 ', '')}`);
      }
    }

    // 피해·회복·방패(대상별로 모아서)
    const agg = new Map<number, { song: number; basic: number; heal: number; shield: number }>();
    const get = (id: number) => agg.get(id) ?? (agg.set(id, { song: 0, basic: 0, heal: 0, shield: 0 }), agg.get(id)!);
    for (const e of evs) {
      if (e.type === 'damage') {
        if (e.basic) get(e.tgt).basic += e.amount;
        else get(e.tgt).song += e.amount;
      } else if (e.type === 'heal') get(e.tgt).heal += e.amount;
      else if (e.type === 'shield') get(e.tgt).shield += e.amount;
      else if (e.type === 'handshake') get(e.unit).shield += e.shield;
    }
    for (const [id, a] of agg) {
      if (a.song) {
        this.pop(id, `-${a.song}`, 'dmg', 180);
        this.flash(id, 'hit', 320);
      }
      if (a.basic) this.pop(id, `-${a.basic}`, 'basic', a.song ? 420 : 120);
      if (a.heal) this.pop(id, `+${a.heal}`, 'heal', 180);
      if (a.shield) this.pop(id, `🛡${a.shield}`, 'shield', 260);
    }

    // 그 밖의 사건
    for (const e of evs) {
      switch (e.type) {
        case 'stun':
        case 'weak':
          lines.push(`${e.type === 'stun' ? '💫' : '💧'} ${this.name(e.tgt)} ${e.beats}박 ${e.type === 'stun' ? '멈춤' : '약하게'}`);
          break;
        case 'death':
          lines.push(`💥 ${this.name(e.unit)} 쓰러짐`);
          break;
        case 'split': {
          const f = this.byId.get(e.unit)!;
          const [a, b] = nums(e.minions);
          lines.push(`👑 ${this.name(e.unit)} → 꼬마 ${josa(a, '과/와')} ${b} (${a} × ${b} = ${f.num})`);
          break;
        }
        case 'revive':
          lines.push(`✨ ${this.name(e.tgt)} 되살아남!`);
          this.pop(e.tgt, '✨', 'note', 300);
          break;
        case 'coins':
          if (e.coins) lines.push(`💰 ${this.name(e.unit)} 약수 금화 ${e.coins}개 (${e.nums.join('·')})`);
          break;
        case 'familyBeat':
          if (e.team === this.side) lines.push(e.family === 'tri' ? `▲ 세모 박: 세모 방패 ${e.value}` : `✋ 하이파이브 박: 공격 +${e.value}`);
          break;
        default:
          break;
      }
    }
    if (beat === DEFAULT_CONFIG.hotBeatFrom) {
      lines.unshift(`🔥 ${beat}박부터 뜨거운 박! 기본 공격 ${DEFAULT_CONFIG.hotBasicPct / 100}배`);
      if (!cap) cap = `<b>${beat}박</b> 🔥 뜨거운 박 시작!`;
    }
    if (beat === 0) {
      const hs = evs.filter((e) => e.type === 'handshake' && this.byId.get(e.unit)?.team === this.side).length;
      if (hs) lines.push(`🤝 손잡기 방패: 우리 ${hs}명 (붙은 친구와 최대공약수 × ${DEFAULT_CONFIG.handshakePerGcd})`);
      const reh = evs.filter((e) => e.type === 'song' && e.rehearsal);
      for (const e of reh) if (e.type === 'song') this.flash(e.unit, 'sing', 650);
      if (reh.length) lines.push(`🎤 몸풀기 노래: ${reh.map((e) => (e.type === 'song' ? this.name(e.unit) : '')).join(', ')}`);
      cap = '<b>0박</b> 준비! 손잡기 방패와 몸풀기 노래';
    }
    if (cap) this.caption(cap);
    else if (beat > 0) this.caption(`<b>${beat}박</b>`);
    this.log(lines);
    return sang || (beat === 0 && evs.length > 0);
  }

  private markStrip(beat: number) {
    const strip = this.root.querySelector<HTMLElement>('.bv-strip')!;
    strip.querySelector('.now')?.classList.remove('now');
    if (beat < 1) return;
    const cell = strip.querySelector<HTMLElement>(`[data-b="${beat}"]`);
    if (!cell) return;
    cell.classList.add('now');
    for (let b = 1; b < beat; b++) strip.querySelector(`[data-b="${b}"]`)?.classList.add('past');
    const head = this.root.querySelector<HTMLElement>('.bv-beat')!;
    head.innerHTML = `<b class="jua">${beat}</b>박`;
    head.classList.toggle('hot', beat >= DEFAULT_CONFIG.hotBeatFrom);
  }

  private wait(ms: number) {
    return new Promise<void>((res) => window.setTimeout(res, ms / speed));
  }

  private async play() {
    await this.wait(700);
    for (let i = 1; i < this.r.frames.length; i++) {
      if (this.stopped) return;
      const frame = this.r.frames[i];
      const beat = frame.beat;
      this.markStrip(beat);
      if (beat > 0) this.prophecy(beat);
      if (beat > 0) playTick(beat >= DEFAULT_CONFIG.hotBeatFrom);
      const big = this.showBeat(beat);
      await this.wait(big ? 380 : 150);
      if (this.stopped) return;
      this.applyFrame(frame, true);
      this.prophecy(Math.max(beat, 0));
      await this.wait(big ? 480 : 170);
      const lines = this.opts.talk?.(beat, this.evByBeat.get(beat) ?? [], { side: this.side, result: this.r }) ?? [];
      for (const line of lines) {
        if (this.stopped) return;
        await this.say(line);
      }
    }
    this.end();
  }

  /** 하나쌤 말풍선을 띄우고 [계속]을 누를 때까지 기다린다 */
  private say(text: string): Promise<void> {
    const fx = this.root.querySelector<HTMLElement>('.bv-fx')!;
    const b = document.createElement('div');
    b.className = 'bv-say';
    b.innerHTML = `<div class="who">${charArt(1, 54, { noNumber: true, noGems: true })}</div><div class="txt">${esc(text)}</div>
      <div class="btns"><button class="btn small ghost" data-bv="read">🔊</button><button class="btn small gold" data-bv="resume">계속 ▶</button></div>`;
    fx.appendChild(b);
    return new Promise((res) => {
      this.resume = () => {
        b.remove();
        this.resume = null;
        res();
      };
    });
  }

  private end() {
    if (this.finished || this.stopped) return;
    this.finished = true;
    const w = this.r.winner;
    const res = w === 'draw' ? 'draw' : w === this.side ? 'win' : 'loss';
    playEnd(res);
    const note = this.r.timeout ? `<small>${DEFAULT_CONFIG.maxBeat}박 끝 — 남은 친구 수로 판정</small>` : '';
    this.banner(`${res === 'win' ? '이겼어요! 🎉' : res === 'loss' ? '아쉽게 졌어요' : '비겼어요'}${note}<button class="btn gold" data-bv="done">결과 보기 ▶</button>`, `end ${res}`, 0);
    this.root.querySelector<HTMLElement>('[data-bv="skip"]')!.style.visibility = 'hidden';
  }

  private onClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-bv]');
    if (!el) return;
    ev.stopPropagation();
    unlockAudio();
    switch (el.dataset.bv) {
      case 'speed':
        speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        try {
          localStorage.setItem('nc_speed', String(speed));
        } catch {
          /* 무시 */
        }
        el.textContent = speedLabel(speed);
        break;
      case 'sb':
        this.caption(`<b>${el.dataset.sb}박</b> ${esc(el.title.replace(/^\d+박: /, ''))}`);
        break;
      case 'sound':
        setMuted(!isMuted());
        el.textContent = isMuted() ? '🔇 소리 끔' : '🔊 소리';
        break;
      case 'resume':
        this.resume?.();
        break;
      case 'read': {
        const t = el.closest('.bv-say')?.querySelector('.txt')?.textContent ?? '';
        readAloud(t);
        break;
      }
      case 'skip':
      case 'done':
        this.stopped = true;
        this.resume?.();
        this.opts.onDone();
        break;
    }
  }
}
