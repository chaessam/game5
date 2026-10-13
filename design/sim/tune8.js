const { BASE_CFG } = require('./data.js');
const { roundRobin } = require('./rr.js');
const scs = [{ slots: 8, budget: 50 }, { slots: 6, budget: 30 }];
const K = (o) => Object.assign({}, BASE_CFG.k, o);
const A = { // 6의 배수 코어 하향
  unitOverride: { 12: { hp: 850 }, 18: { hp: 850, atk: 22 }, 24: { hp: 900 }, 36: { hp: 1150 } },
  tri: [0, 30, 60, 100], rich: [0, 0.25, 0.4, 0.6], even: [0, 0.2, 0.4, 0.7],
};
const B = Object.assign({}, A, { // 1 상향 + 단단 상향 + 약체 노래 상향
  conductorCounts: 2,
  unitOverride: Object.assign({}, A.unitOverride, { 1: { hp: 900, atk: 15 }, 13: { hp: 950 }, 17: { hp: 900 }, 9: { hp: 700 }, 21: { hp: 850 } }),
  prime: [1, 2, 2.5, 3],
  k: K({ 9: 22, 5: 14, 11: 10, 13: 3, 17: 7, 21: 1.25, '18s': 2 }),
  healChorusFactor: 0.5,
});
const C = Object.assign({}, B, { primeHp: true, primeDR: [0, 0.1, 0.2, 0.3] });
const D = Object.assign({}, C, { ninja: [0, 0.35, 0.7], hunter: [0, 0.35, 0.7], star5: [0, 4, 8, 12] });
const V = { '기본': {}, 'A 6배수코어 하향': A, 'B A+1/단단/약체 상향': B, 'C B+단단 피해감소': C, 'D C+닌자/사냥꾼/별빛': D };
for (const sc of scs) {
  console.log(`\n--- ${sc.slots}칸 예산 ${sc.budget}`);
  let names; const rows = [];
  for (const [k, v] of Object.entries(V)) { const r = roundRobin(Object.assign({}, BASE_CFG, v), sc); names = r.ns; rows.push([k, r]); }
  console.log('변형'.padEnd(18) + names.map(n => n.slice(0, 4).padStart(6)).join('') + '  중앙박 시간초과 표준편차');
  for (const [k, r] of rows) { const vals = names.map(n => r.avg[n]); const m = vals.reduce((a,b)=>a+b)/vals.length; const sd = Math.sqrt(vals.reduce((a,b)=>a+(b-m)**2,0)/vals.length);
    console.log(k.padEnd(18) + names.map(n => (100 * r.avg[n]).toFixed(0).padStart(6)).join('') + `  ${r.med}  ${(100 * r.toRate).toFixed(1)}%  ${(100*sd).toFixed(0)}`); }
}
module.exports = { A, B, C, D };
