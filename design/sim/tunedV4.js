// 최종 기획서 확정안(V4) = tunedV2 + 하나쌤: 이웃이 노래할 때만 함께(합창 2명 몫), 2명 이상 함께면 보호막 30×다른 친구 수, 체력1300 공격26 값4
const V=require('./tunedV2.js'); module.exports = Object.assign({}, V, { conductorCounts: 2, conductorShieldMin: 2, conductorShield: 30, unitOverride: Object.assign({}, V.unitOverride, {1:{hp:1300, atk:26, cost:4}}) });
