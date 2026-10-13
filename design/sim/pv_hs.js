const V=require('./tunedV6.js');
module.exports = { 'V6': V, 'V6 손잡기15/250': Object.assign({}, V, { handshakePer: 15, handshakeCap: 250 }) };
