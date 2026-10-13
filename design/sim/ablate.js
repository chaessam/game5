const { BASE_CFG } = require('./data.js');
const { roundRobin } = require('./rr.js');
const sc = { slots: 8, budget: 50 };
const V = {
  '기본': {},
  '세모방패 끔': { tri: [0, 0, 0, 0] },
  '손잡기 끔': { handshakePer: 0 },
  '리허설 끔': { rehearsalMin: 99 },
  '합창 끔': { chorus: [1, 1, 1, 1, 1, 1] },
  '1 인원+0': { conductorCounts: 0 },
  '기사감소 끔': { knightSelf: [0, 0, 0], knightAll: [0, 0, 0] },
  '부자분열 끔': { rich: [0, 0, 0, 0] },
  '짝꿍 끔': { even: [0, 0, 0, 0] },
  '별빛 끔': { star5: [0, 0, 0, 0] },
  '단단 끔': { prime: [1, 1, 1, 1] },
};
const rows = [];
let names;
for (const [k, v] of Object.entries(V)) {
  const r = roundRobin(Object.assign({}, BASE_CFG, v), sc);
  names = r.ns;
  rows.push([k, r]);
}
console.log('변형'.padEnd(10) + names.map(n => n.slice(0, 4).padStart(6)).join('') + '  중앙박 시간초과');
for (const [k, r] of rows) console.log(k.padEnd(10) + names.map(n => (100 * r.avg[n]).toFixed(0).padStart(6)).join('') + `  ${r.med}  ${(100 * r.toRate).toFixed(1)}%`);
