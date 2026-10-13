// 지배 조합(대합창(1없음)·기사성벽)을 이기는 카운터 조합 탐색 (언덕 오르기)
const { UNITS, BASE_CFG } = require('./data.js');
const { rng, buildComp, placements, matchup } = require('./lib.js');
const { COMPS } = require('./comps.js');
const cfg = Object.assign({}, BASE_CFG, process.argv[2] ? require(process.argv[2]) : {});
const targets = ['대합창(1없음)', '기사성벽'].map(n => placements(buildComp(COMPS[n], 8, 50, cfg).units, 4, 7));
const chars = Object.keys(UNITS).map(Number);
const R = rng(42);
function evalList(list) { const b = buildComp(list, 8, 50, cfg); if (b.spent > 50) return -1; const v = placements(b.units, 4, 7, 15); let w = 0, n = 0; for (const t of targets) { const r = matchup(v, t, cfg); w += r.w + 0.5 * r.d; n += r.n; } return w / n; }
let best = null, bs = -1;
for (let rs = 0; rs < 4; rs++) {
  let cur = []; const pool = chars.slice(); while (cur.length < 8) cur.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  let cs = evalList(cur);
  for (let it = 0; it < 150; it++) {
    const nx = cur.slice(); const i = Math.floor(R() * 8); const cand = chars.filter(c => !nx.includes(c)); nx[i] = cand[Math.floor(R() * cand.length)];
    if (R() < 0.3) { const j = Math.floor(R() * 8); [nx[i], nx[j]] = [nx[j], nx[i]]; } // 순서(★ 우선순위) 변경
    const s = evalList(nx); if (s >= cs) { cur = nx; cs = s; }
  }
  if (cs > bs) { bs = cs; best = cur; }
  console.log(`재시작 ${rs}: ${cur.join(',')} → 지배 조합 상대 승률 ${(100 * cs).toFixed(0)}%  (${buildComp(cur, 8, 50, cfg).units.map(u => u.c + '★' + u.s).join(' ')})`);
}
