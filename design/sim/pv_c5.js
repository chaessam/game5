const V=require('./tunedV4.js');
module.exports = { 'V4': V, 'V4 단단1.5/2.5/3': Object.assign({}, V, { prime: [1, 1.5, 2.5, 3] }), 'V4 단단1.5/2/3': Object.assign({}, V, { prime: [1, 1.5, 2, 3] }) };
