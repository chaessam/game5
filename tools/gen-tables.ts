// 수치표 자동 생성: npx tsx tools/gen-tables.ts > design/수치표.md
// 엔진 데이터(src/engine/data.ts)가 기준이다. 기획서의 숫자와 다르면 이 표가 맞다.
import { DEFAULT_CONFIG as C, FAMILIES, ROLES, UNITS, UNIT_IDS } from '../src/engine/data';
import { divisors, familiesOf } from '../src/engine/math';
import type { FamilyId, UnitDef } from '../src/engine/types';

const x = (p: number) => `${p / 100}배`;
const tiers = (t: readonly number[]) => t.map((n) => `${n}명`).join(' · ');
const lines: string[] = [];
const out = (s = '') => lines.push(s);

/** 1성·보너스 없음 기준 노래 한 줄 설명(엔진 공식과 같은 계산) */
function songText(u: UnitDef): string {
  const n = u.n;
  const c = u.coef;
  const s3 = (v: number) => `${v} / ${v * 2} / ${v * 3}`;
  const cc = (div?: number, word = '멈춤') => (div ? `, (숫자 ÷ ${div}) = ${Math.floor(n / div)}박 ${word}` : '');
  switch (u.skill) {
    case 'conductor': return `붙은 친구가 노래할 때 함께 노래(합창 ${C.conductorChorusCount}명 몫), 다른 친구 2명 이상과 노래하면 가장 아픈 친구에게 (다른 친구 수 × ${c}) 방패`;
    case 'twinHeal': return `가장 아픈 친구 2명 회복 ${s3(n * c)}`;
    case 'ding': return `앞의 적 ${s3(n * c)}`;
    case 'shell': return `붙은 친구 모두 방패 ${s3(n * c)}`;
    case 'starfish': return `체력이 가장 많은 적 ${s3(n * c)}${cc(u.ccDiv)}`;
    case 'honey': return `가장 아픈 친구 3·2·1숟갈, 한 숟갈 ${s3(n * c)}`;
    case 'rainbowArrows': return `가장 먼 적에게 7발, 한 발 ${s3(n * c)} (합 ${n * c * 7})`;
    case 'slap8': return `체력이 가장 적은 적을 8번, 한 번 ${s3(n * c)} (합 ${n * c * 8})${cc(u.ccDiv, '약하게')}`;
    case 'foxfire': return `여우불 숫자개(${n}개), 한 개 ${s3(c)} (합 ${n * c})`;
    case 'strike': return `적이 가장 많은 세로줄 ${s3(n * c)}`;
    case 'twinBlade': return `체력이 가장 적은 적을 2번, 한 번 ${s3(n * c)}`;
    case 'clockStop': return `적 앞줄 모두${cc(u.ccDiv).replace(', ', ' ')} + 자기 방패 ${s3(n * c)}`;
    case 'baker': return `빵 13개(아군 모두 1개씩, 남은 빵은 가장 아픈 친구부터), 빵 1개 ${s3(n * c)}`;
    case 'ricecake': return `적 앞줄 모두 ${s3(n * c)} + 자기 방패 ${s3(n * (u.coef2 ?? 0))}`;
    case 'halfPlane': return `가장 먼 적부터 4명, ${[0, 1, 2, 3].map((i) => (n * c) / 2 ** i).join(' → ')}`;
    case 'cicada': return `적 모두 ${s3(n * c)}${cc(u.ccDiv, '약하게')}`;
    case 'truck': return `적 앞줄 모두 ${s3(n * c)} + 아군 모두 방패 ${s3(n * (u.coef2 ?? 0))}`;
    case 'riddle': return `적 모두 ${s3(n * c)}${cc(u.ccDiv)}`;
    case 'dice': { const v = [1, 2, 3, 4, 5, 6, 6].map((p) => p * n * c); return `주사위 눈 × 숫자: ${v.join('·')} = ${v.reduce((a, b) => a + b)}`; }
    case 'noon': return `적 모두 ${s3(n * c)} + 아군 모두 회복 ${s3(n * c)} (몸풀기 절반, 회복은 방패로)`;
    case 'bingo': return `적 앞줄·뒷줄 중 많은 줄 ${s3(n * c)} (몸풀기 ${(n * c) / 2})`;
    case 'perfectBlades': { const v = [1, 2, 4, 7, 14].map((b) => Math.floor((b * n * c) / 4)); const r = [1, 2, 4, 7, 14].map((b) => Math.floor((b * n * c * 50) / 400)); return `칼 1·2·4·7·14 × 숫자 × 3 ÷ 4: ${v.join('·')} = ${v.reduce((a, b) => a + b)} (몸풀기 ${r.reduce((a, b) => a + b)})`; }
    case 'fullMoon': return `아군 모두 회복 ${s3(n * c)} + 가장 먼저 쓰러진 친구 되살리기(전투당 1번) (몸풀기 방패 ${(n * c) / 2})`;
    case 'dragon': return `적 모두 ${s3(n * c)} (몸풀기 ${(n * c) / 2}), 0박 약수 금화 1개마다 체력 +${C.coinHp}·공격 +${C.coinAtk} (최대 ${C.coinMax}개)`;
  }
}

const famName = (f: FamilyId) => FAMILIES[f].name;

