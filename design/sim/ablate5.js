const { BASE_CFG } = require('./data.js');
const { roundRobin } = require('./rr.js');
const sc = { slots: 8, budget: 50 };
const famOff = { tri: [0, 0, 0, 0], even: [0, 0, 0, 0], rich: [0, 0, 0, 0], star5: [0, 0, 0, 0], prime: [1, 1, 1, 1] };
const roleOff = { knightSelf: [0, 0, 0], knightAll: [0, 0, 0], ninja: [0, 0, 0], hunter: [0, 0, 0], mage: [0, 0, 0], singer: [0, 0, 0], healer: [0, 0, 0] };
const mech = { chorus: [1,1,1,1,1,1], handshakePer: 0, rehearsalMin: 99, coinHp: 0, coinAtk: 0 };
const all = Object.assign({}, famOff, roleOff, mech, { k: Object.fromEntries(Object.keys(BASE_CFG.k).map(k => [k, 0])) });
const V = { '순수스탯': all, '순수스탯+도발없음': Object.assign({}, all, { noTaunt: true }), '기본+도발없음': { noTaunt: true } };
let names; const rows = [];
for (const [k, v] of Object.entries(V)) { const r = roundRobin(Object.assign({}, BASE_CFG, v), sc); names = r.ns; rows.push([k, r]); }
console.log('변형'.padEnd(16) + names.map(n => n.slice(0, 4).padStart(6)).join('') + '  중앙박 시간초과');
for (const [k, r] of rows) console.log(k.padEnd(16) + names.map(n => (100 * r.avg[n]).toFixed(0).padStart(6)).join('') + `  ${r.med}  ${(100 * r.toRate).toFixed(1)}%`);
