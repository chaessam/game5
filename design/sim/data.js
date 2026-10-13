// 숫자체스 유닛/설정 데이터 (설계 JSON의 출발값)
const UNITS = {
  1: { cost: 5, hp: 700, atk: 12, role: 'singer', name: '하나쌤' },
  2: { cost: 1, hp: 550, atk: 15, role: 'healer', name: '토끼' },
  3: { cost: 1, hp: 550, atk: 18, role: 'singer', name: '다람쥐' },
  4: { cost: 1, hp: 750, atk: 15, role: 'knight', name: '거북' },
  5: { cost: 1, hp: 500, atk: 17, role: 'mage', name: '별이' },
  6: { cost: 1, hp: 550, atk: 15, role: 'healer', name: '꿀벌' },
  7: { cost: 1, hp: 500, atk: 21, role: 'hunter', name: '고양이' },
  8: { cost: 2, hp: 650, atk: 23, role: 'ninja', name: '문어' },
  9: { cost: 2, hp: 600, atk: 21, role: 'mage', name: '구미호' },
  10: { cost: 2, hp: 750, atk: 23, role: 'hunter', name: '볼링곰' },
  11: { cost: 2, hp: 600, atk: 25, role: 'ninja', name: '쌍검' },
  12: { cost: 3, hp: 950, atk: 24, role: 'knight', name: '시계기사' },
  13: { cost: 3, hp: 850, atk: 22, role: 'healer', name: '제빵사' },
  15: { cost: 2, hp: 850, atk: 22, role: 'knight', name: '떡방아' },
  16: { cost: 2, hp: 650, atk: 24, role: 'hunter', name: '종이비행기' },
  17: { cost: 3, hp: 800, atk: 25, role: 'singer', name: '매미' },
  18: { cost: 3, hp: 1000, atk: 25, role: 'knight', name: '트럭' },
  20: { cost: 4, hp: 900, atk: 32, role: 'mage', name: '부엉이' },
  21: { cost: 3, hp: 800, atk: 30, role: 'ninja', name: '주사위' },
  24: { cost: 4, hp: 1000, atk: 30, role: 'singer', name: '해님' },
  25: { cost: 4, hp: 950, atk: 34, role: 'hunter', name: '빙고' },
  28: { cost: 4, hp: 950, atk: 38, role: 'ninja', name: '닌자28' },
  30: { cost: 5, hp: 1150, atk: 32, role: 'healer', name: '달님' },
  36: { cost: 5, hp: 1300, atk: 38, role: 'mage', name: '용' },
};

// 조정 손잡이(기본 = 설계 출발값)
const BASE_CFG = {
  maxBeat: 48,
  hotBeat: 36,
  hotMult: 2,
  chorus: [1, 1, 1.5, 2, 2.5, 3], // index = k (5 이상은 5)
  multCap: 4,
  handshakePer: 10,
  handshakeCap: 200,
  rehearsalMin: 24,
  rehearsalPow: 0.5,
  even: [0, 0.3, 0.6, 1.0],
  tri: [0, 40, 90, 150],
  star5: [0, 3, 6, 10],
  starMaxStacks: 6,
  prime: [1, 1.5, 2, 3],
  rich: [0, 0.3, 0.5, 0.8],
  knightSelf: [0, 0.2, 0.4],
  knightAll: [0, 0, 0.1],
  ninja: [0, 0.2, 0.5],
  hunter: [0, 0.25, 0.6],
  mage: [0, 0.3, 0.7],
  singer: [0, 0.5, 1.0],
  healer: [0, 0.3, 0.7],
  famTiers: [2, 4, 6],
  roleTiers: [2, 4],
  // 노래 계수 (숫자 × 계수)
  k: {
    2: 7, 3: 14, 4: 6, 5: 12, 6: 2, 7: 2, 8: 2, 9: 16, 10: 8, 11: 8,
    12: 10, 13: 2, 15: 5, '15s': 6, 16: 8, 17: 6, 18: 5, '18s': 3, 20: 7,
    21: 1, 24: 4, 25: 10, 28: 0.75, 30: 5, 36: 8, minion: 10,
  },
  stunDiv: { 5: 5, 12: 6, 20: 10 },
  weakDiv: { 8: 4, 17: 6 },
  coinHp: 60, coinAtk: 4, coinMax: 8,
  conductorCounts: 1, // 1 하나쌤이 합창 인원에 더하는 수
  conductorSings: true,
  hpScale: 1,
  unitOverride: {}, // {num:{hp,atk,cost}}
  knightTauntRow: 0,
};

function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
function divCount(n) { let c = 0; for (let i = 1; i <= n; i++) if (n % i === 0) c++; return c; }
function divisors(n) { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; }
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
function families(n) {
  const f = [];
  if (n % 2 === 0) f.push('even');
  if (n % 3 === 0) f.push('tri');
  if (n % 5 === 0) f.push('five');
  if (divCount(n) === 2) f.push('prime');
  if (divCount(n) >= 6) f.push('rich');
  return f;
}
function splitPair(n) {
  let best = null;
  for (let a = 2; a * a <= n; a++) if (n % a === 0) best = [a, n / a];
  return best;
}
module.exports = { UNITS, BASE_CFG, isPrime, divCount, divisors, gcd, families, splitPair };
