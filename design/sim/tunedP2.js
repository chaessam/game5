const P = require('./tunedP.js');
module.exports = Object.assign({}, P, {
  tri: [0, 25, 50, 80],                 // 세모 방패 더 하향
  rich: [0, 0.25, 0.35, 0.5],
  star5: [0, 4, 8, 12],                 // 별빛 +3/+6/+10 → +4/+8/+12
  hunter: [0, 0.3, 0.7], ninja: [0, 0.3, 0.6],
  unitOverride: Object.assign({}, P.unitOverride, { 24: { hp: 900 }, 4: { hp: 750, atk: 16 }, 8: { hp: 700 }, 16: { hp: 700 }, 10: { hp: 750 } }),
});
