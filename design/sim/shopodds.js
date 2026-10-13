const odds = {3:[75,25,0,0,0],4:[55,35,10,0,0],5:[40,35,20,5,0],6:[25,35,28,10,2],7:[15,25,33,20,7],8:[10,18,30,28,14]};
const types = [6,6,5,4,3];
console.log('레벨별: 특정 카드 1장이 한 상점(5칸)에 나올 기대 장수 / 1장 얻는 데 드는 평균 새로고침 골드(2골드×기대 새로고침 수)');
for (const L of [3,4,5,6,7,8]) {
  const row = [];
  for (let c = 0; c < 5; c++) { const p = odds[L][c]/100/types[c]; const e = 5*p; row.push(`${c+1}골 ${e.toFixed(2)}장/${e>0?(2/e).toFixed(1):'∞'}g`); }
  console.log(`  Lv${L}: ` + row.join(' | '));
}
