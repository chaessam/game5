// 두 덱의 전투를 글자 로그로 본다: npm run battle -- "대합창" "다이아 독창" [--basic]
import { runBattle, formatBattleLog } from '../src/engine';
import { META_DECKS } from '../src/sim/decks';
import { buildComp, placements } from '../src/sim/arena';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const showBasic = process.argv.includes('--basic');
const [a = '대합창', b = '다이아 독창'] = args;
for (const name of [a, b]) {
  if (!META_DECKS[name]) {
    console.error(`덱 이름을 찾을 수 없어요: ${name}\n가능한 덱: ${Object.keys(META_DECKS).join(', ')}`);
    process.exit(1);
  }
}
const boardA = placements(buildComp(META_DECKS[a], 8, 50).pieces, 1, 7)[0];
const boardB = placements(buildComp(META_DECKS[b], 8, 50).pieces, 1, 8)[0];
const show = (name: string, board: typeof boardA) =>
  console.log(`${name}: ${board.map((u) => `${u.star > 1 ? u.star + '성 ' : ''}${u.char}${u.items?.length ? '[' + u.items.join(',') + ']' : ''}@${u.row ? '뒤' : '앞'}${u.col}`).join('  ')}`);
show(`A ${a}`, boardA);
show(`B ${b}`, boardB);
console.log(formatBattleLog(runBattle(boardA, boardB, { log: true }), { hideBasic: !showBasic }));
