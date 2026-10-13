const { BASE_CFG } = require('./data.js');
const K = o => Object.assign({}, BASE_CFG.k, o);
module.exports = Object.assign({}, require('./pv_ablate.js'), {
  '36 노래 0': { k: K({ 36: 0 }) },
  '손잡기 끔': { handshakePer: 0 },
  '기사 감소 끔': { knightSelf: [0, 0, 0], knightAll: [0, 0, 0] },
  '금화 끔': { coinHp: 0, coinAtk: 0 },
  '리허설 끔': { rehearsalMin: 99 },
});
