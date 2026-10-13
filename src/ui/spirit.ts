// 숫자 친구 그림(SVG). 가문은 액세서리로 늘 그림에 보인다:
// 짝꿍 = 파란 리본, 세모 = 초록 고깔, 다섯손 = 노란 손바닥 배지, 단단 = 보라 다이아 브로치, 부자 = 금왕관.
import { familiesOf } from '../engine/math';
import { UNITS } from '../engine/data';
import type { FamilyId, RoleId } from '../engine/types';

export const FAM_COLOR: Record<FamilyId, string> = {
  even: '#3FA8FF',
  tri: '#2ED47A',
  five: '#FFD43B',
  prime: '#A97BFF',
  rich: '#FFAE1F',
};

const ROLE_BODY: Record<RoleId, string> = {
  knight: '#9DB4D6',
  ninja: '#6C6A9E',
  hunter: '#7FD08A',
  mage: '#C79BFF',
  singer: '#FF9EC4',
  healer: '#7FE3D2',
};
/** 캐릭터마다 몸 색(직업 색을 바탕으로 몇몇은 개성 색) */
const BODY: Record<number, string> = {
  1: '#E8EEF6', 5: '#FF9C8A', 7: '#B98CFF', 9: '#FFB46B', 10: '#9EC3FF', 13: '#D9A76B', 16: '#D6DCE6',
  17: '#9BE36B', 20: '#C9A27B', 21: '#F4F4F4', 24: '#FFC94A', 25: '#B79C83', 28: '#4C4F6B', 30: '#C7D3FF', 36: '#FFC23F',
};

const INK = '#1d1440';

export function bodyColor(char: number): string {
  return BODY[char] ?? ROLE_BODY[UNITS[char]?.role ?? 'knight'];
}

function accessories(fams: FamilyId[]): string {
  let s = '';
  const has = (f: FamilyId) => fams.includes(f);
  if (has('rich')) s += `<path d="M33 22 L35 6 L43 14 L50 3 L57 14 L65 6 L67 22 Z" fill="${FAM_COLOR.rich}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="16" r="3" fill="#ff5d7a"/>`;
  if (has('tri')) {
    const x = has('rich') ? 22 : 50;
    s += `<path d="M${x - 10} 24 L${x} ${has('rich') ? 6 : 0} L${x + 10} 24 Z" fill="${FAM_COLOR.tri}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="${x}" cy="${has('rich') ? 6 : 0}" r="3" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
  }
  if (has('even')) s += `<g transform="translate(14 44)"><path d="M0 0 L-9 -7 L-9 7 Z M0 0 L9 -7 L9 7 Z" fill="${FAM_COLOR.even}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><circle r="3" fill="${FAM_COLOR.even}" stroke="${INK}" stroke-width="2"/></g>`;
  if (has('five')) s += `<g transform="translate(84 46)"><circle r="9" fill="${FAM_COLOR.five}" stroke="${INK}" stroke-width="2.2"/><path d="M-4 4 V-3 M-1.5 4 V-6 M1 4 V-6 M3.5 4 V-4 M-4 4 Q0 7 4 4 M-4 1 L-7 -2" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
  if (has('prime')) {
    const x = has('five') ? 74 : 80;
    const y = has('five') ? 66 : 30;
    s += `<path d="M${x} ${y - 9} L${x + 7} ${y - 1} L${x} ${y + 9} L${x - 7} ${y - 1} Z" fill="${FAM_COLOR.prime}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
  return s;
}

let gid = 0;

export interface SpiritOpts {
  /** 지금 숫자(돌로 바뀌면 다름). 기본 = 캐릭터 번호 */
  num?: number;
  sing?: boolean;
  hurt?: boolean;
  gold?: boolean; // 3성 금빛
}

/** 숫자 친구 SVG 문자열 */
export function spirit(char: number, size: number, opts: SpiritOpts = {}): string {
  const num = opts.num ?? char;
  const fams = familiesOf(num);
  const id = `sp${gid++}`;
  const fill = opts.gold ? '#FFD86B' : bodyColor(char);
  const body = 'M50 18 C 76 18, 91 40, 91 63 C 91 85, 73 95, 50 95 C 27 95, 9 85, 9 63 C 9 40, 24 18, 50 18 Z';
  const fs = String(num).length === 1 ? 32 : 27;
  let extra = '';
  if (char === 7) extra += `<path d="M22 36 L18 10 L42 24 Z M78 36 L82 10 L58 24 Z" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  if (char === 1) extra += `<path d="M38 70 L50 66 L62 70 L50 74 Z" fill="#ff5d7a" stroke="${INK}" stroke-width="2"/>`;
  const eyes = opts.sing
    ? `<path d="M31 47 Q38 39 45 47 M55 47 Q62 39 69 47" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
    : opts.hurt
      ? `<path d="M33 41 L43 49 M43 41 L33 49 M57 41 L67 49 M67 41 L57 49" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`
      : `<ellipse cx="38" cy="46" rx="7" ry="8" fill="#fff" stroke="${INK}" stroke-width="1.5"/><ellipse cx="62" cy="46" rx="7" ry="8" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
         <circle cx="39.5" cy="47.5" r="4.4" fill="${INK}"/><circle cx="63.5" cy="47.5" r="4.4" fill="${INK}"/>
         <circle cx="41" cy="45.6" r="1.6" fill="#fff"/><circle cx="65" cy="45.6" r="1.6" fill="#fff"/>`;
  const mouth = opts.sing
    ? `<ellipse cx="50" cy="57" rx="5" ry="5.5" fill="#7a1035" stroke="${INK}" stroke-width="2.2"/>`
    : `<path d="M45 56 Q50 61 55 56" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="overflow:visible" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
    ${extra}
    <path d="${body}" fill="${fill}" stroke="${INK}" stroke-width="3.2"/>
    <path d="${body}" fill="url(#${id})"/>
    <ellipse cx="33" cy="33" rx="11" ry="6.5" fill="#fff" opacity=".4" transform="rotate(-28 33 33)"/>
    ${eyes}
    <ellipse cx="26" cy="57" rx="5" ry="3" fill="#ff5d8f" opacity=".45"/><ellipse cx="74" cy="57" rx="5" ry="3" fill="#ff5d8f" opacity=".45"/>
    ${mouth}
    <text x="50" y="87" text-anchor="middle" font-family="Jua, sans-serif" font-size="${fs}" fill="#fff" stroke="${INK}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">${num}</text>
    ${accessories(fams)}
  </svg>`;
}

/** 가문 아이콘(작은 칩용) */
export function famIcon(f: FamilyId, s = 16): string {
  const c = FAM_COLOR[f];
  const st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  const p: Record<FamilyId, string> = {
    even: `<circle cx="8" cy="12" r="5.5" fill="${c}" ${st}/><circle cx="16.5" cy="12" r="5.5" fill="${c}" ${st}/>`,
    tri: `<path d="M12 3 L21.5 20 L2.5 20 Z" fill="${c}" ${st}/>`,
    five: `<circle cx="12" cy="12" r="9" fill="${c}" ${st}/><path d="M8 15 V9 M10.5 15 V7 M13 15 V7 M15.5 15 V9" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    prime: `<path d="M12 2.5 L20 9 L12 21.5 L4 9 Z" fill="${c}" ${st}/>`,
    rich: `<path d="M3 18 L4.5 7 L9 11.5 L12 4.5 L15 11.5 L19.5 7 L21 18 Z" fill="${c}" ${st}/>`,
  };
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${p[f]}</svg>`;
}
