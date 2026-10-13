// 숫자 돌 스캔: 대표 조합의 각 친구에 돌 1~2개를 끼웠을 때 무작위 필드 상대 승률 변화
const { UNITS, BASE_CFG } = require('./data.js');
const { battle, applyStones } = require('./engine.js');
const { rng, buildComp, placements } = require('./lib.js');
const { COMPS } = require('./comps.js');
const cfg = process.argv[2] ? Object.assign({}, BASE_CFG, require(process.argv[2])) : BASE_CFG;
const R = rng(777); const chars = Object.keys(UNITS).map(Number);
const field = [];
while (field.length < 80) { const pool = chars.slice(), pick = []; while (pick.length < 8) pick.push(pool.splice(Math.floor(R() * pool.length), 1)[0]); const b = buildComp(pick, 8, 50, cfg); if (b.spent > 50) continue; field.push(placements(b.units, 1, field.length + 1, 20)[0]); }
function evalComp(units) {
  const p = placements(units, 1, 3, 15)[0]; let w = 0, n = 0;
  for (const f of field) { for (const flip of [0, 1]) { const r = flip ? battle(f, p, cfg) : battle(p, f, cfg); let x = r.winner === 'draw' ? 0.5 : (r.winner === (flip ? 1 : 0) ? 1 : 0); w += x; n++; } }
  return w / n;
}
const S = ['+1', '-1', 'x2', '/2', 'x3', '/3'];
const seqs = S.map(s => [s]).concat(process.env.DOUBLE ? S.flatMap(a => S.map(b => [a, b])) : []);
const agg = {};
const best = [];
for (const [name, list] of Object.entries(COMPS)) {
  if (name.startsWith('변신')) continue;
  const base = buildComp(list, 8, 50, cfg).units;
  const b0 = evalComp(base);
  for (let i = 0; i < base.length; i++) for (const sq of seqs) {
    const u = base[i];
    if (u.c === 1) continue;
    const n = applyStones(u.c, sq); if (n == null) continue;
    const v = base.map((x, j) => (j === i ? Object.assign({}, x, { st: sq }) : x));
    const g = evalComp(v) - b0;
    const key = `${u.c}${sq.join('')}=${n}`;
    (agg[key] = agg[key] || { g: 0, n: 0, max: -1 }); agg[key].g += g; agg[key].n++; agg[key].max = Math.max(agg[key].max, g);
    best.push({ name, key, g, b0 });
  }
  process.stderr.write(name + ' ');
}
console.log('\n\n돌 1개 효과 평균(여러 조합에서) 상위 25 / 하위 10 — 승률 변화(%p)');
const arr = Object.entries(agg).map(([k, v]) => [k, v.g / v.n, v.n, v.max]).sort((a, b) => b[1] - a[1]);
arr.slice(0, 25).forEach(([k, g, n, m]) => console.log(`  ${k.padEnd(14)} 평균 ${(100 * g).toFixed(1).padStart(6)}  최대 ${(100 * m).toFixed(1).padStart(6)}  (조합 ${n}개)`));
console.log('  ...'); arr.slice(-10).forEach(([k, g, n, m]) => console.log(`  ${k.padEnd(14)} 평균 ${(100 * g).toFixed(1).padStart(6)}  최대 ${(100 * m).toFixed(1).padStart(6)}  (조합 ${n}개)`));
console.log('\n조합별 최고 돌 1개');
const by = {}; best.forEach(b => { if (!by[b.name] || by[b.name].g < b.g) by[b.name] = b; });
Object.values(by).forEach(b => console.log(`  ${b.name.padEnd(12)} 기본 ${(100 * b.b0).toFixed(0)}% → ${b.key} ${(100 * (b.b0 + b.g)).toFixed(0)}% (+${(100 * b.g).toFixed(0)}p)`));
// 평균 |변화|
const absMean = best.reduce((s, b) => s + Math.abs(b.g), 0) / best.length;
console.log(`\n돌 1개 평균 |승률 변화| ${(100 * absMean).toFixed(1)}%p, 표본 ${best.length}`);
