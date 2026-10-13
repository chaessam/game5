// 파워 지수: 이 조합의 체력을 몇 배로 해야(또는 줄여야) 나머지 조합 전체 상대로 50%가 되는가
const { BASE_CFG } = require('./data.js');
const { buildComp, placements, matchup } = require('./lib.js');
const { COMPS } = require('./comps.js');
function powerTable(cfg, sc = { slots: 8, budget: 50 }, NV = 4) {
  const vars = {};
  for (const n of Object.keys(COMPS)) { if (sc.slots < 8 && n.startsWith('변신')) continue; vars[n] = placements(buildComp(COMPS[n], sc.slots, sc.budget, cfg).units, NV, 7); }
  const ns = Object.keys(vars); const out = {};
  for (const a of ns) {
    const wr = (m) => { let w = 0, n = 0; const va = vars[a].map(v => v.map(u => Object.assign({}, u, process.env.HPM ? { hpm: m } : { dm: m }))); for (const b of ns) { if (b === a) continue; const r = matchup(va, vars[b], cfg); w += r.w + 0.5 * r.d; n += r.n; } return w / n; };
    let lo = 0.1, hi = 6;
    for (let i = 0; i < 10; i++) { const mid = Math.sqrt(lo * hi); if (wr(mid) > 0.5) hi = mid; else lo = mid; }
    out[a] = Math.sqrt(lo * hi);
  }
  return out;
}
module.exports = { powerTable };
if (require.main === module) {
  const variants = { '기본': {} };
  if (process.argv[2]) Object.assign(variants, require(process.argv[2]));
  for (const sc of (process.env.MID ? [{ slots: 8, budget: 50 }, { slots: 6, budget: 30 }] : [{ slots: 8, budget: 50 }])) {
    console.log(`\n--- ${sc.slots}칸 예산 ${sc.budget}: 50% 승률이 되는 피해 배율(HPM=1이면 체력 배율) (낮을수록 강함)`);
    for (const [k, v] of Object.entries(variants)) {
      const p = powerTable(Object.assign({}, BASE_CFG, v), sc);
      const vals = Object.values(p); const lg = vals.map(Math.log); const m = lg.reduce((a, b) => a + b) / lg.length; const sd = Math.sqrt(lg.reduce((a, b) => a + (b - m) ** 2, 0) / lg.length);
      console.log(`[${k}] 로그 SD ${sd.toFixed(3)}`);
      console.log('  ' + Object.entries(p).sort((a, b) => a[1] - b[1]).map(([n, x]) => `${n} ${x.toFixed(2)}`).join(' | '));
    }
  }
}
