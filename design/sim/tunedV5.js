// 최종 기획서 확정안(V5) = V4 + 카드 미세 조정(9·21 상향, 2·36 하향, 15 체력)
const V = require('./tunedV4.js');
module.exports = Object.assign({}, V, {
  k: Object.assign({}, V.k, { 9: 26, 21: 1.5, 2: 6 }),
  unitOverride: Object.assign({}, V.unitOverride, { 15: { hp: 950 }, 36: { hp: 1100 } }),
});
