// 컴퓨터끼리 전체 판(12라운드)을 돌려 난이도 차이와 중반 밸런스를 본다.
//   npx tsx tools/ai-sim.ts [판 수=60] [--short]
// 출력: 줄 세우기별 난이도 평균 순위·메달, 2인 맞대결 승률, 어려움이 고른 덱별 평균 순위, 최종 판에 쓰인 카드 평균 순위.

import { advance, createGame, ranking, resolveRound } from '../src/game/game';
import { botFreePick, botPrep, botRewards } from '../src/game/bot';
import { numberOf } from '../src/game/items';
import type { Difficulty, GameState } from '../src/game/types';
import { DEFAULT_CONFIG } from '../src/engine/data';

const args = process.argv.slice(2);
// 실험: --set chorusPct=[100,100,150,215,250] 처럼 밸런스 수치를 바꿔 본다(파일은 그대로)
for (const a of args.filter((x) => x.startsWith('--set'))) {
  const [k, v] = a.slice(6).split('=');
  (DEFAULT_CONFIG as unknown as Record<string, unknown>)[k] = JSON.parse(v);
  console.log(`실험 수치: ${k} = ${v}`);
}
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 60);
const short = args.includes('--short');
// --rule=chorus : 이번 주 규칙을 켜고 잰다
const rule = args.find((a) => a.startsWith('--rule='))?.slice(7) ?? null;
if (rule) console.log(`이번 주 규칙: ${rule}`);

function play(seed: number, diffs: Difficulty[]): GameState {
  const g = createGame({ seed, bots: diffs.length - 1, difficulties: diffs.slice(1), seatZeroBot: diffs[0], short, rule });
  for (const p of g.players) botFreePick(g, p);
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 40) {
    if (g.phase === 'prep') {
      for (const p of g.players) botPrep(g, p);
      resolveRound(g);
    }
    botRewards(g);
    advance(g);
  }
  return g;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const t0 = Date.now();

