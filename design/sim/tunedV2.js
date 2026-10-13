// 최종 기획서 확정안 = tunedFinal + 구조 수정(지휘자 이웃, 세모·부자 3/5/7, 단단끼리 혼자) + 6의 배수 코어 추가 하향
const F = require('./tunedFinal.js');
module.exports = Object.assign({}, F, {
  conductorAdj: true, conductorCounts: 1, conductorShieldMin: 2,
  famTiersBy: { tri: [3, 5, 7], rich: [3, 5, 7] },
  primeOnlySolo: true,
  even: [0, 0.3, 0.6, 0.8],
  unitOverride: Object.assign({}, F.unitOverride, { 12: { hp: 850 }, 18: { hp: 850, atk: 23 } }),
});
