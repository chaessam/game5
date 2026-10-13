const V = require('./tunedV2.js');
module.exports = { 'V2': V, 'V2+체력1.1': Object.assign({}, V, { hpScale: 1.1 }) };
