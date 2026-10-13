const V = require('./tunedV2.js');
const fb = (o) => Object.assign({}, V.famTiersBy, o);
module.exports = {
  'V2': V,
  '짝꿍357 0.3/0.6/1.0': Object.assign({}, V, { famTiersBy: fb({ even: [3, 5, 7] }), even: [0, 0.3, 0.6, 1.0] }),
  '짝꿍357 0.3/0.7/1.3': Object.assign({}, V, { famTiersBy: fb({ even: [3, 5, 7] }), even: [0, 0.3, 0.7, 1.3] }),
};
