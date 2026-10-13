const { BASE_CFG } = require('./data.js');
const K = o => Object.assign({}, BASE_CFG.k, o);
module.exports = {
  '36 노래·리허설 0': { k: K({ 36: 0 }) },
  '전체공격 노래 절반(17·20·24·36)': { k: K({ 36: 4, 24: 2, 20: 3.5, 17: 3 }) },
  '12·18 기사 체력 850': { unitOverride: { 12: { hp: 850 }, 18: { hp: 850 } } },
};
