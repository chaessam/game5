// 최종 제안안 = P3 + 하나쌤 재설계 + 36 용 하향
const P3 = require('./tunedP3.js');
module.exports = Object.assign({}, P3, {
  conductorShield: 15,  // 하나쌤 노래: 매 박, 함께 노래한 다른 친구 수 × 15 보호막을 가장 아픈 친구에게(★배)
  k: Object.assign({}, P3.k, { 36: 6 }),  // 36 브레스 숫자×8 → ×6 (288→216, 리허설 144→108)
  unitOverride: Object.assign({}, P3.unitOverride, { 1: { hp: 1000, atk: 18, cost: 4 } }),
});
