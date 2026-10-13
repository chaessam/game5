const { BASE_CFG } = require('./data.js');
const { roundRobin } = require('./rr.js');
const T = process.argv[2] ? require(process.argv[2]) : {};
const sc = { slots: 8, budget: 50 };
const famOff = { tri: [0, 0, 0, 0], even: [0, 0, 0, 0], rich: [0, 0, 0, 0], star5: [0, 0, 0, 0], prime: [1, 1, 1, 1], primeDR: [0, 0, 0, 0] };
const roleOff = { knightSelf: [0, 0, 0], knightAll: [0, 0, 0], ninja: [0, 0, 0], hunter: [0, 0, 0], mage: [0, 0, 0], singer: [0, 0, 0], healer: [0, 0, 0] };
const V = { '기본': {}, '가문 전부 끔': famOff, '역할보너스 전부 끔': roleOff, '둘 다 끔': Object.assign({}, famOff, roleOff),
  '짝꿍 3/6/9단계': { famTiersEven: [3, 6, 9] }, '짝꿍3/6/9+세모·부자 하향': { famTiersEven: [3, 6, 9], tri: [0, 30, 50, 80], rich: [0, 0.2, 0.3, 0.4] },
};
let names; const rows = [];
for (const [k, v] of Object.entries(V)) { const r = roundRobin(Object.assign({}, BASE_CFG, T, v), sc); names = r.ns; rows.push([k, r]); }
console.log('변형'.padEnd(14) + names.map(n => n.slice(0, 4).padStart(6)).join('') + '  중앙박 시간초과');
for (const [k, r] of rows) console.log(k.padEnd(14) + names.map(n => (100 * r.avg[n]).toFixed(0).padStart(6)).join('') + `  ${r.med}  ${(100 * r.toRate).toFixed(1)}%`);
