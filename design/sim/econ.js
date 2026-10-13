// 경제 시뮬: 전략별 골드/레벨/보드가치 흐름 + 같은 라운드 보드끼리 전투 승률
const { UNITS, BASE_CFG } = require('./data.js');
const { battle } = require('./engine.js');
const { rng, buildComp, placements } = require('./lib.js');
const E = Object.assign({ base: 5, intDiv: 10, intMax: 3, xpCost: 4, xpPer: 4, autoXp: 2, cum: { 3: 0, 4: 2, 5: 8, 6: 18, 7: 34, 8: 58 }, pveWin: 2, winBonus: 1, rounds: 12, pve: [1, 2, 6, 10] }, process.argv[2] ? require(process.argv[2]) : {});
function levelOf(xp) { let L = 3; for (let l = 4; l <= 8; l++) if (xp >= E.cum[l]) L = l; return L; }
const STRATS = {
  '다 쓰기(레벨 빨리)': { reserve: () => 0, lv: { 3: 5, 5: 6, 7: 7, 9: 8 } },
  '이자30 + 보통AI 레벨': { reserve: r => (r >= 3 && r <= 10 ? 30 : 0), lv: { 2: 4, 5: 5, 7: 6, 9: 7, 11: 8 } },
  '이자30 + 자동레벨만': { reserve: r => (r >= 3 && r <= 11 ? 30 : 0), lv: {} },
  '이자10/20 소극': { reserve: r => (r >= 3 && r <= 10 ? 10 : 0), lv: { 5: 5, 7: 6, 9: 7 } },
  '레벨 안 올리고 ★ 몰빵(자동레벨)': { reserve: () => 0, lv: {} },
};
const PVP = r => !E.pve.includes(r);
function run(strat, winPattern) {
  let gold = 0, xp = 0, value = 0, streak = 0, lastRes = null, lastPve = false, interestTot = 0, incomeTot = 0, xpGold = 0;
  const snap = [];
  for (let r = 1; r <= E.rounds; r++) {
    let inc = E.base;
    if (r > 1) {
      const it = Math.min(E.intMax, Math.floor(gold / E.intDiv)); inc += it; interestTot += it;
      if (streak >= 4) inc += 2; else if (streak >= 2) inc += 1;
      if (lastRes === 'W') inc += E.winBonus;
      if (lastPve) inc += E.pveWin;
      xp += E.autoXp;
    }
    gold += inc; incomeTot += inc;
    // 레벨 목표
    let target = 3; for (const k of Object.keys(strat.lv).map(Number)) if (r >= k) target = Math.max(target, strat.lv[k]);
    while (levelOf(xp) < target && gold >= E.xpCost) { gold -= E.xpCost; xp += E.xpPer; xpGold += E.xpCost; }
    const spend = Math.max(0, gold - strat.reserve(r)); gold -= spend; value += spend;
    snap.push({ r, L: levelOf(xp), value, gold });
    if (PVP(r)) { const w = winPattern(r); streak = lastRes === w ? streak + 1 : 1; lastRes = w; lastPve = false; } else lastPve = true;
  }
  return { snap, incomeTot, interestTot, xpGold, final: snap[snap.length - 1] };
}
const half = r => (r % 2 ? 'W' : 'L');
console.log('전략별 경제 (승패 번갈아 가정)');
const res = {};
for (const [n, s] of Object.entries(STRATS)) {
  const o = run(s, half); res[n] = o;
  console.log(`  ${n.padEnd(22)} 총수입 ${o.incomeTot} (이자 ${o.interestTot}), 경험치에 ${o.xpGold}골드, 최종 레벨 ${o.final.L}, 보드가치 ${o.final.value}`);
  console.log('     라운드별 [레벨/보드가치]: ' + o.snap.map(x => `${x.r}:${x.L}/${x.value}`).join(' '));
}
const allW = run(STRATS['이자30 + 보통AI 레벨'], () => 'W'), allL = run(STRATS['이자30 + 보통AI 레벨'], () => 'L');
console.log(`  (참고) 이자30 전략 전승 총수입 ${allW.incomeTot}, 전패 총수입 ${allL.incomeTot}`);

// 같은 라운드 보드끼리 대결: 무작위 캐릭터(라운드 레벨 기준 상점 확률을 반영하지 않은 근사), 슬롯=레벨, 예산=보드가치
if (process.env.FIGHT) {
  const cfg = BASE_CFG; const chars = Object.keys(UNITS).map(Number);
  const pickComp = (R, slots, budget) => { for (let t = 0; t < 500; t++) { const pool = chars.filter(c => UNITS[c].cost <= (slots <= 4 ? 2 : slots <= 5 ? 3 : slots <= 6 ? 4 : 5)), pick = []; while (pick.length < slots) pick.push(pool.splice(Math.floor(R() * pool.length), 1)[0]); const b = buildComp(pick, slots, budget, cfg); if (b.spent <= budget) return placements(b.units, 1, t + 1, 10)[0]; } return null; };
  const names = Object.keys(STRATS);
  console.log('\n라운드별 전략 대 전략 승률(행 vs 열 평균, 무작위 40조합×40)');
  const R = rng(5);
  const wins = {}; names.forEach(n => (wins[n] = 0));
  for (const r of [3, 5, 7, 9, 11, 12]) {
    const line = [];
    for (const a of names) {
      let w = 0, n = 0;
      for (const b of names) { if (a === b) continue;
        const sa = res[a].snap[r - 1], sb = res[b].snap[r - 1];
        for (let i = 0; i < 25; i++) { const A = pickComp(R, sa.L, sa.value), B = pickComp(R, sb.L, sb.value); if (!A || !B) continue; const x = battle(A, B, cfg); w += x.winner === 0 ? 1 : x.winner === 'draw' ? 0.5 : 0; n++; } }
      line.push(`${a.slice(0, 8)} ${(100 * w / n).toFixed(0)}%`); wins[a] += w / n;
    }
    console.log(`  R${r}: ` + line.join(' | '));
  }
  console.log('  합계(6개 대결 라운드 기대 승수): ' + names.map(n => `${n} ${wins[n].toFixed(2)}`).join(', '));
}
