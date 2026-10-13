const P3 = require('./tunedP3.js');
module.exports = Object.assign({}, P3, { conductorShield: 15, unitOverride: Object.assign({}, P3.unitOverride, { 1: { hp: 1000, atk: 18, cost: 4 } }) });
