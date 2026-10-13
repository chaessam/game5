const F = require('./tunedFinal.js');
const A = Object.assign({}, F, { conductorAdj: true, conductorCounts: 1, conductorShieldMin: 2 });
const B = Object.assign({}, A, { famTiersBy: { tri: [3, 5, 7] } });
const C = Object.assign({}, A, { famTiersBy: { tri: [3, 5, 7], rich: [3, 5, 7] } });
const D = Object.assign({}, A, { primeOnlySolo: true });
const E = Object.assign({}, C, { primeOnlySolo: true });
const G = Object.assign({}, E, { hpScale: 1.1 });
module.exports = { '최종안F': F, 'A 지휘자이웃': A, 'B A+세모357': B, 'C A+세모부자357': C, 'D A+단단끼리혼자': D, 'E C+D': E, 'G E+체력1.1': G };
