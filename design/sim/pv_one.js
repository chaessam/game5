const { BASE_CFG } = require('./data.js');
const { buildComp, placements, matchup } = require('./lib.js');
const { COMPS } = require('./comps.js');
const targets = (process.env.T || '대합창(1없음),단단독창,짝꿍가문').split(',');
function pw(cfg, a, vars, ns) {
  const wr = (m) => { let w = 0, n = 0; const va = vars[a].map(v => v.map(u => Object.assign({}, u, { dm: m }))); for (const b of ns) { if (b === a) continue; const r = matchup(va, vars[b], cfg); w += r.w + 0.5 * r.d; n += r.n; } return w / n; };
  let lo = 0.1, hi = 6; for (let i = 0; i < 9; i++) { const mid = Math.sqrt(lo * hi); if (wr(mid) > 0.5) hi = mid; else lo = mid; } return Math.sqrt(lo * hi);
}
const V = require(process.argv[2]);
for (const [k, v] of Object.entries(V)) {
  const cfg = Object.assign({}, BASE_CFG, v); const vars = {};
  for (const n of Object.keys(COMPS)) if (!((process.env.SL||8)<8 && n.startsWith('변신'))) vars[n] = placements(buildComp(COMPS[n], +(process.env.SL||8), +(process.env.BU||50), cfg).units, 4, 7);
  const ns = Object.keys(vars);
  console.log(k.padEnd(20), targets.map(t => `${t} ${pw(cfg, t, vars, ns).toFixed(2)}`).join(' | '));
}
