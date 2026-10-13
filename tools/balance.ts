// 밸런스 리포트: npm run balance [-- --quick] [-- --out design/balance-report.md] [-- --override tune.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG, ROLES, FAMILIES, type BalanceConfig } from '../src/engine/data';
import { META_DECKS } from '../src/sim/decks';
import { powerTable, randomField, TARGETS, type FieldReport, type PowerReport } from '../src/sim/arena';
import type { FamilyId, RoleId } from '../src/engine/types';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const quick = flag('quick');
let cfg: BalanceConfig = DEFAULT_CONFIG;
const ov = opt('override');
if (ov) {
  const o = JSON.parse(readFileSync(ov, 'utf8'));
  cfg = { ...DEFAULT_CONFIG, ...o, unitOverrides: { ...DEFAULT_CONFIG.unitOverrides, ...(o.unitOverrides ?? {}) } };
}

const fmt = (x: number, d = 2) => x.toFixed(d);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const mark = (ok: boolean) => (ok ? '✅' : '⚠️');
const inRange = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;

const t0 = Date.now();
const lines: string[] = [];
const out = (s = '') => {
  lines.push(s);
  console.log(s);
};

function powerSection(p: PowerReport) {
  out(`### 대표 덱 파워 지수 — ${p.slots}칸, 실효 예산 ${p.budget}골드`);
  out('');
  out(`덱 파워 퍼짐(로그 표준편차) **${fmt(p.logSd, 3)}** · 전투 중앙값 **${p.medianBeats}박** · 48박 시간 초과 **${pct(p.timeoutRate)}** · 36박 이상 간 전투 **${pct(p.reach36)}**`);
  out('');
  out('| 덱 | 파워 지수(1.0 평균, 낮을수록 강함) | 1배 피해일 때 승률 | 목표 0.85~1.15 |');
  out('|---|---|---|---|');
  for (const r of p.rows) out(`| ${r.deck} | ${fmt(r.power)} | ${pct(r.winRate)} | ${mark(inRange(r.power, TARGETS.power))} |`);
  out('');
}

function fieldSection(f: FieldReport) {
  out(`### 무작위 덱 필드 — ${f.comps}덱, ${f.battles}판`);
  out('');
  out(`전투 중앙값 **${f.medianBeats}박** ${mark(inRange(f.medianBeats, TARGETS.medianBeats))} · 시간 초과 **${pct(f.timeoutRate)}** ${mark(f.timeoutRate <= TARGETS.timeoutMax)} · 36박 이상 **${pct(f.reach36)}**`);
  out('');
  out('| 숫자 | 이름 | 값 | 직업 | 출전 승률 | 목표 0.44~0.58 | 박자 노래 1번 이상 | 끝까지 생존 |');
  out('|---|---|---|---|---|---|---|---|');
  for (const c of f.cards) {
    out(`| ${c.char} | ${c.name} | ${c.cost} | ${ROLES[c.role].name} | ${fmt(c.winRate, 3)} | ${mark(inRange(c.winRate, TARGETS.cardWinRate))} | ${pct(c.sangRate)} | ${pct(c.aliveRate)} |`);
  }
  out('');
  out('**가문·직업 단계별 평균 승률** (숫자 = 단계, 0 = 꺼짐)');
  out('');
  out('| 시너지 | 0단계 | 1단계 | 2단계 | 3단계 |');
  out('|---|---|---|---|---|');
  const groups = new Map<string, Map<number, { winRate: number; n: number }>>();
  for (const t of f.tiers) {
    const m = t.key.match(/^(가문|직업) (\w+?)(\d)$/);
    if (!m) continue;
    const id = m[2];
    const label = m[1] === '가문' ? `가문 ${FAMILIES[id as FamilyId].name}` : `직업 ${ROLES[id as RoleId].name}`;
    if (!groups.has(label)) groups.set(label, new Map());
    groups.get(label)!.set(Number(m[3]), { winRate: t.winRate, n: t.n });
  }
  for (const [label, m] of groups) {
    const cell = (k: number) => (m.has(k) ? `${fmt(m.get(k)!.winRate, 3)} (n=${m.get(k)!.n})` : '—');
    out(`| ${label} | ${cell(0)} | ${cell(1)} | ${cell(2)} | ${cell(3)} |`);
  }
  out('');
}

out('# 숫자체스 밸런스 리포트');
out('');
out('`npm run balance`로 다시 만들 수 있습니다. 엔진: `src/engine/battle.ts`(동시 처리, 정수 계산), 측정: `src/sim/arena.ts`.');
out('');
const p8 = powerTable(META_DECKS, cfg, 8, 50, quick ? 2 : 4, (d, n) => process.stderr.write(`\r파워(8칸) ${d}/${n}`));
process.stderr.write('\n');
powerSection(p8);
if (!quick) {
  const p6 = powerTable(META_DECKS, cfg, 6, 30, 4, (d, n) => process.stderr.write(`\r파워(6칸) ${d}/${n}`));
  process.stderr.write('\n');
  powerSection(p6);
}
const field = randomField(cfg, { comps: quick ? 150 : 500, opponents: quick ? 20 : 40 }, (d, n) => {
  if (d % 25 === 0 || d === n) process.stderr.write(`\r필드 ${d}/${n}`);
});
process.stderr.write('\n');
fieldSection(field);
out(`_측정 시간 ${((Date.now() - t0) / 1000).toFixed(1)}초_`);

const file = opt('out');
if (file) writeFileSync(file, lines.join('\n') + '\n');
