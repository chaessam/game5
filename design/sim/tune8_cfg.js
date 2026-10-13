const { BASE_CFG } = require('./data.js');
const K = (o) => Object.assign({}, BASE_CFG.k, o);
const A = { unitOverride: { 12: { hp: 850 }, 18: { hp: 850, atk: 22 }, 24: { hp: 900 }, 36: { hp: 1150 } }, tri: [0, 30, 60, 100], rich: [0, 0.25, 0.4, 0.6], even: [0, 0.2, 0.4, 0.7] };
const B = Object.assign({}, A, { conductorCounts: 2, unitOverride: Object.assign({}, A.unitOverride, { 1: { hp: 900, atk: 15 }, 13: { hp: 950 }, 17: { hp: 900 }, 9: { hp: 700 }, 21: { hp: 850 } }), prime: [1, 2, 2.5, 3], k: K({ 9: 22, 5: 14, 11: 10, 13: 3, 17: 7, 21: 1.25, '18s': 2 }), healChorusFactor: 0.5 });
module.exports = { A, B, K };
