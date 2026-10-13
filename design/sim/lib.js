const { UNITS, BASE_CFG, gcd } = require('./data.js');
const { battle, applyStones } = require('./engine.js');

// 시드 난수
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// 리롤 세금: 같은 카드 1장을 더 찾는 데 드는 평균 새로고침 골드의 약 절반(라운드 무료 상점 몫 제외)
const TAX = { 1: 2, 2: 3, 3: 3.5, 4: 4, 5: 4.5 };
function priceOf(c, s, cfg = BASE_CFG) { const cost = (cfg.unitOverride[c] && cfg.unitOverride[c].cost) || UNITS[c].cost; const copies = Math.pow(3, s - 1); return copies * cost + (copies - 1) * TAX[cost]; }
function rawCost(c, s, cfg = BASE_CFG) { const cost = (cfg.unitOverride[c] && cfg.unitOverride[c].cost) || UNITS[c].cost; return Math.pow(3, s - 1) * cost; }

// 예산까지 싼 카드부터 ★ 올리기 (★3은 1~2골드만)
function buildComp(list, slots, budget, cfg = BASE_CFG) {
  const us = list.slice(0, slots).map(x => (typeof x === 'number' ? { c: x, s: 1, st: [], it: [] } : Object.assign({ s: 1, st: [], it: [] }, x)));
  let spent = us.reduce((a, u) => a + priceOf(u.c, u.s, cfg), 0);
  for (let target = 2; target <= 3; target++) {
    const order = us.map((u, i) => i).sort((a, b) => UNITS[us[a].c].cost - UNITS[us[b].c].cost || a - b);
    for (const i of order) {
      const u = us[i];
      if (u.s !== target - 1) continue;
      if (target === 3 && UNITS[u.c].cost > 2) continue;
      const d = priceOf(u.c, target, cfg) - priceOf(u.c, u.s, cfg);
      if (spent + d <= budget) { u.s = target; spent += d; }
    }
  }
  return { units: us, spent, raw: us.reduce((a, u) => a + rawCost(u.c, u.s, cfg), 0) };
}

function numOf(u) { return u.st && u.st.length ? applyStones(u.c, u.st) : u.c; }

// 앞줄: 기사 → 체력 높은 순(1·치유사는 뒤). 앞줄 인원 = n>=7 ? 4 : 3
function assignRows(us) {
  const n = us.length; const F = n >= 7 ? 4 : n >= 5 ? 3 : Math.ceil(n / 2);
  const score = u => (UNITS[u.c].role === 'knight' ? 1e5 : 0) + UNITS[u.c].hp * u.s - (u.c === 1 ? 1e6 : 0) - (['healer', 'hunter', 'mage', 'ninja'].includes(UNITS[u.c].role) ? 400 : 0);
  const sorted = us.map((u, i) => i).sort((a, b) => score(us[b]) - score(us[a]));
  const kn = sorted.filter(i => UNITS[us[i].c].role === 'knight');
  const front = new Set(kn.slice(0, 5));
  for (const i of sorted) { if (front.size >= Math.max(F, Math.min(5, kn.length))) break; front.add(i); }
  if (n - front.size > 5) { for (const i of sorted) { if (n - front.size <= 5) break; front.add(i); } }
  return us.map((u, i) => (front.has(i) ? 0 : 1));
}
function handshakeScore(us, pos) {
  let s = 0;
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
    if (Math.abs(pos[i].r - pos[j].r) + Math.abs(pos[i].col - pos[j].col) !== 1) continue;
    const g = gcd(numOf(us[i]), numOf(us[j])); if (g >= 2) s += g; if (process.env.ADJ1 && (us[i].c === 1 || us[j].c === 1)) s += 4;
  }
  return s;
}
// 변형 0 = 손잡기 최적(언덕 오르기), 변형 1.. = 줄 안에서 무작위 칸
function placements(us, nVar, seed, restarts = 60) {
  const rows = assignRows(us);
  const R = rng(seed);
  const out = [];
  const randomPos = () => {
    const slots = [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]];
    slots.forEach(a => { for (let i = 4; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } });
    const ix = [0, 0];
    return us.map((u, i) => ({ r: rows[i], col: slots[rows[i]][ix[rows[i]]++] }));
  };
  // 최적
  let best = null, bs = -1;
  for (let t = 0; t < restarts; t++) {
    let p = randomPos(); let sc = handshakeScore(us, p);
    for (let it = 0; it < 200; it++) {
      const i = Math.floor(R() * us.length); const r = p[i].r; const nc = Math.floor(R() * 5);
      const q = p.map(x => Object.assign({}, x));
      const j = q.findIndex((x, k) => k !== i && x.r === r && x.col === nc);
      if (j >= 0) q[j].col = q[i].col; q[i].col = nc;
      const s2 = handshakeScore(us, q); if (s2 >= sc) { p = q; sc = s2; }
    }
    if (sc > bs) { bs = sc; best = p; }
  }
  out.push(best);
  for (let v = 1; v < nVar; v++) out.push(randomPos());
  return out.map(p => us.map((u, i) => Object.assign({}, u, { r: p[i].r, col: p[i].col })));
}

function matchup(varsA, varsB, cfg) {
  let w = 0, l = 0, d = 0, beats = [], to = 0;
  for (const a of varsA) for (const b of varsB) {
    for (const flip of [false, true]) {
      const r = flip ? battle(b, a, cfg) : battle(a, b, cfg);
      let win = r.winner; if (flip && win !== 'draw') win = 1 - win;
      if (win === 0) w++; else if (win === 1) l++; else d++;
      beats.push(r.beat); if (r.timeout) to++;
    }
  }
  return { w, l, d, n: w + l + d, beats, to };
}

function median(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function pct(x) { return (100 * x).toFixed(0).padStart(3); }

module.exports = { rng, buildComp, placements, matchup, median, pct, priceOf, rawCost, numOf, TAX };
