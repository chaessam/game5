const V=require('./tunedV2.js'); module.exports = Object.assign({}, V, { conductorShieldMin: 1, conductorShield: 25, unitOverride: Object.assign({}, V.unitOverride, {1:{hp:1100, atk:22, cost:4}}) });
