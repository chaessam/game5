const F = require('./tunedFinal.js');
const { BASE_CFG } = require('./data.js');
const A = Object.assign({}, F, { conductorAdj: true, conductorCounts: 1, conductorShieldMin: 2, famTiersBy: { tri: [3, 5, 7], rich: [3, 5, 7] }, primeOnlySolo: true });
const K = o => Object.assign({}, A.k, o);
module.exports = {
  'base': A,
  '짝꿍끔': Object.assign({}, A, { even: [0,0,0,0] }),
  '세모끔': Object.assign({}, A, { tri: [0,0,0,0] }),
  '부자끔': Object.assign({}, A, { rich: [0,0,0,0] }),
  '가수끔': Object.assign({}, A, { singer: [0,0,0] }),
  '기사끔': Object.assign({}, A, { knightSelf: [0,0,0], knightAll:[0,0,0] }),
  '합창끔': Object.assign({}, A, { chorus: [1,1,1,1,1,1] }),
  '36노래0': Object.assign({}, A, { k: K({36:0}) }),
  '24노래0': Object.assign({}, A, { k: K({24:0}) }),
  '리허설끔': Object.assign({}, A, { rehearsalMin: 99 }),
};
