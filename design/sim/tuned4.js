const T3 = require('./tuned3.js');
module.exports = Object.assign({}, T3, {
  healChorusFactor: 0.5,
  k: Object.assign({}, T3.k, { 2: 6 }),
});
