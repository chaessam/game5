const { BASE_CFG } = require('./data.js');
const { battle } = require('./engine.js');
const { buildComp, placements } = require('./lib.js');
const { COMPS } = require('./comps.js');
const cfg = Object.assign({}, BASE_CFG, process.argv[4] ? require(process.argv[4]) : {});
const a = placements(buildComp(COMPS[process.argv[2]], 8, 50, cfg).units, 1, 7)[0];
const b = placements(buildComp(COMPS[process.argv[3]], 8, 50, cfg).units, 1, 7)[0];
const r = battle(a, b, cfg);
console.log('winner', r.winner, 'beat', r.beat);
for (const t of r.T) { console.log('--team', t[0].team); for (const u of t) console.log(`  ${u.minion?'꼬마':''}${u.num}★${u.star} r${u.row}c${u.col} hp ${u.hp}/${u.maxHp} songs ${u.stats.songs} songDmg ${u.stats.songDmg|0} basic ${u.stats.basicDmg|0} heal ${u.stats.heal|0} died@${u.deathBeat}`); }
console.log(r.acc);
