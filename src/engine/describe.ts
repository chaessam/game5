// 카드·도감에 쓰는 설명 문구(엔진 공식과 같은 계산으로 만든다).
import { DEFAULT_CONFIG as C } from './data';
import type { UnitDef } from './types';

/** 1성·보너스 없음 기준 노래 한 줄 설명(엔진 공식과 같은 계산) */
export function songText(u: UnitDef): string {
  const n = u.n;
  const c = u.coef;
  const s3 = (v: number) => `${v}\u00a0/\u00a0${v * 2}\u00a0/\u00a0${v * 3}`;
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

