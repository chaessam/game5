const { BASE_CFG } = require('./data.js');
const { roundRobin } = require('./rr.js');
const { A, B, K } = require('./tune8_cfg.js');
const E = { chorus: [1, 1, 1.5, 2, 2.5, 2.5], multCap: 3 };
const F = Object.assign({}, E, { k: K({ 36: 5, 24: 3, 20: 5, 17: 5 }) });
const G = Object.assign({}, B, F, { k: Object.assign({}, B.k, F.k) });
const V = { '기본': {}, 'E 합창5+ 2.5·상한3': E, 'F E+전체노래 계수↓': F, 'G F+B': G };
for (const sc of [{ slots: 8, budget: 50 }, { slots: 6, budget: 30 }]) {
  console.log(`\n--- ${sc.slots}칸 예산 ${sc.budget}`);
  let names; const rows = [];
  for (const [k, v] of Object.entries(V)) { const r = roundRobin(Object.assign({}, BASE_CFG, v), sc); names = r.ns; rows.push([k, r]); }
  console.log('변형'.padEnd(18) + names.map(n => n.slice(0, 4).padStart(6)).join('') + '  중앙박 시간초과 SD');
  for (const [k, r] of rows) { const vals = names.map(n => r.avg[n]); const m = vals.reduce((a,b)=>a+b)/vals.length; const sd = Math.sqrt(vals.reduce((a,b)=>a+(b-m)**2,0)/vals.length);
    console.log(k.padEnd(18) + names.map(n => (100 * r.avg[n]).toFixed(0).padStart(6)).join('') + `  ${r.med}  ${(100 * r.toRate).toFixed(1)}%  ${(100*sd).toFixed(0)}`); }
}
