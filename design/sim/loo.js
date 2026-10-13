const { BASE_CFG } = require('./data.js');
const { buildComp, placements, matchup } = require('./lib.js');
const { COMPS } = require('./comps.js');
const T = process.argv[2] ? require(process.argv[2]) : {};
const cfg = Object.assign({}, BASE_CFG, T);
const target = process.argv[3] || '대합창(1없음)';
const others = Object.keys(COMPS).filter(n => n !== target && !n.startsWith('대합창'));
const ov = {}; others.forEach(n => (ov[n] = placements(buildComp(COMPS[n], 8, 50, cfg).units, 5, 7)));
function score(units) { const v = placements(units, 5, 7, 30); let w = 0, n = 0; for (const o of others) { const r = matchup(v, ov[o], cfg); w += r.w + 0.5 * r.d; n += r.n; } return w / n; }
const base = buildComp(COMPS[target], 8, 50, cfg).units;
console.log(target, base.map(u => u.c + '★' + u.s).join(' '), '기본', score(base).toFixed(2));
for (const filler of [16, 10]) for (let i = 0; i < base.length; i++) {
  const v = base.map((u, j) => (j === i ? { c: filler, s: 1, st: [], it: [] } : u));
  console.log(`  ${base[i].c}★${base[i].s} → ${filler}★1 : ${score(v).toFixed(2)}`);
}
