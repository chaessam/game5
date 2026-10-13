const P2 = require('./tunedP2.js');
module.exports = Object.assign({}, P2, {
  chorus: [1, 1, 1.5, 2, 2.5, 2.5],     // 5명 이상 ×3 → ×2.5 (4명과 같음)
  multCap: 3.5,                          // 노래 배율 상한 ×4 → ×3.5
  k: Object.assign({}, P2.k, { 3: 12 }), // 3 다람쥐 숫자×14 → ×12
});
