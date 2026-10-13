const P3 = require('./tunedP3.js');
module.exports = Object.assign({}, P3, { conductorCounts: 1, conductorUnlock: 3.5, multCap: 4, unitOverride: Object.assign({}, P3.unitOverride, { 1: { hp: 1000, atk: 20 } }) });
