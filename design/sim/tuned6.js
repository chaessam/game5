const T5 = require('./tuned5.js');
module.exports = Object.assign({}, T5, {
  knightSelf: [0, 0.1, 0.25],
  even: [0, 0.3, 0.55, 0.8],
  unitOverride: Object.assign({}, T5.unitOverride, { 12: { hp: 850 }, 18: { hp: 850 } }),
});
