const { BASE_CFG } = require('./data.js');
module.exports = {
  '세모방패 끔': { tri: [0, 0, 0, 0] },
  '짝꿍 끔': { even: [0, 0, 0, 0] },
  '부자분열 끔': { rich: [0, 0, 0, 0] },
  '치유·보호 노래 0': { k: Object.assign({}, BASE_CFG.k, { 2: 0, 4: 0, 6: 0, 13: 0, '18s': 0, 12: 0, '15s': 0 }), noHeal24: true },
  '합창 끔': { chorus: [1, 1, 1, 1, 1, 1] },
};
