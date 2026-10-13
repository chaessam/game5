const P3 = require('./tunedP3.js');
const o = { a: { 1: { hp: 1100, atk: 30 } }, b: { 1: { hp: 900, atk: 15, cost: 3 } }, c: { 1: { hp: 1100, atk: 25, cost: 4 } } }['c'];
module.exports = Object.assign({}, P3, { unitOverride: Object.assign({}, P3.unitOverride, o) });