// --magic: 어려움 4명이 마법 카드를 '아무거나' 고르게 해서 카드마다 평균 순위를 잰다(2.5가 보통)
if (args.includes('--magic')) {
  const { MAGIC_CARDS } = await import('../src/game/magic');
  const { chooseCard } = await import('../src/game/game');
  const st = new Map<string, { rank: number; n: number; first: number }>(MAGIC_CARDS.map((c) => [c.id, { rank: 0, n: 0, first: 0 }]));
  let seedRng = 7;
  const rnd = () => ((seedRng = (seedRng * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    const g = createGame({ seed: 50000 + i, bots: 3, difficulties: ['hard', 'hard', 'hard'], seatZeroBot: 'hard', short, rule });
    for (const p of g.players) botFreePick(g, p);
    let guard = 0;
    while (g.phase !== 'over' && guard++ < 40) {
      if (g.phase === 'prep') {
        for (const p of g.players) {
          if (p.cardChoice) chooseCard(g, p, Math.floor(rnd() * p.cardChoice.length));
          botPrep(g, p);
        }
        resolveRound(g);
      }
      botRewards(g);
      advance(g);
    }
    ranking(g).forEach((p, idx) => {
      for (const c of p.cards ?? []) {
        const s = st.get(c)!;
        s.rank += idx + 1;
        s.n++;
        if (idx === 0) s.first++;
      }
    });
  }
  console.log(`\n## 마법 카드별 평균 순위 (어려움 4명, ${N}판, 카드는 아무거나 고름 — 2.5가 보통, 낮을수록 셈)`);
  [...st.entries()].sort((a, b) => a[1].rank / (a[1].n || 1) - b[1].rank / (b[1].n || 1)).forEach(([id, s]) => {
    const c = MAGIC_CARDS.find((x) => x.id === id)!;
    console.log(`${(s.rank / (s.n || 1)).toFixed(2)}  1등 ${pct(s.first / (s.n || 1)).padStart(4)}  (${String(s.n).padStart(3)}번)  ${c.icon} ${c.name}`);
  });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  process.exit(0);
}

// --decks: 어려움 4명에게 덱을 하나씩 고정해 실제 경제 속 덱 세기를 잰다(중반 밸런스)
if (args.includes('--decks')) {
  const { META_DECKS } = await import('../src/sim/decks');
  const names = Object.keys(META_DECKS);
  const st = new Map<string, { rank: number; medals: number; n: number; first: number }>(names.map((n) => [n, { rank: 0, medals: 0, n: 0, first: 0 }]));
  for (let i = 0; i < N; i++) {
    const R = (k: number) => names[(i * 5 + k * 3 + Math.floor(i / names.length)) % names.length];
    const pickNames: string[] = [];
    for (let k = 0; pickNames.length < 4; k++) if (!pickNames.includes(R(k))) pickNames.push(R(k));
    const g = createGame({ seed: 20000 + i, bots: 3, difficulties: ['hard', 'hard', 'hard'], seatZeroBot: 'hard', short, rule });
    g.players.forEach((p, k) => (p.ai = { deck: pickNames[k], lockDeck: true }));
    for (const p of g.players) botFreePick(g, p);
    let guard = 0;
    while (g.phase !== 'over' && guard++ < 40) {
      if (g.phase === 'prep') {
        for (const p of g.players) botPrep(g, p);
        resolveRound(g);
      }
      botRewards(g);
      advance(g);
    }
    ranking(g).forEach((p, idx) => {
      const s = st.get(p.ai!.deck!)!;
      s.rank += idx + 1;
      s.medals += p.medals;
      s.n++;
      if (idx === 0) s.first++;
    });
  }
  console.log(`# 덱 고정 어려움 4인 (${N}판) — 평균 순위 2.5가 보통, 낮을수록 강함`);
  console.log('덱 | 평균 순위 | 평균 메달 | 1등 | 판 수');
  [...st.entries()].filter(([, v]) => v.n).sort((a, b) => a[1].rank / a[1].n - b[1].rank / b[1].n)
    .forEach(([k, v]) => console.log(`${k} | ${(v.rank / v.n).toFixed(2)} | ${(v.medals / v.n).toFixed(1)} | ${pct(v.first / v.n)} | ${v.n}`));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}초)`);
  process.exit(0);
}

const pairsOnly = args.includes('--pairs');
// 1) 4인: 쉬움·보통·어려움·어려움(자리 돌리기)
if (!pairsOnly) {
  const base: Difficulty[] = ['easy', 'normal', 'hard', 'hard'];
  const agg: Record<Difficulty, { rank: number; medals: number; n: number; first: number }> = {
    easy: { rank: 0, medals: 0, n: 0, first: 0 }, normal: { rank: 0, medals: 0, n: 0, first: 0 }, hard: { rank: 0, medals: 0, n: 0, first: 0 },
  };
  const deckStat = new Map<string, { rank: number; n: number }>();
  const cardStat = new Map<number, { rank: number; n: number }>();
  for (let i = 0; i < N; i++) {
    const diffs = base.map((_, k) => base[(k + i) % 4]);
    const g = play(1000 + i, diffs);
    ranking(g).forEach((p, idx) => {
      const a = agg[p.difficulty];
      a.rank += idx + 1;
      a.medals += p.medals;
      a.n++;
      if (idx === 0) a.first++;
      if (p.difficulty === 'hard' && p.ai?.deck) {
        const d = deckStat.get(p.ai.deck) ?? { rank: 0, n: 0 };
        d.rank += idx + 1;
        d.n++;
        deckStat.set(p.ai.deck, d);
      }
      if (p.difficulty !== 'easy') {
        for (const u of new Set([...p.board.values()].map((x) => x.char))) {
          const c = cardStat.get(u) ?? { rank: 0, n: 0 };
          c.rank += idx + 1;
          c.n++;
          cardStat.set(u, c);
        }
      }
    });
  }
  console.log(`\n# 4인 (${N}판, 자리 돌림): 쉬움·보통·어려움·어려움`);
  console.log('난이도 | 평균 순위 | 평균 메달 | 1등');
  for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
    const a = agg[d];
    console.log(`${d} | ${(a.rank / a.n).toFixed(2)} | ${(a.medals / a.n).toFixed(1)} | ${pct(a.first / a.n)}`);
  }
  console.log('\n## 어려움이 끝에 고른 덱 (평균 순위, 판 수)');
  [...deckStat.entries()].sort((a, b) => a[1].rank / a[1].n - b[1].rank / b[1].n).forEach(([k, v]) => console.log(`${k} | ${(v.rank / v.n).toFixed(2)} | ${v.n}`));
  console.log('\n## 보통·어려움 최종 판 카드 (평균 순위, 출전 수) — 낮을수록 이긴 판에 많이');
  [...cardStat.entries()].sort((a, b) => a[1].rank / a[1].n - b[1].rank / b[1].n).forEach(([k, v]) => console.log(`${k} | ${(v.rank / v.n).toFixed(2)} | ${v.n}`));
}

// 2) 2인 맞대결(메달 비교)
for (const [a, b] of [['easy', 'normal'], ['normal', 'hard'], ['easy', 'hard']] as [Difficulty, Difficulty][]) {
  let wa = 0;
  let wb = 0;
  for (let i = 0; i < N; i++) {
    const swap = i % 2 === 1;
    const g = play(5000 + i, swap ? [b, a] : [a, b]);
    const pa = g.players.find((p) => p.difficulty === a)!;
    const pb = g.players.find((p) => p.difficulty === b)!;
    if (pa.medals > pb.medals) wa++;
    else if (pb.medals > pa.medals) wb++;
  }
  console.log(`\n2인 ${a} vs ${b}: ${a} ${pct(wa / N)} · ${b} ${pct(wb / N)} (나머지 같은 메달)`);
}

// 3) 돌 사용 확인(마지막 판 하나)
{
  const g = play(9999, ['hard', 'hard', 'normal', 'easy']);
  for (const p of g.players) {
    const stones = [...p.board.values()].filter((u) => u.items.length).map((u) => `${u.char}${u.items.join('')}→${numberOf(u)}`);
    console.log(`${p.name}(${p.difficulty}) Lv${p.level} 메달 ${p.medals} 덱 ${p.ai?.deck ?? '-'} 목표 ${p.ai?.fam ?? '-'}/${p.ai?.role ?? '-'} 판 [${[...p.board.values()].map((u) => `${u.char}${'★'.repeat(u.star)}`).join(' ')}] 돌 ${stones.join(' ') || '-'} 가방 ${p.bag.join(',') || '-'}`);
  }
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}초)`);
