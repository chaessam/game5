const { BASE_CFG } = require('./data.js');
module.exports = {
  hpScale: 1.15,
  rich: [0, 0.2, 0.35, 0.5],
  tri: [0, 30, 60, 100],
  even: [0, 0.25, 0.5, 0.75],
  knightSelf: [0, 0.15, 0.3],
  prime: [1, 1.5, 2.5, 3],
  primeDR: [0, 0.1, 0.2, 0.3],
  conductorCounts: 2,
  ninja: [0, 0.3, 0.6],
  k: Object.assign({}, BASE_CFG.k, { 9: 24, 5: 14, 11: 10, 13: 3, 17: 7, 36: 6, '18s': 2, 21: 1.3, 25: 11 }),
  unitOverride: { 1: { hp: 900, atk: 15 }, 18: { hp: 900 }, 36: { hp: 1150 }, 17: { hp: 900 }, 13: { hp: 950 }, 9: { hp: 700 }, 4: { hp: 850 }, 2: { hp: 500 }, 21: { hp: 850 } },
};
