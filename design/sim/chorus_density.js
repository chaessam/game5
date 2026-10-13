// 정적 분석: 조합별 48박(또는 30박) 동안 노래 사건 중 합창 비율과 평균 합창 배율 (쓰러짐 무시)
const { COMPS } = require('./comps.js');
const { applyStones } = require('./engine.js');
const ch = [1, 1, 1.5, 2, 2.5, 3];
for (const upto of [30, 48]) {
  console.log(`\n${upto}박까지`);
  for (const [n, l] of Object.entries(COMPS)) {
    const nums = l.map(x => (typeof x === 'number' ? x : applyStones(x.c, x.st)));
    let ev = 0, chev = 0, msum = 0, solo = 0;
    for (let b = 1; b <= upto; b++) { const s = nums.filter(x => b % x === 0); const k = s.length; if (!k) continue; ev += k; if (k >= 2) chev += k; else solo++; msum += k * ch[Math.min(5, k)]; }
    console.log(`  ${n.padEnd(12)} 노래 ${String(ev).padStart(3)}번, 합창 속 ${(100 * chev / ev).toFixed(0).padStart(3)}%, 평균배율 ${(msum / ev).toFixed(2)}, 혼자 노래 ${solo}번`);
  }
}
