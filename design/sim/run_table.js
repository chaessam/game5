// 승률표: node run_table.js [cfgfile]
const { BASE_CFG } = require('./data.js');
const { buildComp, placements, matchup, median, pct } = require('./lib.js');
const { COMPS } = require('./comps.js');
const { battle } = require('./engine.js');

const cfg = process.argv[2] ? Object.assign({}, BASE_CFG, require(process.argv[2])) : BASE_CFG;
const SCEN = [
  { name: '중반(6칸, 실효예산 30)', slots: 6, budget: 30 },
  { name: '후반(8칸, 실효예산 50)', slots: 8, budget: 50 },
  { name: '후반 ★1 고정(8칸, 원가 무시)', slots: 8, budget: 0 },
];
const NV = 5;
const names = Object.keys(COMPS).filter(n => !(n.startsWith('변신') && process.env.NOSTONE));

for (const sc of SCEN) {
  const built = {}, vars = {};
  for (const n of names) {
    if (sc.slots < 8 && n.startsWith('변신')) continue;
    built[n] = buildComp(COMPS[n], sc.slots, sc.budget || 1e9, cfg);
    if (!sc.budget) built[n].units.forEach(u => (u.s = 1));
    vars[n] = placements(built[n].units, NV, 7);
  }
  const ns = Object.keys(built);
  console.log(`\n=== ${sc.name} === (행이 열을 상대로 한 승률 %, 무승부 0.5)`);
  for (const n of ns) console.log(`  ${n.padEnd(12)} 원가 ${String(built[n].raw).padStart(3)}  ` + built[n].units.map(u => (u.st.length ? `${u.c}${u.st.join('')}` : u.c) + '★'.repeat(u.s)).join(' '));
  const M = {}, allBeats = []; let to = 0, tot = 0;
  for (const a of ns) { M[a] = {}; }
  for (let i = 0; i < ns.length; i++) for (let j = i; j < ns.length; j++) {
    const r = matchup(vars[ns[i]], vars[ns[j]], cfg);
    const wr = (r.w + 0.5 * r.d) / r.n;
    M[ns[i]][ns[j]] = wr; M[ns[j]][ns[i]] = 1 - wr;
    if (i !== j) { allBeats.push(...r.beats); to += r.to; tot += r.n; }
  }
  const short = ns.map(n => n.slice(0, 4));
  console.log(''.padEnd(13) + short.map(s => s.padStart(5)).join('') + '  평균');
  const avg = {};
  for (const a of ns) {
    const others = ns.filter(b => b !== a);
    avg[a] = others.reduce((s, b) => s + M[a][b], 0) / others.length;
    console.log(a.padEnd(12).slice(0, 12) + ' ' + ns.map(b => (a === b ? '   -' : pct(M[a][b])).padStart(5)).join('') + '  ' + pct(avg[a]));
  }
  console.log(`  전투 길이 중앙값 ${median(allBeats)}박, 48박 시간초과 ${(100 * to / tot).toFixed(1)}%`);
  console.log('  순위: ' + ns.slice().sort((a, b) => avg[b] - avg[a]).map(n => `${n} ${pct(avg[n])}`).join(' > '));
}
