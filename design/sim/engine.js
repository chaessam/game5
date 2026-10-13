// 결정론적 박자 전투 근사 시뮬레이터
const { UNITS, families, splitPair, gcd, divisors } = require('./data.js');

function applyStones(base, stones) {
  let n = base;
  for (const s of stones || []) {
    let m;
    if (s === '+1') m = n + 1; else if (s === '-1') m = n - 1;
    else if (s === 'x2') m = n * 2; else if (s === 'x3') m = n * 3;
    else if (s === '/2') m = n % 2 === 0 ? n / 2 : null;
    else if (s === '/3') m = n % 3 === 0 ? n / 3 : null;
    if (m == null || m < 2 || m > 40) return null;
    n = m;
  }
  return n;
}

function tierOf(count, tiers) { let t = 0; tiers.forEach((th, i) => { if (count >= th) t = i + 1; }); return t; }

// spec unit: {c: char, s: star, st:[stones], it:[items], r: row, col}
function makeTeam(specs, team, cfg) {
  const units = specs.map((sp, i) => {
    const base = Object.assign({}, UNITS[sp.c], cfg.unitOverride[sp.c] || {});
    const num = sp.st && sp.st.length ? applyStones(sp.c, sp.st) : sp.c;
    if (num == null) throw new Error('bad stone ' + JSON.stringify(sp));
    const s = sp.s || 1;
    const hp = Math.floor(base.hp * s * cfg.hpScale * (sp.hpm || 1));
    return {
      id: team * 100 + i, team, char: sp.c, num, star: s, role: base.role,
      maxHp: hp, hp, atk: Math.round(base.atk * s * (cfg.atkScale || 1)), shield: 0, row: sp.r, col: sp.col,
      alive: true, minion: false, stun: 0, weak: 0, stunImm: 0, weakImm: 0,
      items: sp.it || [], dm: sp.dm || 1, fams: families(num), split: false, deathBeat: null,
      stats: { songs: 0, rehearsal: 0, songDmg: 0, basicDmg: 0, heal: 0 },
    };
  });
  return units;
}

function computeSynergy(units, cfg) {
  const fam = { even: new Set(), tri: new Set(), five: new Set(), prime: new Set(), rich: new Set() };
  const role = { knight: new Set(), ninja: new Set(), hunter: new Set(), mage: new Set(), singer: new Set(), healer: new Set() };
  for (const u of units) {
    if (u.minion) continue;
    for (const f of u.fams) fam[f].add(u.num);
    role[u.role].add(u.char);
  }
  const ft = {}, rt = {};
  for (const k in fam) ft[k] = tierOf(fam[k].size, (cfg.famTiersBy && cfg.famTiersBy[k]) ? cfg.famTiersBy[k] : (k === 'even' && cfg.famTiersEven) ? cfg.famTiersEven : cfg.famTiers);
  for (const k in role) rt[k] = tierOf(role[k].size, cfg.roleTiers);
  return { ft, rt };
}

function isUp(u) { return u.alive && u.hp > 0; }

