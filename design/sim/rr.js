const { buildComp, placements, matchup, median } = require('./lib.js');
const { COMPS } = require('./comps.js');
function roundRobin(cfg, sc, comps = COMPS, NV = 5) {
  const built = {}, vars = {};
  for (const n of Object.keys(comps)) {
    if (sc.slots < 8 && n.startsWith('변신')) continue;
    built[n] = buildComp(comps[n], sc.slots, sc.budget || 1e9, cfg);
    if (!sc.budget) built[n].units.forEach(u => (u.s = 1));
    vars[n] = placements(built[n].units, NV, 7);
  }
  const ns = Object.keys(built), M = {}; ns.forEach(a => (M[a] = {}));
  const beats = []; let to = 0, tot = 0;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const r = matchup(vars[ns[i]], vars[ns[j]], cfg);
    const wr = (r.w + 0.5 * r.d) / r.n; M[ns[i]][ns[j]] = wr; M[ns[j]][ns[i]] = 1 - wr;
    beats.push(...r.beats); to += r.to; tot += r.n;
  }
  const avg = {}; ns.forEach(a => { const o = ns.filter(b => b !== a); avg[a] = o.reduce((s, b) => s + M[a][b], 0) / o.length; });
  return { ns, M, avg, built, vars, med: median(beats), toRate: to / tot };
}
module.exports = { roundRobin };
