// 무작위 조합 필드: 카드별 출전 승률, 가문/역할 단계별 승률, 큰 수 노래 사용률
const { UNITS, BASE_CFG, families } = require('./data.js');
const { battle } = require('./engine.js');
const { rng, buildComp, placements, median } = require('./lib.js');
const { computeSynergy, makeTeam } = require('./engine.js');
const cfg = process.argv[2] ? Object.assign({}, BASE_CFG, require(process.argv[2])) : BASE_CFG;
const SLOTS = +(process.env.SLOTS || 8), BUDGET = +(process.env.BUDGET || 50), NC = +(process.env.NC || 500), OPP = +(process.env.OPP || 40);
const R = rng(12345);
const chars = Object.keys(UNITS).map(Number);
const comps = [];
while (comps.length < NC) {
  const pool = chars.slice(); const pick = [];
  while (pick.length < SLOTS) pick.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  const b = buildComp(pick, SLOTS, BUDGET, cfg);
  if (b.spent > BUDGET) continue; // 예산 초과 조합 제외
  // 무작위 순서 → 업그레이드 대상도 무작위성
  comps.push({ units: placements(b.units, 1, comps.length + 1)[0], spent: b.spent });
}
const score = comps.map(() => ({ w: 0, n: 0 }));
const beats = []; let to = 0;
const songUse = {}; chars.forEach(c => (songUse[c] = { battles: 0, sang: 0, aliveEnd: 0 }));
for (let i = 0; i < NC; i++) for (let k = 0; k < OPP; k++) {
  const j = Math.floor(R() * NC); if (j === i) continue;
  const r = battle(comps[i].units, comps[j].units, cfg);
  const w = r.winner === 'draw' ? 0.5 : r.winner === 0 ? 1 : 0;
  score[i].w += w; score[i].n++; score[j].w += 1 - w; score[j].n++;
  beats.push(r.beat); if (r.timeout) to++;
  for (const t of r.T) for (const u of t) if (!u.minion) { const s = songUse[u.char]; s.battles++; if (u.stats.songs > 0) s.sang++; if (u.alive && u.hp > 0) s.aliveEnd++; }
}
const wr = score.map(s => s.w / s.n);
console.log(`무작위 ${NC}조합(${SLOTS}칸, 실효예산 ${BUDGET}) 각 ~${OPP * 2}전, 전투 중앙값 ${median(beats)}박, 시간초과 ${(100 * to / beats.length).toFixed(1)}%`);
// 카드별
const card = {};
chars.forEach(c => (card[c] = { w: 0, n: 0 }));
comps.forEach((cp, i) => cp.units.forEach(u => { card[u.c].w += wr[i]; card[u.c].n++; }));
console.log('\n카드별 출전 승률 (목표 0.44~0.58)  | 박자 노래 1번 이상 쓴 비율 | 끝까지 생존');
chars.sort((a, b) => card[b].w / card[b].n - card[a].w / card[a].n).forEach(c => {
  const s = songUse[c];
  console.log(`  ${String(c).padStart(2)} ${UNITS[c].name.padEnd(6)} ${UNITS[c].cost}골 ${UNITS[c].role.padEnd(6)} ${(card[c].w / card[c].n).toFixed(3)}  (n=${card[c].n})  노래 ${(100 * s.sang / s.battles).toFixed(0)}%  생존 ${(100 * s.aliveEnd / s.battles).toFixed(0)}%`);
});
// 가문/역할 단계별
const tierStat = {};
comps.forEach((cp, i) => {
  const team = makeTeam(cp.units, 0, cfg); const syn = computeSynergy(team, cfg);
  for (const [k, v] of Object.entries(syn.ft)) { const key = 'F:' + k + v; (tierStat[key] = tierStat[key] || { w: 0, n: 0 }); tierStat[key].w += wr[i]; tierStat[key].n++; }
  for (const [k, v] of Object.entries(syn.rt)) { const key = 'R:' + k + v; (tierStat[key] = tierStat[key] || { w: 0, n: 0 }); tierStat[key].w += wr[i]; tierStat[key].n++; }
});
console.log('\n가문/역할 단계별 평균 승률 (숫자 = 단계)');
Object.keys(tierStat).sort().forEach(k => console.log(`  ${k.padEnd(10)} ${(tierStat[k].w / tierStat[k].n).toFixed(3)}  n=${tierStat[k].n}`));
// 1 포함 여부
