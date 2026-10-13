// 밸런스 조정 실험: npm exec tsx tools/tune.ts tools/variants.json
// variants.json = { "이름": { ...BalanceConfig 일부, "unitOverrides": { "20": { "ccDiv": 20 } } } }
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, type BalanceConfig } from '../src/engine/data';
import { META_DECKS } from '../src/sim/decks';
import { powerTable, randomField, TARGETS } from '../src/sim/arena';

const file = process.argv[2] ?? 'tools/variants.json';
const variants: Record<string, Partial<BalanceConfig>> = JSON.parse(readFileSync(file, 'utf8'));
const slotsList = process.argv.includes('--mid') ? [8, 6] : [8];

function merge(o: Partial<BalanceConfig>): BalanceConfig {
  const uo: BalanceConfig['unitOverrides'] = { ...DEFAULT_CONFIG.unitOverrides };
  for (const [k, v] of Object.entries(o.unitOverrides ?? {})) uo[Number(k)] = { ...(uo[Number(k)] ?? {}), ...v };
  return { ...DEFAULT_CONFIG, ...o, famTiers: { ...DEFAULT_CONFIG.famTiers, ...(o.famTiers ?? {}) }, unitOverrides: uo };
}

for (const [name, o] of Object.entries(variants)) {
  const cfg = merge(o);
  const t0 = Date.now();
  const parts: string[] = [];
  for (const slots of slotsList) {
    const p = powerTable(META_DECKS, cfg, slots, slots === 8 ? 50 : 30, 3);
    const out = p.rows.filter((r) => r.power < TARGETS.power[0] || r.power > TARGETS.power[1]);
    parts.push(
      `[${slots}칸] SD ${p.logSd.toFixed(3)} 중앙 ${p.medianBeats}박 초과 ${(100 * p.timeoutRate).toFixed(1)}% | ` +
        p.rows.map((r) => `${r.deck} ${r.power.toFixed(2)}`).join(', ') +
        (out.length ? `\n      범위 밖: ${out.map((r) => `${r.deck} ${r.power.toFixed(2)}`).join(', ')}` : ''),
    );
  }
  const f = randomField(cfg, { comps: 300, opponents: 30 });
  const bad = f.cards.filter((c) => c.winRate < TARGETS.cardWinRate[0] || c.winRate > TARGETS.cardWinRate[1]);
  const role = (id: string) => {
    const t0r = f.tiers.find((t) => t.key === `직업 ${id}0`)?.winRate ?? 0;
    const t1r = f.tiers.find((t) => t.key === `직업 ${id}1`)?.winRate ?? 0;
    return `${id} ${(t1r - t0r >= 0 ? '+' : '')}${(t1r - t0r).toFixed(2)}`;
  };
  console.log(`\n■ ${name}  (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  for (const p of parts) console.log('  ' + p);
  console.log(
    `  [필드] 중앙 ${f.medianBeats}박 초과 ${(100 * f.timeoutRate).toFixed(1)}% · 카드 ${f.cards.at(-1)!.winRate.toFixed(3)}~${f.cards[0].winRate.toFixed(3)}` +
      ` · 범위 밖 ${bad.map((c) => `${c.char}:${c.winRate.toFixed(3)}`).join(' ') || '없음'}`,
  );
  console.log(`  [직업 1단계 효과] ${['knight', 'ninja', 'hunter', 'mage', 'singer', 'healer'].map(role).join(' · ')}`);
}
