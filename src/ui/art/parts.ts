// 캐릭터 그림 공통 부품(SVG 문자열). 좌표계는 0 0 120 122, 받침 중심 (60, 104).
import type { FamilyId, RoleId } from '../../engine/types';

export const INK = '#1d1440';
export const S = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export const FAM_COLOR: Record<FamilyId, string> = { even: '#3FA8FF', tri: '#2ED47A', five: '#FFD43B', prime: '#A97BFF', rich: '#FFAE1F' };
export const ROLE_COLOR: Record<RoleId, string> = {
  knight: '#C5D3E8', ninja: '#F0506E', hunter: '#E0A15A', mage: '#7FE7FF', singer: '#FF6FA8', healer: '#6EF0C8',
};

let uidCounter = 0;
export const uid = (p: string) => `${p}${uidCounter++}`;

export function famShape(f: FamilyId): string {
  const c = FAM_COLOR[f];
  const st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  switch (f) {
    case 'even': return `<circle cx="7.5" cy="12" r="5.5" fill="${c}" ${st}/><circle cx="16.5" cy="12" r="5.5" fill="${c}" ${st}/>`;
    case 'tri': return `<path d="M12 3 L21.5 20 L2.5 20 Z" fill="${c}" ${st}/>`;
    case 'five': return `<circle cx="12" cy="12" r="9" fill="${c}" ${st}/><path d="M8 15 V9 M10.5 15 V7 M13 15 V7 M15.5 15 V9" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 'prime': return `<path d="M12 2.5 L20 9 L12 21.5 L4 9 Z" fill="${c}" ${st}/>`;
    case 'rich': return `<path d="M3 18 L4.5 7 L9 11.5 L12 4.5 L15 11.5 L19.5 7 L21 18 Z" fill="${c}" ${st}/>`;
  }
}

export function roleShape(r: RoleId): string {
  const c = ROLE_COLOR[r];
  const st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  switch (r) {
    case 'knight': return `<path d="M5 3.5 H19 V11 C19 16.5 15 20 12 21.5 C9 20 5 16.5 5 11 Z" fill="${c}" ${st}/><path d="M12 7 V17 M8 11 H16" ${st}/>`;
    case 'ninja': return `<path d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z" fill="${c}" ${st}/><circle cx="12" cy="12" r="2.2" fill="#fff" ${st}/>`;
    case 'hunter': return `<path d="M7 2.5 C 19 6, 19 18, 7 21.5" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M7 2.5 C 19 6, 19 18, 7 21.5" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M7 2.5 V21.5 M3 12 H20 M16.5 8.5 L20 12 L16.5 15.5" fill="none" ${st}/>`;
    case 'mage': return `<path d="M3 21 H21 L16 18 L13.5 2.5 L8 18 Z" fill="#4B3FA8" ${st}/><path d="M12 9.5 l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="${c}"/>`;
    case 'singer': return `<path d="M9 19 V6 L19 3.5 V16" fill="none" ${st}/><ellipse cx="6.5" cy="19" rx="3.6" ry="2.8" fill="${c}" ${st}/><ellipse cx="16.5" cy="16.5" rx="3.6" ry="2.8" fill="${c}" ${st}/>`;
    case 'healer': return `<path d="M12 21 C 4 15, 2 10, 5 6.5 C 8 3.5, 11 5, 12 7 C 13 5, 16 3.5, 19 6.5 C 22 10, 20 15, 12 21 Z" fill="${c}" ${st}/><path d="M12 10 V16 M9 13 H15" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
  }
}

/** 눈. mode: norm(동그란 눈) · cool(반쯤 감은 눈) · happy(웃는 눈) */
export function eyes(x1: number, x2: number, y: number, mode: 'norm' | 'cool' | 'happy' = 'norm', s = 1): string {
  if (mode === 'happy')
    return `<path d="M${x1 - 5 * s} ${y + 1} Q${x1} ${y - 6 * s} ${x1 + 5 * s} ${y + 1} M${x2 - 5 * s} ${y + 1} Q${x2} ${y - 6 * s} ${x2 + 5 * s} ${y + 1}" fill="none" ${S(3)}/>`;
  if (mode === 'cool') {
    const half = (x: number) =>
      `<path d="M${x - 6 * s} ${y} A ${6 * s} ${6.6 * s} 0 0 0 ${x + 6 * s} ${y} Z" fill="#fff" ${S(1.6)}/>` +
      `<circle cx="${x + 1 * s}" cy="${y + 2.6 * s}" r="${3.3 * s}" fill="${INK}"/><circle cx="${x + 2.2 * s}" cy="${y + 1.7 * s}" r="${1.2 * s}" fill="#fff"/>` +
      `<path d="M${x - 7.2 * s} ${y - 0.6} L${x + 7.2 * s} ${y + 0.6}" ${S(3.4)}/>`;
    return half(x1) + half(x2);
  }
  const one = (x: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="${5.6 * s}" ry="${6.6 * s}" fill="#fff" ${S(1.6)}/>` +
    `<circle cx="${x + 0.8 * s}" cy="${y + 1.2 * s}" r="${3.9 * s}" fill="${INK}"/>` +
    `<circle cx="${x + 2.1 * s}" cy="${y - 0.6 * s}" r="${1.5 * s}" fill="#fff"/>`;
  return one(x1) + one(x2);
}
export const blush = (x1: number, x2: number, y: number) =>
  `<ellipse cx="${x1}" cy="${y}" rx="4.6" ry="2.6" fill="#ff6b9a" opacity=".5"/><ellipse cx="${x2}" cy="${y}" rx="4.6" ry="2.6" fill="#ff6b9a" opacity=".5"/>`;
export const smile = (x: number, y: number, w = 5) => `<path d="M${x - w} ${y} Q${x} ${y + w} ${x + w} ${y}" fill="none" ${S(2.6)}/>`;
export const sparkle = (x: number, y: number, k = 1) =>
  `<path transform="translate(${x} ${y}) scale(${k})" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#fff" stroke="#8A5CFF" stroke-width="1.3" stroke-linejoin="round"/>`;
export function starPath(cx: number, cy: number, R: number, r: number, rot = -90, points = 5): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}
export const goldStar = (x: number, y: number, R = 6) => `<path d="${starPath(x, y, R, R * 0.45)}" fill="#FFD43B" ${S(1.8)}/>`;
export const crown = (x: number, y: number, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-12 6 L-10 -7 L-4.5 -1 L0 -10 L4.5 -1 L10 -7 L12 6 Z" fill="${FAM_COLOR.rich}" ${S(2.4)}/><circle cx="0" cy="1.5" r="2.4" fill="#ff5d7a" ${S(1.2)}/></g>`;
export const note = (x: number, y: number, c = '#FF6FA8', k = 1) =>
  `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0 V-12 L8 -14 V-3" fill="none" ${S(2.2)}/><ellipse cx="-2.6" cy="0.5" rx="3.6" ry="2.8" fill="${c}" ${S(1.8)}/><ellipse cx="5.4" cy="-2.5" rx="3.6" ry="2.8" fill="${c}" ${S(1.8)}/></g>`;
/** 막대(지팡이·칼자루 등): 테두리 + 속색 */
export const stick = (x1: number, y1: number, x2: number, y2: number, c: string, w = 3) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="${w + 3}" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
export const paw = (x: number, y: number, c: string, rx = 6, ry = 5.4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${S(2.4)}/>`;
export const feet = (x1: number, x2: number, c: string, rx = 8, ry = 4.6, y = 103) =>
  `<ellipse cx="${x1}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${S(2.4)}/><ellipse cx="${x2}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${S(2.4)}/>`;
export const shine = (x: number, y: number, rx = 7, ry = 4, rot = -28) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45" transform="rotate(${rot} ${x} ${y})"/>`;

// 직업 장비
export const wizardHat = (x: number, y: number, k = 1, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><ellipse cx="0" cy="0" rx="22" ry="5.5" fill="#4B3FA8" ${S(2.6)}/>` +
  `<path d="M-15 -1 C -9 -13, -4 -28, 14 -38 C 8 -25, 11 -12, 16 -1 C 6 2, -6 2, -15 -1 Z" fill="#4B3FA8" ${S(2.6)}/>` +
  `<path d="M-13 -5 C -2 -2, 6 -2, 15 -6" stroke="#FFD43B" stroke-width="3" fill="none"/>${goldStar(1, -17, 4.4)}</g>`;
export const hunterCap = (x: number, y: number, k = 1, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><path d="M-16 4 C -13 -9, 12 -12, 18 0 L 26 3 C 10 -3, -4 -3, -16 4 Z" fill="#B8763E" ${S(2.6)}/>` +
  `<path d="M12 -5 C 24 -17, 38 -19, 44 -22 C 38 -13, 28 -6, 15 -2 Z" fill="#FF5D6C" ${S(2.2)}/></g>`;
export const headphones = (cx: number, top: number, half: number, cupY: number) =>
  `<path d="M${cx - half} ${cupY} C ${cx - half} ${top}, ${cx + half} ${top}, ${cx + half} ${cupY}" fill="none" stroke="${INK}" stroke-width="8.5" stroke-linecap="round"/>` +
  `<path d="M${cx - half} ${cupY} C ${cx - half} ${top}, ${cx + half} ${top}, ${cx + half} ${cupY}" fill="none" stroke="#FF6FA8" stroke-width="4.5" stroke-linecap="round"/>` +
  `<rect x="${cx - half - 6}" y="${cupY - 8}" width="12" height="17" rx="5" fill="#FF6FA8" ${S(2.6)}/><rect x="${cx + half - 6}" y="${cupY - 8}" width="12" height="17" rx="5" fill="#FF6FA8" ${S(2.6)}/>`;
export const mic = (hx: number, hy: number, tx: number, ty: number) =>
  `${stick(hx, hy, tx, ty, '#59607A', 3.4)}<circle cx="${tx + (tx - hx) * 0.18}" cy="${ty + (ty - hy) * 0.18}" r="7" fill="#DCE3EE" ${S(2.4)}/>`;
export const ninjaBand = (y: number, x1: number, x2: number, tailX: number) =>
  `<path d="M${tailX} ${y + 2} C ${tailX + 10} ${y - 4}, ${tailX + 17} ${y + 2}, ${tailX + 25} ${y - 4} C ${tailX + 22} ${y + 6}, ${tailX + 12} ${y + 9}, ${tailX} ${y + 8} Z" fill="#F0506E" ${S(2.2)}/>` +
  `<path d="M${tailX} ${y + 6} C ${tailX + 9} ${y + 8}, ${tailX + 13} ${y + 16}, ${tailX + 21} ${y + 16} C ${tailX + 15} ${y + 22}, ${tailX + 6} ${y + 18}, ${tailX} ${y + 12} Z" fill="#F0506E" ${S(2.2)}/>` +
  `<path d="M${x1} ${y} C ${x1 + 18} ${y - 7}, ${x2 - 18} ${y - 7}, ${x2} ${y} L${x2} ${y + 9} C ${x2 - 18} ${y + 2}, ${x1 + 18} ${y + 2}, ${x1} ${y + 9} Z" fill="#3A3F6B" ${S(2.4)}/>` +
  `<rect x="${(x1 + x2) / 2 - 7}" y="${y - 5}" width="14" height="7" rx="2" fill="#C5D3E8" ${S(1.6)}/>`;
export const shuriken = (x: number, y: number, rot = 20, k = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><path d="M0 -10 L2.8 -2.8 L10 0 L2.8 2.8 L0 10 L-2.8 2.8 L-10 0 L-2.8 -2.8 Z" fill="#DCE3EE" ${S(2)}/><circle r="2.2" fill="${INK}"/></g>`;
export const nurseCap = (x: number, y: number, w = 16) =>
  `<path d="M${x - w} ${y + 6} L${x - w + 2} ${y - 6} H${x + w - 2} L${x + w} ${y + 6} C ${x + 6} ${y + 3}, ${x - 6} ${y + 3}, ${x - w} ${y + 6} Z" fill="#fff" ${S(2.4)}/>` +
  `<path d="M${x} ${y + 3} C ${x - 5} ${y - 1}, ${x - 6} ${y - 5}, ${x - 3} ${y - 6} C ${x - 1} ${y - 6.5}, ${x} ${y - 5}, ${x} ${y - 4} C ${x} ${y - 5}, ${x + 1} ${y - 6.5}, ${x + 3} ${y - 6} C ${x + 6} ${y - 5}, ${x + 5} ${y - 1}, ${x} ${y + 3} Z" fill="#FF6F91" stroke="${INK}" stroke-width="1.3"/>`;
export const heart = (x: number, y: number, k = 1, c = '#FF6F91') =>
  `<path transform="translate(${x} ${y}) scale(${k})" d="M0 9 C -9 3, -11 -3, -8 -7 C -5 -10, -1 -9, 0 -6 C 1 -9, 5 -10, 8 -7 C 11 -3, 9 3, 0 9 Z" fill="${c}" ${S(2)}/>`;
export const knightShield = (x: number, y: number, k = 1, fill = '#B9C7DC', emblem = '') =>
  `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-15 -22 H15 V-4 C15 10, 5 18, 0 22 C-5 18, -15 10, -15 -4 Z" fill="${fill}" ${S(3)}/>` +
  `<path d="M-10 -17 H10 V-4 C10 7, 3 13, 0 16 C-3 13, -10 7, -10 -4 Z" fill="none" stroke="#E2B53E" stroke-width="2.6"/>${emblem}</g>`;

/** 받침: 직업 무늬. star 2 = 은빛 테, 3 = 금빛 테 + 빛 */
export function pedestal(role: RoleId | null, star = 1): string {
  const c = role ? ROLE_COLOR[role] : '#9aa3b5';
  const ns = `vector-effect="non-scaling-stroke"`;
  let pat = '';
  switch (role) {
    case 'knight': pat = `<path d="M-16 -18 H16 V0 C16 11 7 17 0 20 C-7 17 -16 11 -16 0 Z" fill="${c}" opacity=".55" stroke="${c}" stroke-width="2" ${ns}/>`; break;
    case 'ninja': pat = `<path d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6 Z" fill="${c}" opacity=".6"/>`; break;
    case 'hunter': pat = `<circle r="32" fill="none" stroke="${c}" stroke-width="2.4" ${ns}/><circle r="20" fill="none" stroke="${c}" stroke-width="2.4" ${ns}/><circle r="8" fill="${c}"/>`; break;
    case 'mage': pat = `<circle r="34" fill="none" stroke="${c}" stroke-width="2" ${ns}/><circle r="27" fill="none" stroke="${c}" stroke-width="1.4" ${ns}/><path d="${starPath(0, 0, 27, 10.3)}" fill="none" stroke="${c}" stroke-width="1.6" ${ns}/>`; break;
    case 'singer': pat = `<circle r="10" fill="${c}" opacity=".7"/><circle r="20" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 5" ${ns}/><circle r="31" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 6" ${ns}/>`; break;
    case 'healer': pat = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="0" cy="-20" rx="6" ry="11" fill="${c}" opacity=".6" transform="rotate(${a})"/>`).join('') + `<circle r="7" fill="#fff" opacity=".8"/>`; break;
    default: break;
  }
  const rim = star === 3 ? '#FFD43B' : star === 2 ? '#E8EEF6' : c;
  const glow = star === 3 ? `<ellipse cx="60" cy="102" rx="50" ry="15" fill="#FFD43B" opacity=".28"/>` : '';
  return `${glow}<ellipse cx="60" cy="104" rx="43" ry="10.5" fill="${star === 3 ? '#4a3a12' : '#2B2163'}" stroke="${INK}" stroke-width="2.5"/>
    <g transform="translate(60 104) scale(1 0.26)">${pat}</g>
    <ellipse cx="60" cy="104" rx="43" ry="10.5" fill="none" stroke="${rim}" stroke-width="${star > 1 ? 3 : 1.6}" opacity=".95"/>`;
}
