const { UNITS, BASE_CFG } = require('./data.js');
const { battle } = require('./engine.js');
const { rng, buildComp, placements } = require('./lib.js');
const cfg = process.argv[2] ? Object.assign({}, BASE_CFG, require(process.argv[2])) : BASE_CFG;
const R = rng(99); const chars = Object.keys(UNITS).map(Number);
const comps = [];
while (comps.length < 200) { const pool = chars.slice(), pick = []; while (pick.length < 8) pick.push(pool.splice(Math.floor(R() * pool.length), 1)[0]); const b = buildComp(pick, 8, 50, cfg); if (b.spent > 50) continue; comps.push(placements(b.units, 1, comps.length + 1)[0]); }
const S = { song: 0, reh: 0, basic: 0, heal: 0, hs: 0, tri: 0, minionHp: 0, coinHp: 0, startHp: 0 };
for (let i = 0; i < 2000; i++) {
  const a = comps[Math.floor(R() * 200)], b = comps[Math.floor(R() * 200)];
  const r = battle(a, b, cfg);
  for (const t of r.T) for (const u of t) { S.song += u.stats.songDmg; S.basic += u.stats.basicDmg; S.heal += u.stats.heal; if (!u.minion) S.startHp += u.maxHp; }
  for (const k of ['hs', 'tri', 'minionHp', 'coinHp']) S[k] += r.acc[k];
}
const tot = S.song + S.basic;
console.log(`피해 비중: 노래(리허설 포함) ${(100 * S.song / tot).toFixed(1)}%, 기본공격(짝꿍 추가타 포함) ${(100 * S.basic / tot).toFixed(1)}%`);
console.log(`방어 자원(시작 체력 대비): 노래 회복·보호막 ${(100 * S.heal / S.startHp).toFixed(1)}%, 손잡기 ${(100 * S.hs / S.startHp).toFixed(1)}%, 세모방패 ${(100 * S.tri / S.startHp).toFixed(1)}%, 부자꼬마 체력 ${(100 * S.minionHp / S.startHp).toFixed(1)}%, 용 금화 ${(100 * S.coinHp / S.startHp).toFixed(1)}%`);