function battle(specA, specB, cfg, opts = {}) {
  const T = [makeTeam(specA, 0, cfg), makeTeam(specB, 1, cfg)];
  const syn = [computeSynergy(T[0], cfg), computeSynergy(T[1], cfg)];
  const log = opts.log ? [] : null;
  let deathCounter = 0;
  const reviveUsed = [false, false];
  const starStacks = [0, 0];
  const acc = { hs: 0, tri: 0, minionHp: 0, coinHp: 0 };

  const up = (t) => T[t].filter(isUp);
  const foesOf = (u) => up(1 - u.team);
  const allyOf = (u) => up(u.team);

  function nearest(att, list) {
    return list.slice().sort((a, b) => Math.abs(a.col - att.col) - Math.abs(b.col - att.col) || a.col - b.col || a.id - b.id)[0];
  }
  function farthestSorted(att, list) {
    const back = list.filter(x => x.row === 1).sort((a, b) => Math.abs(b.col - att.col) - Math.abs(a.col - att.col) || a.col - b.col);
    const front = list.filter(x => x.row === 0).sort((a, b) => Math.abs(b.col - att.col) - Math.abs(a.col - att.col) || a.col - b.col);
    return back.concat(front);
  }
  function frontOf(list) { const f = list.filter(x => x.row === 0); return f.length ? f : list.filter(x => x.row === 1); }
  function normalTarget(att, foes) {
    if (!foes.length) return null;
    const front = foes.filter(f => f.row === 0);
    const kn = cfg.noTaunt ? [] : front.filter(f => f.role === 'knight' && !f.minion);
    if (kn.length) return nearest(att, kn);
    if (front.length) return nearest(att, front);
    return nearest(att, foes);
  }
  function basicTarget(att, foes) {
    if (!foes.length) return null;
    if (!att.minion && att.role === 'ninja') {
      const back = foes.filter(f => f.row === 1);
      return nearest(att, back.length ? back : foes);
    }
    if (!att.minion && att.role === 'hunter') return farthestSorted(att, foes)[0];
    return normalTarget(att, foes);
  }
  function lowestHp(list, pred) {
    return list.slice().sort((a, b) => (pred.get(a) ?? a.hp) - (pred.get(b) ?? b.hp) || a.row - b.row || a.col - b.col)[0];
  }
  function mostHurt(list) {
    return list.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.row - b.row || a.col - b.col);
  }

  function dmg(src, tgt, amt, kind) {
    if (!tgt || !isUp(tgt) || amt <= 0) return 0;
    const rt = syn[tgt.team].rt;
    let red = 0;
    if (!tgt.minion && tgt.role === 'knight') red = cfg.knightSelf[rt.knight];
    else red = cfg.knightAll[rt.knight];
    if (cfg.primeDR && !tgt.minion && tgt.fams.includes('prime')) red += cfg.primeDR[syn[tgt.team].ft.prime];
    let d = Math.floor(amt * (1 - red) * (src && src.dm ? src.dm : 1));
    const sAbs = Math.min(tgt.shield, d); tgt.shield -= sAbs; d -= sAbs;
    tgt.hp -= d;
    if (src) { if (kind === 'song') src.stats.songDmg += d + sAbs; else src.stats.basicDmg += d + sAbs; }
    return d + sAbs;
  }
  function heal(src, tgt, amt) { if (!isUp(tgt)) return; const h = Math.min(tgt.maxHp - tgt.hp, Math.floor(amt)); tgt.hp += h; src.stats.heal += h; }
  function shield(src, tgt, amt) { if (!isUp(tgt)) return; tgt.shield += Math.floor(amt); src.stats.heal += Math.floor(amt); }
  function stun(tgt, b) { if (!tgt || b <= 0 || !isUp(tgt) || tgt.stunImm > 0) return; tgt.stun = Math.max(tgt.stun, b); }
  function weaken(tgt, b) { if (!tgt || b <= 0 || !isUp(tgt) || tgt.weakImm > 0) return; tgt.weak = Math.max(tgt.weak, b); }

  // 노래 실행 (M: 피해 배율, H: 회복/보호막 배율, reh: 리허설)
  function song(u, M, H, reh, beat) {
    const n = u.num, s = u.star, K = cfg.k;
    const foes = foesOf(u), allies = allyOf(u);
    const healF = reh ? (t, a) => shield(u, t, a) : (t, a) => heal(u, t, a);
    const cc = !reh;
    if (u.minion) { dmg(u, normalTarget(u, foes), n * K.minion * M, 'song'); return; }
    const pred = new Map();
    const hitPred = (t, a) => { dmg(u, t, a, 'song'); };
    switch (u.char) {
      case 1: break;
      case 2: mostHurt(allies).slice(0, 2).forEach(t => healF(t, n * K[2] * s * H)); break;
      case 3: dmg(u, normalTarget(u, foes), n * K[3] * s * M, 'song'); break;
      case 4: allies.filter(a => a !== u && Math.abs(a.row - u.row) + Math.abs(a.col - u.col) === 1).forEach(a => shield(u, a, n * K[4] * s * H)); break;
      case 5: { const t = foes.slice().sort((a, b) => b.hp - a.hp || a.row - b.row || a.col - b.col)[0]; dmg(u, t, n * K[5] * s * M, 'song'); if (cc) stun(t, Math.floor(n / cfg.stunDiv[5])); break; }
      case 6: { const h = mostHurt(allies); [3, 2, 1].forEach((sp, i) => h[i] && healF(h[i], sp * n * K[6] * s * H)); break; }
      case 7: { const t = farthestSorted(u, foes)[0]; for (let i = 0; i < 7; i++) dmg(u, t, n * K[7] * s * M, 'song'); break; }
      case 8: { let t; for (let i = 0; i < 8; i++) { const fs = foesOf(u); if (!fs.length) break; t = lowestHp(fs, pred); dmg(u, t, n * K[8] * s * M, 'song'); } if (cc && t) weaken(t, Math.floor(n / cfg.weakDiv[8])); break; }
      case 9: { for (let i = 0; i < n; i++) { const fr = frontOf(foesOf(u)).sort((a, b) => a.col - b.col); if (!fr.length) break; dmg(u, fr[i % fr.length], 16 * s * M * (K[9] / 16), 'song'); } break; }
      case 10: { const cols = {}; foes.forEach(f => (cols[f.col] = (cols[f.col] || 0) + 1)); const best = Object.keys(cols).map(Number).sort((a, b) => cols[b] - cols[a] || Math.abs(a - u.col) - Math.abs(b - u.col) || a - b)[0]; foes.filter(f => f.col === best).forEach(f => dmg(u, f, n * K[10] * s * M, 'song')); break; }
      case 11: for (let i = 0; i < 2; i++) { const fs = foesOf(u); if (!fs.length) break; dmg(u, lowestHp(fs, pred), n * K[11] * s * M, 'song'); } break;
      case 12: if (cc) frontOf(foes).sort((a, b) => Math.abs(a.col - u.col) - Math.abs(b.col - u.col) || a.col - b.col).slice(0, cfg.stun12Max || 5).forEach(f => stun(f, Math.floor(n / cfg.stunDiv[12]))); shield(u, u, n * K[12] * s * H); break;
      case 13: { const per = n * K[13] * s * H; allies.forEach(a => healF(a, per)); let rem = 13 - allies.length; const h = mostHurt(allyOf(u)); let i = 0; while (rem > 0 && h.length) { healF(h[i % h.length], per); i++; rem--; } break; }
      case 15: frontOf(foes).forEach(f => dmg(u, f, n * K[15] * s * M, 'song')); shield(u, u, n * K['15s'] * s * H); break;
      case 16: farthestSorted(u, foes).slice(0, 4).forEach((f, i) => dmg(u, f, n * K[16] / Math.pow(2, i) * s * M, 'song')); break;
      case 17: foes.forEach(f => { dmg(u, f, n * K[17] * s * M, 'song'); if (cc) weaken(f, Math.floor(n / cfg.weakDiv[17])); }); break;
      case 18: frontOf(foes).forEach(f => dmg(u, f, n * K[18] * s * M, 'song')); allies.forEach(a => shield(u, a, n * K['18s'] * s * H)); break;
      case 20: foes.forEach(f => { dmg(u, f, n * K[20] * s * M, 'song'); if (cc) stun(f, Math.floor(n / cfg.stunDiv[20])); }); break;
      case 21: for (let e = 1; e <= 6; e++) { const fs = foesOf(u); if (!fs.length) break; dmg(u, lowestHp(fs, pred), e * n * K[21] * s * M, 'song'); } break;
      case 24: foes.forEach(f => dmg(u, f, n * K[24] * s * M, 'song')); allies.forEach(a => healF(a, n * K[24] * s * H)); break;
      case 25: { const fr = foes.filter(f => f.row === 0), bk = foes.filter(f => f.row === 1); const row = bk.length > fr.length ? bk : fr; row.forEach(f => dmg(u, f, n * K[25] * s * M, 'song')); break; }
      case 28: for (const b of [1, 2, 4, 7, 14]) { const fs = foesOf(u); if (!fs.length) break; dmg(u, lowestHp(fs, pred), Math.floor(b * n * 3 / 4) * (K[28] / 0.75) * s * M, 'song'); } break;
      case 30: {
        if (reh) { allies.forEach(a => shield(u, a, n * K[30] * s * H)); break; }
        allies.forEach(a => heal(u, a, n * K[30] * s * H));
        if (!reviveUsed[u.team]) {
          const dead = T[u.team].filter(x => !x.alive && !x.minion && !x.split).sort((a, b) => a.deathOrder - b.deathOrder)[0];
          if (dead) { dead.alive = true; dead.hp = Math.floor(dead.maxHp / 2); dead.shield = 0; reviveUsed[u.team] = true; }
        }
        break;
      }
      case 36: foes.forEach(f => dmg(u, f, n * K[36] * s * M, 'song')); break;
    }
  }

  // 0박: 금화 → 손잡기 → 리허설
  for (let t = 0; t < 2; t++) {
    for (const u of T[t]) if (u.char === 36) {
      const nums = new Set(T[t].filter(x => x !== u && u.num % x.num === 0).map(x => x.num));
      const c = Math.min(cfg.coinMax, nums.size);
      u.maxHp += c * cfg.coinHp; acc.coinHp += c * cfg.coinHp; u.hp += c * cfg.coinHp; u.atk += c * cfg.coinAtk;
    }
    const hs = new Map();
    const us = T[t];
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j];
      if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) continue;
      const g = gcd(a.num, b.num); if (g < 2) continue;
      let v = g * cfg.handshakePer;
      if (a.items.includes('glove') || b.items.includes('glove')) v *= 2;
      hs.set(a, (hs.get(a) || 0) + v); hs.set(b, (hs.get(b) || 0) + v);
    }
    for (const [u, v] of hs) { u.shield += Math.min(cfg.handshakeCap, v); acc.hs += Math.min(cfg.handshakeCap, v); }
  }
  for (let t = 0; t < 2; t++) for (const u of T[t]) if (u.num >= cfg.rehearsalMin && (!cfg.rehearsalOriginal || u.char >= cfg.rehearsalMin)) {
    song(u, cfg.rehearsalPow, cfg.rehearsalPow, true, 0); u.stats.rehearsal++;
  }

  let beat = 0, winner = null;
  const end = () => {
    const a = up(0).length, b = up(1).length;
    if (!a && !b) return 'draw';
    if (!a) return 1; if (!b) return 0; return null;
  };
  winner = end();
  // 리허설 사망 처리
  const processDeaths = () => {
    for (let t = 0; t < 2; t++) {
      const newMin = [];
      for (const u of T[t]) if (u.alive && u.hp <= 0) {
        u.alive = false; u.deathOrder = deathCounter++; u.deathBeat = beat;
        if (u.minion) continue;
        const ft = syn[t].ft;
        const rich = u.fams.includes('rich') && ft.rich > 0;
        const bag = u.items.includes('bag');
        if (rich || bag) {
          const p = splitPair(u.num);
          if (p) {
            u.split = true;
            const pct = cfg.rich[Math.max(ft.rich, bag && !rich ? 1 : ft.rich)];
            for (const m of p) newMin.push({
              id: t * 100 + 50 + newMin.length + deathCounter, team: t, char: -1, num: m, star: 1, role: 'none', minion: true,
              maxHp: Math.floor(u.maxHp * pct), hp: Math.floor(u.maxHp * pct), atk: Math.floor(u.atk * pct), shield: 0,
              row: u.row, col: u.col, alive: true, stun: 0, weak: 0, stunImm: 0, weakImm: 0, items: [], fams: [], split: true,
              stats: { songs: 0, rehearsal: 0, songDmg: 0, basicDmg: 0, heal: 0 },
            });
          }
        }
      }
      T[t].push(...newMin); newMin.forEach(m => (acc.minionHp += m.maxHp));
    }
  };
  processDeaths();
  winner = end();

  while (winner === null && beat < cfg.maxBeat) {
    beat++;
    // ① 가문 박 효과
    for (let t = 0; t < 2; t++) {
      const ft = syn[t].ft;
      if (beat % 3 === 0 && ft.tri) for (const u of up(t)) if (!u.minion && u.fams.includes('tri')) { if (u.shield < cfg.tri[ft.tri]) acc.tri += cfg.tri[ft.tri] - u.shield; u.shield = Math.max(u.shield, cfg.tri[ft.tri]); }
      if (beat % 5 === 0 && ft.five && starStacks[t] < cfg.starMaxStacks) { starStacks[t]++; for (const u of T[t]) if (!u.minion && u.fams.includes('five')) u.atk += cfg.star5[ft.five]; }
    }
    // ② 노래할 친구
    const singers = [[], []], kEff = [0, 0];
    for (let t = 0; t < 2; t++) {
      for (const u of up(t)) {
        if (u.stun > 0) continue;
        if (u.char === 1 && !u.minion && u.num === 1) { if (cfg.conductorSings) singers[t].push(u); continue; }
        if (beat % u.num === 0) singers[t].push(u);
      }
      if (cfg.conductorAdj) {
        const adjSing = (c) => singers[t].some(x => x !== c && !(x.char === 1 && x.num === 1) && Math.abs(x.row - c.row) + Math.abs(x.col - c.col) === 1);
        singers[t] = singers[t].filter(x => !(x.char === 1 && x.num === 1 && !x.minion) || adjSing(x));
      }
      let k = 0;
      for (const u of singers[t]) k += (u.char === 1 && u.num === 1) ? cfg.conductorCounts : 1;
      if (k >= 2) k += singers[t].filter(u => u.items.includes('mic')).length;
      kEff[t] = k;
    }
    // ③ 노래 (동시성 근사: 양 팀 번갈아)
    const order = [];
    const mx = Math.max(singers[0].length, singers[1].length);
    for (let i = 0; i < mx; i++) for (let t = 0; t < 2; t++) if (singers[t][i]) order.push(singers[t][i]);
    for (const u of order) {
      if (u.char === 1 && u.num === 1) { u.stats.songs++; if (cfg.conductorShield) { const others = singers[u.team].length - 1; const h = mostHurt(allyOf(u))[0]; if (h && others >= (cfg.conductorShieldMin || 1)) shield(u, h, cfg.conductorShield * others * u.star); } continue; }
      const t = u.team, k = kEff[t], ft = syn[t].ft, rt = syn[t].rt;
      let base = 1;
      if (k >= 2) { base = cfg.chorus[Math.min(5, k)]; if (cfg.conductorUnlock && k >= 5) base = singers[t].some(x => x.char === 1 && x.num === 1) ? cfg.conductorUnlock : cfg.chorus[4]; }
      else if (!u.minion && u.fams.includes('prime') && ft.prime) base = cfg.prime[ft.prime];
      if (k >= 2 && cfg.primeOnlySolo && ft.prime && singers[t].every(x => !x.minion && x.fams.includes('prime'))) base = Math.max(base, cfg.prime[ft.prime]);
      let M = base, H = (k >= 2 && cfg.healChorusFactor != null) ? 1 + (base - 1) * cfg.healChorusFactor : base;
      if (!u.minion && u.role === 'mage') { M += cfg.mage[rt.mage]; H += cfg.mage[rt.mage]; }
      if (k >= 2) { M += cfg.singer[rt.singer]; H += cfg.singer[rt.singer]; }
      H += cfg.healer[rt.healer];
      M = Math.min(cfg.multCap, M); H = Math.min(cfg.multCap, H);
      u.stats.songs++;
      if (log) log.push(`b${beat} T${t} ${u.num}(${u.char}) k=${k} M=${M}`);
      song(u, M, H, false, beat);
    }
    // ④ 기본 공격 (동시)
    const hits = [];
    for (let t = 0; t < 2; t++) {
      const rt = syn[t].rt, ft = syn[t].ft;
      for (const u of up(t)) {
        if (u.stun > 0) continue;
        const foes = foesOf(u); const tg = basicTarget(u, foes); if (!tg) continue;
        let a = u.atk;
        if (!u.minion && u.role === 'ninja') a *= 1 + cfg.ninja[rt.ninja];
        if (!u.minion && u.role === 'hunter') a *= 1 + cfg.hunter[rt.hunter];
        if (beat >= cfg.hotBeat) a *= cfg.hotMult;
        if (u.weak > 0) a *= 0.5;
        let tot = a;
        if (beat % 2 === 0 && ft.even && !u.minion && u.fams.includes('even')) tot += a * cfg.even[ft.even];
        hits.push([u, tg, tot]);
      }
    }
    for (const [u, tg, a] of hits) dmg(u, tg, a, 'basic');
    // ⑤ 쓰러짐
    processDeaths();
    // ⑥ 상태
    for (let t = 0; t < 2; t++) for (const u of T[t]) {
      if (u.stunImm > 0) u.stunImm--; if (u.weakImm > 0) u.weakImm--;
      if (u.stun > 0) { u.stun--; if (u.stun === 0) u.stunImm = 3; }
      if (u.weak > 0) { u.weak--; if (u.weak === 0) u.weakImm = 3; }
    }
    winner = end();
  }
  let timeout = false;
  if (winner === null) {
    timeout = true;
    const a = up(0), b = up(1);
    if (a.length !== b.length) winner = a.length > b.length ? 0 : 1;
    else {
      const ha = a.reduce((s, u) => s + u.hp, 0), hb = b.reduce((s, u) => s + u.hp, 0);
      winner = ha === hb ? 'draw' : ha > hb ? 0 : 1;
    }
  }
  return { winner, beat, timeout, T, log, acc, survivors: [up(0).filter(u => !u.minion).length, up(1).filter(u => !u.minion).length] };
}

module.exports = { battle, applyStones, computeSynergy, makeTeam };
