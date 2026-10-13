const { UNITS, BASE_CFG } = require('./data.js');
const { buildComp } = require('./lib.js');
const { COMPS } = require('./comps.js');
for (const [n, l] of Object.entries(COMPS)) {
  const b = buildComp(l, 8, 50, BASE_CFG);
  let hp = 0, atk = 0, kn = 0;
  b.units.forEach(u => { hp += UNITS[u.c].hp * u.s; atk += UNITS[u.c].atk * u.s; if (UNITS[u.c].role==='knight') kn++; });
  console.log(n.padEnd(12), 'spent', b.spent.toFixed(0).padStart(3), 'HP', hp, 'ATK', atk, 'HPxATK/1e6', (hp*atk/1e6).toFixed(1), 'knights', kn);
}