out('# 숫자체스 수치표 (자동 생성)');
out('');
out('> `npx tsx tools/gen-tables.ts > design/수치표.md`로 만듭니다. 엔진 데이터(`src/engine/data.ts`)가 기준이고, 기획서와 숫자가 다르면 이 표가 맞습니다.');
out('');
out('## 규칙 수치');
out('');
out('| 항목 | 값 |');
out('|---|---|');
out(`| 전투 | 최대 ${C.maxBeat}박, ${C.hotBeatFrom}박부터 뜨거운 박자(기본 공격 ${x(C.hotBasicPct)}) |`);
out(`| 합창 배율 | 2명 ${x(C.chorusPct[2])} · 3명 ${x(C.chorusPct[3])} · 4명 이상 ${x(C.chorusPct[4])}, 노래 배율 최대 ${x(C.songMultCapPct)}, 회복·방패 노래는 합창 보너스의 ${C.supportChorusBonusFactor}% |`);
out(`| 손잡기 | 붙은 두 친구의 최대공약수 × ${C.handshakePerGcd} 방패(최대공약수 2 이상), 한 친구 최대 ${C.handshakeCap} |`);
out(`| 몸풀기 노래 | 지금 숫자 ${C.rehearsalMinNumber} 이상, 0박에 ${C.rehearsalPct}% 힘(멈춤·약하게·되살리기 없음, 회복은 방패로) |`);
out(`| 멈춤·약하게 | 다음 박부터 N박, 끝나면 ${C.ccImmuneBeats}박 면역. 약하게 = 기본 공격 ${C.weakBasicPct}% |`);
out(`| 성(★) | 2성 = 체력·공격·노래 2배, 3성 = 3배 (멈춤 같은 시간은 그대로) |`);
out('');
out('## 수학 가문');
out('');
out('| 가문 | 조건 | 단계 | 효과 |');
out('|---|---|---|---|');
const T = C.famTiers;
out(`| ${FAMILIES.even.icon} 짝꿍 | 2의 배수 | ${tiers(T.even)} | 짝수 박에 기본 공격 추가 ${C.evenExtraPct.slice(1).join('% · ')}% |`);
out(`| ${FAMILIES.tri.icon} 세모 | 3의 배수 | ${tiers(T.tri)} | 3의 배수 박마다 세모 친구 방패를 ${C.triShield.slice(1).join(' · ')}까지 채움 |`);
out(`| ${FAMILIES.five.icon} 다섯손 | 5의 배수 | ${tiers(T.five)} | 5의 배수 박마다 다섯손 친구 공격력 +${C.fiveAtk.slice(1).join(' · +')} (최대 ${C.fiveMaxStacks}번) |`);
out(`| ${FAMILIES.prime.icon} 단단 | 약수가 딱 2개 | ${tiers(T.prime)} | 그 박에 단단 친구만 노래하면 ${C.primeSongPct.slice(1).map(x).join(' · ')}(합창보다 크면), 받는 피해 −${C.primeReducePct.slice(1).join('% · −')}% |`);
out(`| ${FAMILIES.rich.icon} 부자 | 약수 6개 이상 | ${tiers(T.rich)} | 쓰러지면 곱셈 짝 꼬마 둘, 꼬마 힘 ${C.richPower.slice(1).map(([a, b]) => `${a}/${b}`).join(' · ')}, 꼬마 노래 = 숫자 × ${C.minionSongCoef} |`);
out('');
out('## 직업');
out('');
out('| 직업 | 단계 | 효과 |');
out('|---|---|---|');
out(`| 기사 | ${tiers(C.roleTiers)} | 앞줄에서 도발. 받는 피해 −${C.knightSelfReducePct.slice(1).join('% · −')}%, 4명이면 다른 친구도 −${C.knightAllReducePct[2]}% |`);
out(`| 닌자 | ${tiers(C.roleTiers)} | 뒷줄부터 공격. 공격력 +${C.ninjaAtkPct.slice(1).join('% · +')}% |`);
out(`| ${ROLES.hunter.name} | ${tiers(C.roleTiers)} | 가장 먼 적 공격. 공격력 +${C.hunterAtkPct.slice(1).join('% · +')}% |`);
out(`| 마법사 | ${tiers(C.roleTiers)} | 마법사 노래 배율 +${C.mageSongPct.slice(1).map((p) => p / 100).join(' · +')} |`);
out(`| ${ROLES.singer.name} | ${tiers(C.roleTiers)} | 합창하는 박의 모든 노래 배율 +${C.singerChorusPct.slice(1).map((p) => p / 100).join(' · +')} |`);
out(`| ${ROLES.healer.name} | ${tiers(C.roleTiers)} | 회복·방패 노래 배율 +${C.healerSupportPct.slice(1).map((p) => p / 100).join(' · +')} |`);
out('');
out('## 숫자 캐릭터 (1성 기준, 노래는 1성 / 2성 / 3성)');
out('');
out('| 숫자 | 이름 | 직업 | 가문 | 값 | 체력 | 공격 | 노래 | 약수 |');
out('|---|---|---|---|---|---|---|---|---|');
for (const n of UNIT_IDS) {
  const u = UNITS[n];
  const fams = familiesOf(n).map(famName).join('·') || '없음';
  out(`| ${n} | ${u.title} '${u.name}' | ${ROLES[u.role].name} | ${fams} | ${u.cost} | ${u.hp} | ${u.atk} | ${songText(u)} | ${divisors(n).join('·')} |`);
}
console.log(lines.join('\n'));
