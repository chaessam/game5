// 소리(Web Audio, 파일 없이 합성). 숫자마다 음이 있고 같은 박에 노래하면 화음이 된다.
// 5음 음계(도레미솔라)라 어떤 숫자끼리 겹쳐도 잘 어울린다.

let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('nc_muted') === '1';
} catch {
  /* 저장 안 됨: 기본값 */
}

/** 사용자가 버튼을 누른 순간에 불러야 소리가 켜진다(브라우저 규칙). */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('nc_muted', m ? '1' : '0');
  } catch {
    /* 무시 */
  }
}

const PENTA = [0, 2, 4, 7, 9];
/** 숫자 → 음높이(Hz). 1~10이 두 옥타브를 돌고 11부터 다시 돈다. */
export function freqOf(num: number, low = false): number {
  const idx = (Math.max(1, num) - 1) % 10;
  const semis = Math.floor(idx / 5) * 12 + PENTA[idx % 5];
  const base = low ? 196 : 392; // G3 / G4
  return base * 2 ** (semis / 12);
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  gn.gain.setValueAtTime(0, start);
  gn.gain.linearRampToValueAtTime(vol, start + 0.015);
  gn.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(gn).connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

const ready = () => !muted && ctx && ctx.state === 'running';

/** 노래(합창이면 화음). mine = 우리 팀(밝은 소리), 상대는 낮고 작게 */
export function playSong(nums: number[], mine: boolean, chorus: boolean) {
  if (!ready()) return;
  const t = ctx!.currentTime + 0.01;
  const uniq = [...new Set(nums)].sort((a, b) => a - b).slice(0, 5);
  const vol = (mine ? 0.11 : 0.06) / Math.sqrt(uniq.length);
  uniq.forEach((n, i) => {
    const f = freqOf(n, !mine);
    tone(f, t + i * 0.015, mine ? 0.45 : 0.32, vol, mine ? 'triangle' : 'sine');
    if (chorus && mine) tone(f * 2, t + 0.02 + i * 0.015, 0.5, vol * 0.35, 'sine');
  });
}

/** 박 소리(아주 작게). 뜨거운 박이면 조금 더 높게 */
export function playTick(hot: boolean) {
  if (!ready()) return;
  tone(hot ? 1500 : 1100, ctx!.currentTime + 0.005, 0.04, 0.025, 'square');
}

export function playDown() {
  if (!ready()) return;
  const t = ctx!.currentTime + 0.01;
  const o = ctx!.createOscillator();
  const gn = ctx!.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.28);
  gn.gain.setValueAtTime(0.12, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(gn).connect(ctx!.destination);
  o.start(t);
  o.stop(t + 0.32);
}

export function playEnd(result: 'win' | 'loss' | 'draw') {
  if (!ready()) return;
  const t = ctx!.currentTime + 0.02;
  const seq = result === 'win' ? [1, 3, 5, 6, 8] : result === 'loss' ? [6, 4, 3, 1] : [3, 3, 3];
  seq.forEach((n, i) => tone(freqOf(n), t + i * 0.11, 0.35, 0.09, 'triangle'));
}
