// 숫자 친구 25명 그림. 3겹 규칙:
// ① 몸 = 그 캐릭터(숫자가 몸에 숨어 있음) ② 옷·무기·받침 = 직업 ③ 보석·몸빛 = 가문(지금 숫자에서 계산)
// 숫자 돌로 숫자가 바뀌면 ③만 바뀌고 ①②는 그대로다.
import {
  INK, S, blush, crown, eyes, famShape, feet, goldStar, headphones, heart, hunterCap, knightShield, mic, ninjaBand, note,
  nurseCap, paw, pedestal, roleShape, shine, shuriken, smile, sparkle, starPath, stick, uid, wizardHat,
} from './parts';
import { familiesOf } from '../../engine/math';
import { UNITS } from '../../engine/data';
import type { FamilyId, RoleId, Star } from '../../engine/types';

export interface CharArt {
  /** 몸 대표색(꼬마·효과 색) */
  color: string;
  /** 몸에 숨은 숫자 설명 */
  hide: string;
  /** 다이아(약수 2개)일 때 반짝이 자리 */
  sparkles: [number, number][];
  /** 부자일 때 왕관 자리 [x, y, 기울기] */
  crown: [number, number, number];
  draw: () => string;
}

const bow = (x: number, top: number, bottom: number, handY: number, fur: string) =>
  `<path d="M${x} ${top} C ${x - 16} ${top + 14}, ${x - 16} ${bottom - 14}, ${x} ${bottom}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>` +
  `<path d="M${x} ${top} C ${x - 16} ${top + 14}, ${x - 16} ${bottom - 14}, ${x} ${bottom}" fill="none" stroke="#B8763E" stroke-width="3.6" stroke-linecap="round"/>` +
  `<path d="M${x} ${top} L${x} ${bottom}" stroke="${INK}" stroke-width="1.3"/>` +
  `<path d="M${x + 22} ${handY} L${x - 18} ${handY}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M${x - 13} ${handY - 5} L${x - 19} ${handY} L${x - 13} ${handY + 5}" fill="none" ${S(2.4)}/>` +
  `<path d="M${x + 22} ${handY} L${x + 28} ${handY - 4} M${x + 22} ${handY} L${x + 28} ${handY + 4}" stroke="#FF5D6C" stroke-width="2.6" stroke-linecap="round"/>` +
  paw(x + 18, handY + 1, fur);

export const ART: Record<number, CharArt> = {
  // 1 하나쌤 · 지휘자 펭귄 — 지휘봉 하나
  1: {
    color: '#2E3350', hide: '지휘봉 하나 — 1은 모든 수의 약수라 누구와도 함께 노래해요',
    sparkles: [[44, 84], [76, 84], [60, 24]], crown: [60, 18, 0],
    draw() {
      const blk = '#2E3350';
      return `${note(102, 34)}${note(92, 16, '#FF6FA8', 0.75)}
      ${feet(50, 70, '#FFB13B', 8, 4.4)}
      <ellipse cx="60" cy="74" rx="27" ry="30" fill="${blk}" ${S(3)}/>
      <ellipse cx="60" cy="80" rx="18" ry="22" fill="#fff"/>
      <path d="M86 66 C 96 74, 98 86, 92 94 C 88 87, 84 80, 82 76 Z" fill="${blk}" ${S(2.6)}/>
      <circle cx="60" cy="40" r="21" fill="${blk}" ${S(3)}/>
      <path d="M44 43 C 44 31, 55 29, 60 35 C 65 29, 76 31, 76 43 C 76 54, 67 58, 60 58 C 53 58, 44 54, 44 43 Z" fill="#fff"/>
      ${shine(48, 26, 6, 3.4)}
      ${eyes(53, 67, 43, 'norm', 0.85)}
      <path d="M55 49 L65 49 L60 55 Z" fill="#FFB13B" ${S(2)}/>
      ${blush(48, 72, 51)}
      <path d="M49 59 L49 67 L60 63 Z M71 59 L71 67 L60 63 Z" fill="#FF4D6D" ${S(2)}/><circle cx="60" cy="63" r="2.6" fill="#FF4D6D" ${S(1.6)}/>
      ${stick(26, 50, 10, 24, '#fff', 2.4)}<circle cx="10" cy="24" r="2.6" fill="#FFD43B" ${S(1.4)}/>
      <path d="M36 66 C 28 62, 22 54, 24 46 C 30 48, 36 56, 40 62 Z" fill="${blk}" ${S(2.6)}/>`;
    },
  },

  // 2 토토와 끼끼 · 쌍둥이 토끼 — 토끼 2마리
  2: {
    color: '#FFE6F0', hide: '토끼 2마리 — 짝수이면서 다이아인 수는 2 하나뿐!',
    sparkles: [[24, 90], [96, 90], [60, 46]], crown: [60, 30, 0],
    draw() {
      const bunny = (cx: number, fur: string, acc: string) => `
        <ellipse cx="${cx - 7}" cy="30" rx="5.5" ry="15" fill="${fur}" ${S(2.6)} transform="rotate(-10 ${cx - 7} 30)"/>
        <ellipse cx="${cx - 7}" cy="31" rx="2.6" ry="10" fill="#FFB3C7" transform="rotate(-10 ${cx - 7} 31)"/>
        <ellipse cx="${cx + 7}" cy="30" rx="5.5" ry="15" fill="${fur}" ${S(2.6)} transform="rotate(10 ${cx + 7} 30)"/>
        <ellipse cx="${cx + 7}" cy="31" rx="2.6" ry="10" fill="#FFB3C7" transform="rotate(10 ${cx + 7} 31)"/>
        ${feet(cx - 7, cx + 7, fur, 5.5, 3.6)}
        <ellipse cx="${cx}" cy="88" rx="13" ry="13" fill="${fur}" ${S(2.8)}/>
        <circle cx="${cx}" cy="58" r="16" fill="${fur}" ${S(2.8)}/>
        ${eyes(cx - 6, cx + 6, 57, 'norm', 0.72)}
        <ellipse cx="${cx}" cy="63.5" rx="2" ry="1.5" fill="#FF6F91"/>
        <path d="M${cx - 3} 66 Q${cx} 69 ${cx + 3} 66" fill="none" ${S(1.8)}/>
        <ellipse cx="${cx - 10}" cy="63" rx="3.4" ry="2" fill="#ff6b9a" opacity=".5"/><ellipse cx="${cx + 10}" cy="63" rx="3.4" ry="2" fill="#ff6b9a" opacity=".5"/>
        ${acc}`;
      return `${bunny(38, '#FFF7FA', `<path d="M27 72 C 33 76, 43 76, 49 72 L49 77 C 43 80, 33 80, 27 77 Z" fill="#6EF0C8" ${S(2)}/>`)}
      ${bunny(82, '#FFE6F0', `<path d="M92 44 L99 39 L99 49 Z M92 44 L85 39 L85 49 Z" fill="#FF6F91" ${S(1.8)}/><circle cx="92" cy="44" r="2.4" fill="#FF6F91" ${S(1.4)}/>`)}
      ${heart(60, 84, 1.25)}<path d="M60 80 V88 M56 84 H64" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      ${paw(49, 86, '#FFF7FA', 4.6, 4)}${paw(71, 86, '#FFE6F0', 4.6, 4)}`;
    },
  },

  // 3 띵띵이 · 트라이앵글 다람쥐 — 세 변
  3: {
    color: '#F2A15C', hide: '트라이앵글 = 변 3개',
    sparkles: [[40, 92], [98, 60], [66, 38]], crown: [54, 28, 0],
    draw() {
      const fur = '#F2A15C', lt = '#FFE3C2';
      return `<path d="M68 98 C 104 98, 116 62, 100 36 C 92 24, 76 26, 80 40 C 92 56, 88 78, 68 82 Z" fill="#E0884A" ${S(3)}/>
      <path d="M76 90 C 98 86, 104 62, 94 44" fill="none" stroke="#FFC48F" stroke-width="4" stroke-linecap="round"/>
      ${feet(46, 62, fur, 7, 4.4)}
      <ellipse cx="54" cy="86" rx="17" ry="16" fill="${fur}" ${S(3)}/>
      <ellipse cx="54" cy="89" rx="9" ry="10" fill="${lt}"/>
      <path d="M37 42 L35 22 L49 33 Z" fill="${fur}" ${S(2.6)}/><path d="M71 42 L73 22 L59 33 Z" fill="${fur}" ${S(2.6)}/>
      <circle cx="54" cy="54" r="21" fill="${fur}" ${S(3)}/>
      <ellipse cx="54" cy="62" rx="11" ry="8" fill="${lt}"/>
      ${headphones(54, 20, 20, 52)}
      ${eyes(46, 62, 53, 'happy')}
      <ellipse cx="54" cy="59" rx="2.4" ry="1.8" fill="${INK}"/>
      <rect x="51.5" y="62" width="5" height="4.5" rx="1" fill="#fff" ${S(1.4)}/>
      ${blush(41, 67, 60)}
      <path d="M30 62 L23 65" stroke="${INK}" stroke-width="1.6"/>
      <path d="M22 66 L10 88 L34 88 Z" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linejoin="round"/>
      <path d="M22 66 L10 88 L34 88 Z" fill="none" stroke="#DCE3EE" stroke-width="3" stroke-linejoin="round"/>
      ${paw(31, 62, fur, 5, 4.6)}
      ${stick(44, 82, 27, 79, '#DCE3EE', 2)}
      ${paw(45, 82, fur, 5, 4.6)}
      ${note(14, 34)}${note(28, 18, '#FF6FA8', 0.7)}`;
    },
  },

  // 4 거부기 · 네모 등껍질 거북 기사 — 배 껍질 2×2
  4: {
    color: '#9BE07F', hide: '배 껍질 네모 4칸(2×2)',
    sparkles: [[46, 70], [74, 86], [52, 24]], crown: [60, 12, 0],
    draw() {
      const skin = '#9BE07F';
      return `<rect x="25" y="44" width="70" height="58" rx="18" fill="#4F8F4A" ${S(3)}/>
      <path d="M30 56 L25 62 M90 56 L95 62 M30 88 L25 82 M90 88 L95 82" stroke="${INK}" stroke-width="2"/>
      ${feet(46, 74, skin, 9.5, 5)}
      <rect x="35" y="50" width="50" height="50" rx="15" fill="${skin}" ${S(3)}/>
      <rect x="41" y="57" width="38" height="38" rx="8" fill="#F6E7A6" ${S(2.4)}/>
      <path d="M60 57 V95 M41 76 H79" stroke="${INK}" stroke-width="2.4"/>
      <path d="M91 62 L99 28 L103.5 29 L96 63 Z" fill="#E8EEF6" ${S(2.2)}/>
      <path d="M85 62 L103 66" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M85 62 L103 66" stroke="#E2B53E" stroke-width="3.6" stroke-linecap="round"/>
      ${paw(91, 68, skin, 7, 6)}
      <circle cx="60" cy="36" r="19" fill="${skin}" ${S(3)}/>
      <path d="M40 34 C40 12, 80 12, 80 34 Z" fill="#B9C7DC" ${S(3)}/>
      <rect x="37" y="31" width="46" height="7" rx="3.5" fill="#8FA2C2" ${S(2.4)}/>
      <path d="M60 16 V31" stroke="${INK}" stroke-width="2"/><circle cx="48" cy="25" r="1.6" fill="${INK}"/><circle cx="72" cy="25" r="1.6" fill="${INK}"/>
      <path d="M60 17 C 57 5, 70 0, 78 4 C 71 7, 66 11, 62 18 Z" fill="#FF5D6C" ${S(2.4)}/>
      ${eyes(52, 68, 45)}${blush(45, 75, 51)}${smile(60, 51, 4)}
      ${knightShield(26, 78, 1, '#B9C7DC', `<rect x="-6" y="-12" width="12" height="12" rx="2" fill="#4F8F4A" ${S(1.8)}/><path d="M0 -12 V0 M-6 -6 H6" stroke="${INK}" stroke-width="1.6"/>`)}`;
    },
  },

  // 5 오롱이 · 불가사리 마법사 — 팔 5개
  5: {
    color: '#FF8A70', hide: '팔 5개',
    sparkles: [[38, 76], [84, 74], [72, 40]], crown: [60, 16, 0],
    draw() {
      const c = '#FF8A70';
      const star = starPath(60, 64, 46, 25);
      let dots = '';
      for (let i = 0; i < 5; i++) {
        const a = ((-90 + i * 72) * Math.PI) / 180;
        for (const k of [30, 38]) dots += `<circle cx="${(60 + k * Math.cos(a)).toFixed(1)}" cy="${(64 + k * Math.sin(a)).toFixed(1)}" r="2.1" fill="#FFD1C2"/>`;
      }
      return `<path d="${star}" fill="${INK}" stroke="${INK}" stroke-width="16" stroke-linejoin="round"/>
      <path d="${star}" fill="${c}" stroke="${c}" stroke-width="10" stroke-linejoin="round"/>
      ${dots}
      ${eyes(51, 69, 61)}${blush(45, 75, 69)}${smile(60, 69, 4.5)}
      ${wizardHat(60, 23, 0.68, 6)}
      ${stick(104, 50, 114, 30, '#B8763E', 2.8)}${goldStar(115, 27, 7.5)}`;
    },
  },

  // 6 붕붕이 · 꿀벌 간호사 — 꿀단지 육각형, 다리 6개
  6: {
    color: '#FFD34D', hide: '꿀단지 육각형 · 다리 6개',
    sparkles: [[44, 64], [78, 62], [60, 92]], crown: [60, 26, 0],
    draw() {
      const y = '#FFD34D';
      const id = uid('bee');
      const hex = (cx: number, cy: number, r: number) =>
        [0, 60, 120, 180, 240, 300].map((a, i) => `${i ? 'L' : 'M'}${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`).join(' ') + ' Z';
      return `<ellipse cx="38" cy="44" rx="14" ry="9" fill="#E8F7FF" opacity=".9" transform="rotate(-35 38 44)" ${S(2.4)}/>
      <ellipse cx="82" cy="44" rx="14" ry="9" fill="#E8F7FF" opacity=".9" transform="rotate(35 82 44)" ${S(2.4)}/>
      <path d="M50 34 C 46 26, 42 22, 40 16 M70 34 C 74 26, 78 22, 80 16" fill="none" ${S(2.4)}/>
      <circle cx="40" cy="15" r="3.6" fill="${INK}"/><circle cx="80" cy="15" r="3.6" fill="${INK}"/>
      <ellipse cx="51" cy="103" rx="6.4" ry="4" fill="#2B2350" ${S(2)}/><ellipse cx="69" cy="103" rx="6.4" ry="4" fill="#2B2350" ${S(2)}/>
      <ellipse cx="29" cy="70" rx="5" ry="3.6" fill="#2B2350" transform="rotate(-30 29 70)"/><ellipse cx="91" cy="70" rx="5" ry="3.6" fill="#2B2350" transform="rotate(30 91 70)"/>
      <defs><clipPath id="${id}"><ellipse cx="60" cy="68" rx="29" ry="31"/></clipPath></defs>
      <ellipse cx="60" cy="68" rx="29" ry="31" fill="${y}"/>
      <g clip-path="url(#${id})"><rect x="20" y="76" width="80" height="7" fill="#2B2350"/><rect x="20" y="90" width="80" height="7" fill="#2B2350"/></g>
      <ellipse cx="60" cy="68" rx="29" ry="31" fill="none" ${S(3)}/>
      ${shine(46, 50, 7, 4, -30)}
      ${nurseCap(60, 35, 16)}
      ${eyes(50, 70, 57)}${blush(43, 77, 64)}${smile(60, 65, 4)}
      <path d="${hex(22, 86, 13)}" fill="#FFB321" ${S(2.6)}/>
      <path d="M13 79 Q 16 84 18 79 Q 20 86 23 79 Q 26 83 30 79" fill="#FFDD7A"/>
      <path d="M18 86 H26 M16 91 H28" stroke="#C97A00" stroke-width="1.8" stroke-linecap="round"/>
      ${paw(32, 82, y, 5.4, 4.8)}
      ${stick(90, 78, 104, 60, '#C98B4E', 2.6)}
      <ellipse cx="105" cy="57" rx="6" ry="7.5" fill="#FFB321" transform="rotate(38 105 57)" ${S(2.2)}/>
      ${paw(88, 80, y, 5.4, 4.8)}`;
    },
  },

  // 7 칠색이 · 무지개 고양이 헌터 — 꼬리 무지개 7색
  7: {
    color: '#F7F2FF', hide: '꼬리 무지개 7색',
    sparkles: [[46, 80], [70, 93], [33, 37]], crown: [58, 14, 0],
    draw() {
      const fur = '#F7F2FF';
      const cols = ['#FF4D5E', '#FF9A3C', '#FFD93D', '#3DDC84', '#3FA8FF', '#5B5BF0', '#B26BFF'];
      const cx = 104, cy = 100;
      let tail = `<path d="M${cx - 45} ${cy} A45 45 0 0 1 ${cx} ${cy - 45}" fill="none" stroke="${INK}" stroke-width="3"/>`;
      cols.forEach((c, i) => {
        const r = 42.5 - i * 3;
        tail += `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx} ${cy - r}" fill="none" stroke="${c}" stroke-width="3.2"/>`;
      });
      tail += `<path d="M${cx - 21} ${cy} A21 21 0 0 1 ${cx} ${cy - 21}" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M${cx} ${cy - 45} Q ${cx + 6} ${cy - 33} ${cx} ${cy - 21}" fill="${cols[3]}" ${S(2.4)}/>`;
      return `${tail}
      ${feet(49, 67, fur)}
      <ellipse cx="58" cy="86" rx="20" ry="17" fill="${fur}" ${S(3)}/>
      <ellipse cx="58" cy="89" rx="10" ry="9" fill="#fff" opacity=".9"/>
      <path d="M36 38 L33 10 L55 25 Z" fill="${fur}" ${S(3)}/><path d="M39 33 L37.5 17 L50 26 Z" fill="#FFB3C7"/>
      <path d="M80 38 L83 10 L61 25 Z" fill="${fur}" ${S(3)}/><path d="M77 33 L78.5 17 L66 26 Z" fill="#FFB3C7"/>
      <ellipse cx="58" cy="46" rx="27" ry="22" fill="${fur}" ${S(3)}/>
      ${hunterCap(58, 26, 1, 0)}
      ${eyes(48, 68, 47, 'cool')}${blush(40, 76, 55)}
      <path d="M52 55 Q55 58.5 58 55 Q61 58.5 64 55" fill="none" ${S(2.4)}/>
      <path d="M30 51 L40 53 M30 57 L40 56 M86 51 L76 53 M86 57 L76 56" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
      ${bow(22, 50, 104, 77, fur)}`;
    },
  },

  // 8 먹물이 · 여덟 다리 문어 닌자 — 다리 8개
  8: {
    color: '#FF8AA6', hide: '다리 8개',
    sparkles: [[42, 28], [80, 30], [60, 66]], crown: [60, 12, -8],
    draw() {
      const skin = '#FF8AA6';
      let legsO = '', legsF = '', cups = '';
      for (let i = 0; i < 8; i++) {
        const x0 = 33 + i * 7.7;
        const ex = x0 + (i - 3.5) * 4.6;
        const ey = 99 + (i % 2) * 3;
        const c = i < 4 ? -1 : 1;
        const d = `M${x0.toFixed(1)} 70 C${x0.toFixed(1)} 84, ${(ex - c * 2).toFixed(1)} 90, ${ex.toFixed(1)} ${ey} q${c * 5} 4 ${c * 7} -2`;
        legsO += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="11.5" stroke-linecap="round"/>`;
        legsF += `<path d="${d}" fill="none" stroke="${skin}" stroke-width="6.5" stroke-linecap="round"/>`;
        cups += `<circle cx="${(ex - c).toFixed(1)}" cy="${ey - 6}" r="1.5" fill="#FFD3DF"/>`;
      }
      return `${legsO}${legsF}${cups}
      <path d="M28 68 C 24 34, 42 15, 60 15 C 78 15, 96 34, 92 68 C 80 77, 40 77, 28 68 Z" fill="${skin}" ${S(3)}/>
      ${shine(44, 27, 8, 4.5, -30)}
      ${ninjaBand(38, 27, 93, 91)}
      ${eyes(49, 71, 51, 'norm', 0.9)}
      <path d="M33 57 C 50 53, 70 53, 87 57 C 87 67, 78 73, 60 73 C 42 73, 33 67, 33 57 Z" fill="#3A3F6B" ${S(2.4)}/>
      <path d="M44 63 Q 50 66 56 63 M64 63 Q 70 66 76 63" stroke="#5A609A" stroke-width="1.6" fill="none"/>
      ${shuriken(103, 18)}
      <path d="M86 12 L94 15 M84 20 L92 21" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
    },
  },

  // 9 여우비 · 아홉 꼬리 구미호 — 꼬리 9개
  9: {
    color: '#FF9B4A', hide: '꼬리 9개',
    sparkles: [[44, 48], [76, 46], [60, 88]], crown: [48, 26, -14],
    draw() {
      const fur = '#FF9B4A';
      const tid = uid('tail');
      const shape = 'M0 0 C -17 -10, -19 -38, -3 -58 C 2 -52, 8 -52, 12 -56 C 20 -36, 13 -10, 0 0 Z';
      const tails = `<defs><clipPath id="${tid}"><path d="${shape}"/></clipPath></defs>` +
        [-38, -58, -78, -98, 34, 50, 66, 82, 98]
          .map((a) => `<g transform="translate(60 84) rotate(${a})"><path d="${shape}" fill="${fur}"/><g clip-path="url(#${tid})"><ellipse cx="4" cy="-56" rx="20" ry="15" fill="#FFF8EE"/></g><path d="${shape}" fill="none" ${S(2.6)}/></g>`)
          .join('');
      const flame = (x: number, y: number) =>
        `<g transform="translate(${x} ${y})"><path d="M0 -10 C 6 -4, 7 3, 0 7 C -7 3, -6 -4, 0 -10 Z" fill="#7FE7FF" ${S(1.8)}/><path d="M0 -3 C 2 0, 2 3, 0 4 C -2 3, -2 0, 0 -3 Z" fill="#fff"/></g>`;
      return `${tails}
      ${feet(52, 68, fur, 7, 4.4)}
      <ellipse cx="60" cy="88" rx="17" ry="15" fill="${fur}" ${S(3)}/><ellipse cx="60" cy="91" rx="9" ry="9" fill="#FFF4E6"/>
      <path d="M41 42 L35 12 L57 30 Z" fill="${fur}" ${S(3)}/><path d="M37.5 22 L35 12 L44 18 Z" fill="${INK}"/>
      <path d="M79 42 L85 12 L63 30 Z" fill="${fur}" ${S(3)}/><path d="M82.5 22 L85 12 L76 18 Z" fill="${INK}"/>
      <ellipse cx="60" cy="52" rx="24" ry="20" fill="${fur}" ${S(3)}/>
      <path d="M42 57 C 49 70, 71 70, 78 57 C 70 52, 50 52, 42 57 Z" fill="#FFF4E6"/>
      <ellipse cx="60" cy="58" rx="3" ry="2.2" fill="${INK}"/>
      ${eyes(50, 70, 50, 'norm', 0.95)}${blush(42, 78, 59)}
      <path d="M56 62 Q60 65 64 62" fill="none" ${S(2.2)}/>
      ${wizardHat(60, 34, 1.1, 4)}
      ${stick(80, 86, 98, 58, '#B8763E', 2.8)}${goldStar(99, 55, 8)}
      ${paw(79, 86, fur)}
      ${flame(16, 26)}${flame(108, 34)}`;
    },
  },

  // 10 스트라이크 · 볼링 하마 — 볼링 핀 10개
  10: {
    color: '#9EC3FF', hide: '볼링 핀 10개 = 1+2+3+4',
    sparkles: [[40, 84], [70, 92], [56, 66]], crown: [50, 16, -8],
    draw() {
      const sk = '#9EC3FF', lt = '#C9DCFF';
      let pins = '';
      for (let r = 0; r < 4; r++) {
        const count = 4 - r;
        for (let i = 0; i < count; i++) {
          const x = 18 + (i - (count - 1) / 2) * 6.2;
          const y = 12 + r * 6.4;
          pins += `<rect x="${(x - 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="4" height="8.4" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.2"/><rect x="${(x - 2).toFixed(1)}" y="${(y - 1.4).toFixed(1)}" width="4" height="1.6" fill="#FF5D6C"/>`;
        }
      }
      return `${pins}
      ${feet(42, 70, sk, 9, 5)}
      <ellipse cx="56" cy="80" rx="28" ry="24" fill="${sk}" ${S(3)}/>
      <ellipse cx="56" cy="84" rx="17" ry="15" fill="${lt}"/>
      <ellipse cx="37" cy="31" rx="6" ry="5" fill="${sk}" ${S(2.4)}/><ellipse cx="75" cy="31" rx="6" ry="5" fill="${sk}" ${S(2.4)}/>
      <ellipse cx="56" cy="46" rx="26" ry="19" fill="${sk}" ${S(3)}/>
      <ellipse cx="56" cy="57" rx="19" ry="11" fill="${lt}" ${S(2.4)}/>
      <ellipse cx="49" cy="55" rx="2" ry="2.6" fill="${INK}"/><ellipse cx="63" cy="55" rx="2" ry="2.6" fill="${INK}"/>
      ${eyes(46, 66, 41, 'norm', 0.9)}
      <path d="M50 62 Q56 66 62 62" fill="none" ${S(2.2)}/>
      ${blush(36, 76, 49)}
      ${hunterCap(54, 30, 0.9, -4)}
      <circle cx="90" cy="82" r="13" fill="#4B3FA8" ${S(3)}/>
      <circle cx="86" cy="77" r="2" fill="${INK}"/><circle cx="92" cy="76" r="2" fill="${INK}"/><circle cx="89" cy="82" r="2" fill="${INK}"/>
      ${shine(84, 88, 4, 2.4)}
      ${paw(79, 88, sk)}${paw(31, 84, sk)}`;
    },
  },

  // 11 일일이 · 쌍검 개구리 닌자 — 칼 두 자루 = 1 1
  11: {
    color: '#58C9A0', hide: '등에 칼 두 자루 = 1 1',
    sparkles: [[46, 90], [76, 90], [60, 24]], crown: [60, 26, 0],
    draw() {
      const sk = '#58C9A0', lt = '#BDF0D8';
      const sword = (x: number) =>
        `<rect x="${x - 2.6}" y="16" width="5.2" height="50" rx="2" fill="#E8EEF6" ${S(2)}/><rect x="${x - 6}" y="16" width="12" height="4" rx="2" fill="#E2B53E" ${S(1.8)}/><rect x="${x - 3}" y="2" width="6" height="14" rx="2" fill="#3A3F6B" ${S(2)}/>`;
      return `${sword(38)}${sword(82)}
      ${feet(50, 70, sk, 8, 4.4)}
      <ellipse cx="60" cy="86" rx="20" ry="17" fill="${sk}" ${S(3)}/>
      <ellipse cx="60" cy="89" rx="12" ry="11" fill="${lt}"/>
      <circle cx="45" cy="40" r="10" fill="${sk}" ${S(3)}/><circle cx="75" cy="40" r="10" fill="${sk}" ${S(3)}/>
      <ellipse cx="60" cy="56" rx="28" ry="17" fill="${sk}" ${S(3)}/>
      <circle cx="45" cy="41" r="8.6" fill="${sk}"/><circle cx="75" cy="41" r="8.6" fill="${sk}"/>
      ${eyes(45, 75, 40, 'cool', 0.95)}
      <path d="M38 71 C 50 75, 70 75, 82 71 L82 77 C 70 81, 50 81, 38 77 Z" fill="#F0506E" ${S(2.2)}/>
      <path d="M40 75 C 30 77, 24 85, 14 85 C 21 91, 32 89, 40 81 Z" fill="#F0506E" ${S(2.2)}/>
      <path d="M36 56 C 50 52, 70 52, 84 56 C 84 64, 74 70, 60 70 C 46 70, 36 64, 36 56 Z" fill="#3A3F6B" ${S(2.4)}/>
      ${paw(41, 88, sk)}${paw(80, 88, sk)}
      ${shuriken(102, 70, 15, 0.8)}`;
    },
  },

  // 12 똑딱경 · 시계 기사 — 눈금 12개
  12: {
    color: '#E2B53E', hide: '시계 눈금 12개',
    sparkles: [[44, 90], [78, 64], [60, 24]], crown: [50, 12, -12],
    draw() {
      const steel = '#B9C7DC', skin = '#F5D7B0';
      let ticks = '';
      for (let i = 0; i < 12; i++) {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        const r1 = i % 3 === 0 ? 14.5 : 16.5;
        ticks += `<path d="M${(60 + r1 * Math.cos(a)).toFixed(1)} ${(76 + r1 * Math.sin(a)).toFixed(1)} L${(60 + 19.5 * Math.cos(a)).toFixed(1)} ${(76 + 19.5 * Math.sin(a)).toFixed(1)}" stroke="${INK}" stroke-width="${i % 3 === 0 ? 2.6 : 1.6}" stroke-linecap="round"/>`;
      }
      return `${feet(48, 72, steel, 8, 4.6)}
      <circle cx="60" cy="76" r="26" fill="#E2B53E" ${S(3)}/>
      <circle cx="60" cy="76" r="21" fill="#FFF6E0" ${S(2)}/>
      ${ticks}
      <path d="M60 76 V58" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M60 76 V64" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/><circle cx="60" cy="76" r="2.6" fill="#FF5D6C" ${S(1.4)}/>
      <circle cx="60" cy="38" r="17" fill="${skin}" ${S(3)}/>
      <path d="M42 37 C 42 15, 78 15, 78 37 Z" fill="${steel}" ${S(3)}/>
      <rect x="40" y="34" width="40" height="6.5" rx="3.2" fill="#8FA2C2" ${S(2.4)}/>
      <path d="M60 18 C 57 6, 70 2, 77 6 C 70 9, 66 12, 62 19 Z" fill="#3FA3FF" ${S(2.2)}/>
      ${eyes(53, 67, 46, 'norm', 0.78)}
      ${smile(60, 51, 3.2)}${blush(47, 73, 51)}
      ${stick(96, 100, 96, 36, '#E2B53E', 3)}
      <path d="M96 22 L103 37 L89 37 Z" fill="#E2B53E" ${S(2.2)}/>
      ${paw(94, 76, skin)}
      ${knightShield(22, 76, 0.95, steel, `<circle cx="0" cy="-4" r="6.5" fill="#FFF6E0" ${S(1.6)}/><path d="M0 -4 V-8.5 M0 -4 H3.6" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`)}`;
    },
  },

  // 13 덤덤이 · 덤 빵 제빵사 곰 — 빵 12개 + 덤 1개
  13: {
    color: '#C98B5A', hide: '빵 13개 = 12개 + 덤 1개',
    sparkles: [[36, 52], [84, 50], [72, 92]], crown: [60, 4, 0],
    draw() {
      const fur = '#C98B5A', lt = '#F3D9B8';
      let buns = '';
      const rows: [number, number, number][] = [[5, 11.6, 77], [4, 14.4, 72], [3, 17.2, 67]];
      for (const [n, x0, yy] of rows) for (let i = 0; i < n; i++) buns += `<circle cx="${(x0 + i * 5.6).toFixed(1)}" cy="${yy}" r="2.9" fill="#F2B860" stroke="${INK}" stroke-width="1.3"/>`;
      buns += `<circle cx="22.8" cy="61.6" r="3.2" fill="#FFD43B" stroke="${INK}" stroke-width="1.4"/>`;
      return `${feet(50, 70, fur, 8, 4.6)}
      <ellipse cx="60" cy="84" rx="22" ry="19" fill="${fur}" ${S(3)}/>
      <path d="M44 74 H76 V96 C 70 101, 50 101, 44 96 Z" fill="#fff" ${S(2.4)}/>
      ${heart(60, 86, 0.55)}
      <circle cx="42" cy="34" r="7" fill="${fur}" ${S(2.6)}/><circle cx="78" cy="34" r="7" fill="${fur}" ${S(2.6)}/>
      <circle cx="42" cy="34" r="3.4" fill="${lt}"/><circle cx="78" cy="34" r="3.4" fill="${lt}"/>
      <circle cx="60" cy="52" r="22" fill="${fur}" ${S(3)}/>
      <ellipse cx="60" cy="60" rx="10" ry="7.5" fill="${lt}" ${S(2)}/>
      <ellipse cx="60" cy="56.5" rx="3.4" ry="2.4" fill="${INK}"/>
      <path d="M56 62 Q60 65 64 62" fill="none" ${S(2)}/>
      ${eyes(51, 69, 49, 'happy')}${blush(43, 77, 57)}
      <path d="M44 36 C 34 30, 38 14, 49 17 C 51 6, 69 6, 71 17 C 82 14, 86 30, 76 36 Z" fill="#fff" ${S(2.6)}/>
      <rect x="44" y="31" width="32" height="7" rx="2" fill="#fff" ${S(2.4)}/>
      ${heart(60, 34.5, 0.32)}
      <path d="M8 80 H38 L35 98 H11 Z" fill="#C98B4E" ${S(2.4)}/>
      <path d="M10 86 H36 M11 92 H35" stroke="#8B5A2B" stroke-width="1.6"/>
      ${buns}
      ${paw(41, 86, fur)}${paw(82, 84, fur)}`;
    },
  },

  // 15 달콩이 · 보름달 떡방아 호랑이 기사 — 보름 = 15일
  15: {
    color: '#FFA94D', hide: '보름(음력 15일)에 뜨는 보름달',
    sparkles: [[44, 86], [76, 88], [56, 30]], crown: [60, 24, 0],
    draw() {
      const fur = '#FFA94D', lt = '#FFF4E6';
      return `<circle cx="60" cy="42" r="36" fill="#FFF2B0" opacity=".85" ${S(2)}/>
      <circle cx="34" cy="28" r="5" fill="#F3DF8A"/><circle cx="88" cy="48" r="4" fill="#F3DF8A"/><circle cx="78" cy="16" r="3" fill="#F3DF8A"/>
      ${feet(50, 70, fur, 8, 4.6)}
      <ellipse cx="60" cy="84" rx="21" ry="19" fill="${fur}" ${S(3)}/>
      <path d="M45 74 C 52 70, 68 70, 75 74 L73 92 C 66 96, 54 96, 47 92 Z" fill="#B9C7DC" ${S(2.4)}/>
      <path d="M60 72 V95" stroke="#8FA2C2" stroke-width="2"/>
      <circle cx="42" cy="34" r="7" fill="${fur}" ${S(2.6)}/><circle cx="78" cy="34" r="7" fill="${fur}" ${S(2.6)}/>
      <circle cx="42" cy="34" r="3.2" fill="${INK}"/><circle cx="78" cy="34" r="3.2" fill="${INK}"/>
      <circle cx="60" cy="52" r="22" fill="${fur}" ${S(3)}/>
      <path d="M54 32 L56 38 M60 31 V38 M66 32 L64 38 M38 50 L44 52 M38 56 L44 56 M82 50 L76 52 M82 56 L76 56" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M48 60 C 52 68, 68 68, 72 60 C 66 56, 54 56, 48 60 Z" fill="${lt}"/>
      <ellipse cx="60" cy="59" rx="3" ry="2.2" fill="${INK}"/>
      ${eyes(51, 69, 50, 'norm', 0.9)}
      <path d="M56 64 Q60 67 64 64" fill="none" ${S(2)}/>
      ${blush(44, 76, 58)}
      ${stick(84, 98, 98, 58, '#8B5A2B', 3.4)}
      <rect x="88" y="44" width="22" height="14" rx="4" fill="#C98B4E" ${S(2.6)} transform="rotate(20 99 51)"/>
      ${paw(87, 84, fur)}
      ${knightShield(22, 78, 0.95, '#B9C7DC', `<path d="M3 -12 A 8 8 0 1 0 3 4 A 6 6 0 1 1 3 -12 Z" fill="#FFE27A" ${S(1.4)}/>`)}`;
    },
  },

  // 16 접접이 · 종이비행기 생쥐 — 반으로 4번 접으면 16칸
  16: {
    color: '#C9CFDA', hide: '반으로 4번 접으면 16칸 (2×2×2×2)',
    sparkles: [[44, 90], [76, 90], [60, 42]], crown: [56, 20, -4],
    draw() {
      const fur = '#C9CFDA', lt = '#EEF1F6';
      let grid = '';
      for (let i = 1; i < 4; i++) grid += `M${10 + i * 6} 68 V92 M10 ${68 + i * 6} H34 `;
      return `<path d="M74 96 C 96 100, 104 84, 96 74 C 92 70, 88 74, 92 78" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M74 96 C 96 100, 104 84, 96 74 C 92 70, 88 74, 92 78" fill="none" stroke="#F4A7B9" stroke-width="2.4" stroke-linecap="round"/>
      ${feet(50, 70, fur, 7.5, 4.4)}
      <ellipse cx="60" cy="86" rx="17" ry="16" fill="${fur}" ${S(3)}/>
      <ellipse cx="60" cy="89" rx="10" ry="10" fill="${lt}"/>
      <circle cx="38" cy="34" r="13" fill="${fur}" ${S(3)}/><circle cx="38" cy="34" r="8" fill="#FFB3C7"/>
      <circle cx="82" cy="34" r="13" fill="${fur}" ${S(3)}/><circle cx="82" cy="34" r="8" fill="#FFB3C7"/>
      <ellipse cx="60" cy="54" rx="21" ry="19" fill="${fur}" ${S(3)}/>
      ${hunterCap(58, 38, 0.85, 0)}
      ${eyes(52, 68, 52, 'norm', 0.9)}
      <ellipse cx="60" cy="61" rx="3" ry="2.3" fill="#FF6F91" ${S(1.4)}/>
      <path d="M56 65 Q60 68 64 65" fill="none" ${S(2)}/>
      <path d="M40 58 L50 60 M40 64 L50 63 M80 58 L70 60 M80 64 L70 63" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>
      ${blush(45, 75, 61)}
      <path d="M84 54 L114 40 L94 62 Z" fill="#fff" ${S(2.2)}/><path d="M84 54 L114 40 L92 56 Z" fill="#E8EEF6" ${S(1.6)}/>
      ${paw(86, 60, fur)}
      <g transform="rotate(-8 22 80)"><rect x="10" y="68" width="24" height="24" rx="1.5" fill="#fff" ${S(2.2)}/><path d="${grid}" stroke="#9AA6BC" stroke-width="1.2" stroke-dasharray="2 1.6"/></g>
      ${paw(35, 84, fur)}`;
    },
  },

  // 17 맴순이 · 17년 매미 싱어
  17: {
    color: '#A4E36A', hide: '땅속에서 17년 (17은 다이아: 약수가 1과 17뿐)',
    sparkles: [[18, 60], [102, 60], [52, 92]], crown: [60, 18, 0],
    draw() {
      const g = '#A4E36A';
      const wing = (m: string) =>
        `<g transform="${m}"><path d="M48 58 C 30 40, 6 44, 4 64 C 8 84, 34 88, 50 72 Z" fill="#DDF6FF" opacity=".85" ${S(2.6)}/><path d="M46 62 C 32 58, 18 60, 8 66 M44 66 C 32 70, 20 76, 14 80 M36 60 L30 76 M24 58 L22 80" stroke="#7FB8D6" stroke-width="1.5" fill="none"/></g>`;
      return `${wing('')}${wing('translate(120 0) scale(-1 1)')}
      ${feet(51, 69, g, 7, 4.4)}
      <ellipse cx="60" cy="80" rx="18" ry="22" fill="${g}" ${S(3)}/>
      <path d="M44 84 Q60 89 76 84 M45 92 Q60 97 75 92" stroke="#5FA83A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      ${headphones(60, 12, 26, 42)}
      <ellipse cx="60" cy="47" rx="26" ry="19" fill="${g}" ${S(3)}/>
      ${shine(46, 36, 7, 3.8, -25)}
      <rect x="25" y="36" width="12" height="18" rx="5" fill="#FF6FA8" ${S(2.6)}/><rect x="83" y="36" width="12" height="18" rx="5" fill="#FF6FA8" ${S(2.6)}/>
      ${eyes(49, 71, 45, 'happy')}${blush(44, 76, 52)}
      <ellipse cx="60" cy="56" rx="4.4" ry="5" fill="#7a1035" ${S(2.2)}/>
      ${mic(74, 82, 86, 66)}
      ${paw(74, 83, g)}
      ${note(104, 30)}${note(14, 28, '#FF6FA8', 0.8)}`;
    },
  },

  // 18 빵빵 · 변신 트럭 로봇 — 짐 상자 3×6
  18: {
    color: '#FF5D5D', hide: '짐 상자 3×6 = 18개 (쓰러지면 3과 6 꼬마로)',
    sparkles: [[44, 74], [80, 86], [60, 30]], crown: [60, 9, 0],
    draw() {
      const red = '#FF5D5D', steel = '#C5D3E8';
      let boxes = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) boxes += `<rect x="${(40.6 + c * 6.8).toFixed(1)}" y="${(65.6 + r * 8.4).toFixed(1)}" width="5.6" height="7" rx="1" fill="#F2B860" stroke="${INK}" stroke-width="1.1"/>`;
      const wheel = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2B2350" ${S(2.4)}/><circle cx="${x}" cy="${y}" r="${r * 0.38}" fill="${steel}" ${S(1.4)}/>`;
      return `${wheel(46, 102, 7)}${wheel(74, 102, 7)}
      <rect x="32" y="56" width="56" height="42" rx="7" fill="${red}" ${S(3)}/>
      <rect x="39" y="64" width="42" height="27" rx="3" fill="#7A4A2A" ${S(2)}/>
      ${boxes}
      <circle cx="38" cy="60" r="2.4" fill="#FFE27A" stroke="${INK}" stroke-width="1.2"/><circle cx="82" cy="60" r="2.4" fill="#FFE27A" stroke="${INK}" stroke-width="1.2"/>
      ${wheel(30, 62, 9)}${wheel(90, 62, 9)}
      <path d="M50 24 C 52 10, 68 10, 70 24 Z" fill="${red}" ${S(2.4)}/>
      <rect x="42" y="22" width="36" height="32" rx="7" fill="${steel}" ${S(3)}/>
      <rect x="46" y="27" width="28" height="16" rx="5" fill="#2B4A8A" ${S(2.2)}/>
      ${eyes(54, 66, 35.5, 'norm', 0.7)}
      <rect x="52" y="46" width="16" height="4" rx="2" fill="#8FA2C2" ${S(1.4)}/>
      ${knightShield(15, 84, 0.8, red, `<rect x="-7" y="-15" width="14" height="9" rx="2" fill="#7FE7FF" ${S(1.4)}/>`)}
      ${paw(98, 82, steel, 7, 6)}`;
    },
  },

  // 20 물음표 · 스무고개 부엉이 박사 — 질문 20번(5개씩 4묶음)
  20: {
    color: '#C9A27B', hide: '스무고개 = 질문 20번 (5개씩 4묶음)',
    sparkles: [[40, 90], [80, 90], [60, 46]], crown: [42, 30, -22],
    draw() {
      const fur = '#C9A27B', lt = '#F1DDBF', wing = '#A9845E';
      let tally = '';
      for (let gi = 0; gi < 4; gi++) {
        const x0 = 7.5 + gi * 6.8;
        for (let k = 0; k < 4; k++) tally += `M${(x0 + k * 1.4).toFixed(1)} 75 V85 `;
        tally += `M${(x0 - 0.8).toFixed(1)} 84 L${(x0 + 5).toFixed(1)} 76 `;
      }
      return `${feet(50, 70, '#FFB13B', 6, 4)}
      <path d="M36 44 L30 24 L46 36 Z" fill="${fur}" ${S(2.6)}/><path d="M84 44 L90 24 L74 36 Z" fill="${fur}" ${S(2.6)}/>
      <ellipse cx="60" cy="70" rx="29" ry="33" fill="${fur}" ${S(3)}/>
      <path d="M33 64 C 24 74, 26 92, 36 98 C 38 86, 38 74, 36 64 Z" fill="${wing}" ${S(2.4)}/>
      <path d="M87 64 C 96 74, 94 92, 84 98 C 82 86, 82 74, 84 64 Z" fill="${wing}" ${S(2.4)}/>
      <ellipse cx="60" cy="85" rx="16" ry="14" fill="${lt}"/>
      <path d="M52 80 L55 83 L58 80 M62 80 L65 83 L68 80 M56 88 L59 91 L62 88" stroke="${wing}" stroke-width="1.6" fill="none"/>
      <circle cx="48" cy="57" r="12.5" fill="${lt}" ${S(2.2)}/><circle cx="72" cy="57" r="12.5" fill="${lt}" ${S(2.2)}/>
      ${eyes(48, 72, 57, 'norm', 1.0)}
      <circle cx="48" cy="57" r="10" fill="none" stroke="#E2B53E" stroke-width="2.4"/><circle cx="72" cy="57" r="10" fill="none" stroke="#E2B53E" stroke-width="2.4"/><path d="M58 56 H62" stroke="#E2B53E" stroke-width="2.4"/>
      <path d="M56 67 L64 67 L60 74 Z" fill="#FFB13B" ${S(2)}/>
      ${wizardHat(60, 39, 0.95, -6)}
      <text x="104" y="30" text-anchor="middle" font-family="Jua, sans-serif" font-size="20" fill="#7FE7FF" stroke="${INK}" stroke-width="4" paint-order="stroke">?</text>
      ${stick(88, 86, 104, 58, '#B8763E', 2.8)}${goldStar(105, 55, 7.5)}
      ${paw(88, 86, fur)}
      <rect x="4" y="71" width="30" height="18" rx="3" fill="#FFF6DA" ${S(2)}/>
      <path d="${tally}" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
      ${paw(33, 84, fur)}`;
    },
  },

  // 21 굴리 · 주사위 닌자 — 눈 1+2+3+4+5+6 = 21
  21: {
    color: '#F4F4FA', hide: '주사위 눈 1+2+3+4+5+6 = 21',
    sparkles: [[44, 92], [90, 62], [66, 40]], crown: [62, 28, 0],
    draw() {
      const nv = '#3A3F6B';
      let top = '';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const t = 0.3 + 0.4 * j;
        const x = 34 + 48 * (0.25 + 0.25 * i) + 14 * t;
        const y = 48 - 14 * t;
        top += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.8" ry="1.6" fill="${INK}"/>`;
      }
      let side = '';
      for (const [s, t] of [[0.25, 0.2], [0.75, 0.2], [0.5, 0.5], [0.25, 0.8], [0.75, 0.8]]) {
        side += `<ellipse cx="${(82 + 14 * s).toFixed(1)}" cy="${(48 - 14 * s + 50 * t).toFixed(1)}" rx="1.6" ry="2.8" fill="${INK}"/>`;
      }
      return `${feet(48, 72, nv, 7, 4.4)}
      <path d="M34 48 L48 34 L96 34 L82 48 Z" fill="#F4F4FA" ${S(3)}/>
      <path d="M82 48 L96 34 L96 84 L82 98 Z" fill="#D9DCEA" ${S(3)}/>
      <rect x="34" y="48" width="48" height="50" rx="4" fill="#FFFFFF" ${S(3)}/>
      ${top}${side}
      ${ninjaBand(58, 34, 82, 80)}
      ${eyes(50, 66, 71, 'cool', 0.9)}
      <path d="M36 79 C 48 76, 68 76, 80 79 C 80 90, 70 95, 58 95 C 46 95, 36 90, 36 79 Z" fill="${nv}" ${S(2.2)}/>
      ${paw(30, 84, nv)}${paw(88, 88, nv)}
      ${shuriken(16, 70, 10, 0.85)}`;
    },
  },

  // 24 하루 · 하루 해님 왕 — 햇살 24줄
  24: {
    color: '#FFD23F', hide: '햇살 24줄 = 하루 24시간',
    sparkles: [[40, 72], [80, 74], [60, 40]], crown: [60, 24, 0],
    draw() {
      let rays = '';
      for (let i = 0; i < 24; i++) {
        const a = i * 15 - 90;
        const long = i % 2 === 0;
        const R2 = long ? 44 : 38;
        const p = (ang: number, r: number) => {
          const rad = (ang * Math.PI) / 180;
          return `${(60 + r * Math.cos(rad)).toFixed(1)} ${(56 + r * Math.sin(rad)).toFixed(1)}`;
        };
        rays += `<path d="M${p(a - 5, 28)} L${p(a, R2)} L${p(a + 5, 28)} Z" fill="${long ? '#FF9A3C' : '#FFD43B'}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
      }
      return `${rays}
      <circle cx="60" cy="56" r="30" fill="#FFD23F" ${S(3)}/>
      ${shine(46, 40, 8, 4.4)}
      ${eyes(50, 70, 52, 'happy')}
      <path d="M51 62 Q60 72 69 62 Z" fill="#7a1035" ${S(2.2)}/>
      ${blush(42, 78, 60)}
      ${mic(86, 84, 98, 70)}${paw(86, 84, '#FFD23F')}
      ${note(12, 30)}${note(108, 18, '#FF6FA8', 0.8)}`;
    },
  },

  // 25 빙고리 · 빙고 너구리 헌터 — 빙고판 5×5
  25: {
    color: '#A9A7B8', hide: '빙고판 5×5 = 25칸',
    sparkles: [[40, 92], [80, 84], [46, 34]], crown: [54, 16, -6],
    draw() {
      const fur = '#A9A7B8', dk = '#4A4860', lt = '#E6E4EE';
      let grid = '';
      for (let i = 1; i < 5; i++) grid += `M${46 + i * 4.8} 74 V98 M46 ${74 + i * 4.8} H70 `;
      let stamps = '';
      for (let i = 0; i < 5; i++) stamps += `<circle cx="${(48.4 + i * 4.8).toFixed(1)}" cy="${(76.4 + i * 4.8).toFixed(1)}" r="1.8" fill="#FF5D6C"/>`;
      const tail = 'M74 92 C 96 96, 108 78, 100 58';
      return `<path d="${tail}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
      <path d="${tail}" fill="none" stroke="${fur}" stroke-width="10" stroke-linecap="round"/>
      <path d="${tail}" fill="none" stroke="${dk}" stroke-width="10" stroke-dasharray="5 6"/>
      ${feet(48, 68, dk, 7.5, 4.4)}
      <ellipse cx="58" cy="86" rx="19" ry="17" fill="${fur}" ${S(3)}/>
      <rect x="46" y="74" width="24" height="24" rx="2" fill="#fff" ${S(2)}/>
      <path d="${grid}" stroke="#9AA6BC" stroke-width="1"/>${stamps}
      <path d="M38 40 L36 22 L52 32 Z" fill="${fur}" ${S(2.6)}/><path d="M78 40 L80 22 L64 32 Z" fill="${fur}" ${S(2.6)}/>
      <path d="M40 36 L39 27 L47 32 Z M76 36 L77 27 L69 32 Z" fill="${dk}"/>
      <ellipse cx="58" cy="52" rx="24" ry="21" fill="${fur}" ${S(3)}/>
      <path d="M44 60 C 50 70, 66 70, 72 60 C 66 56, 50 56, 44 60 Z" fill="${lt}"/>
      <path d="M35 50 C 42 41, 54 44, 58 49 C 62 44, 74 41, 81 50 C 76 59, 66 57, 58 54 C 50 57, 40 59, 35 50 Z" fill="${dk}"/>
      ${eyes(48, 68, 50, 'norm', 0.85)}
      <ellipse cx="58" cy="59" rx="3" ry="2.2" fill="${INK}"/>
      <path d="M54 63 Q58 66 62 63" fill="none" ${S(2)}/>
      ${hunterCap(56, 32, 0.9, -4)}
      ${bow(22, 52, 102, 78, fur)}`;
    },
  },

  // 28 그림자 · 완벽 닌자 까마귀 — 1+2+4+7+14 = 28
  28: {
    color: '#3A3D5C', hide: '자기 빼고 약수 1+2+4+7+14 = 28 (완전수)',
    sparkles: [[44, 92], [78, 92], [60, 34]], crown: [62, 22, 8],
    draw() {
      const fur = '#3A3D5C', lt = '#5A5F86';
      const kunai = [-62, -38, -14, 10, 34]
        .map((a) => `<g transform="translate(92 80) rotate(${a})"><path d="M0 -8 L-3 -14 L0 -34 L3 -14 Z" fill="#DCE3EE" ${S(1.8)}/><rect x="-1.6" y="-8" width="3.2" height="7" fill="#F0506E" ${S(1.2)}/></g>`)
        .join('');
      return `${kunai}
      <path d="M84 62 C 104 50, 116 64, 112 82 C 104 78, 96 82, 86 88 Z" fill="${fur}" ${S(2.6)}/>
      <path d="M36 62 C 16 50, 4 64, 8 82 C 16 78, 24 82, 34 88 Z" fill="${fur}" ${S(2.6)}/>
      ${feet(50, 70, '#FFB13B', 6, 3.8)}
      <ellipse cx="60" cy="82" rx="21" ry="20" fill="${fur}" ${S(3)}/>
      <ellipse cx="60" cy="86" rx="12" ry="12" fill="${lt}"/>
      <path d="M56 32 C 54 22, 60 16, 66 18 C 62 22, 62 26, 64 31 Z" fill="${fur}" ${S(2.2)}/>
      <circle cx="60" cy="50" r="21" fill="${fur}" ${S(3)}/>
      ${ninjaBand(40, 39, 81, 79)}
      ${eyes(51, 69, 53, 'cool', 0.9)}
      <path d="M54 59 L66 59 L60 69 Z" fill="#FFB13B" ${S(2)}/>
      <path d="M42 67 C 52 71, 68 71, 78 67 L78 73 C 68 77, 52 77, 42 73 Z" fill="#F0506E" ${S(2)}/>`;
    },
  },

  // 30 달래 · 달님 여왕 — 한 달 ≈ 30일
  30: {
    color: '#ECEBFF', hide: '한 달 ≈ 30일 (달이 한 바퀴)',
    sparkles: [[44, 82], [78, 82], [60, 34]], crown: [60, 24, 0],
    draw() {
      const face = '#ECEBFF';
      const gid = uid('moon');
      return `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="#E6E1FF" stop-opacity=".7"/><stop offset=".6" stop-color="#B9A8FF" stop-opacity=".22"/><stop offset="1" stop-color="#B9A8FF" stop-opacity="0"/></radialGradient></defs>
      <circle cx="60" cy="56" r="62" fill="url(#${gid})"/>
      <path d="M40 64 C 30 80, 26 96, 22 104 C 40 108, 80 108, 98 104 C 94 96, 90 80, 80 64 Z" fill="#4B3FA8" ${S(3)}/>
      ${goldStar(38, 94, 3.2)}${goldStar(82, 92, 3.2)}${goldStar(60, 100, 2.6)}${goldStar(48, 82, 2.2)}${goldStar(72, 80, 2.2)}
      <defs><mask id="${gid}m"><rect x="-20" y="-20" width="160" height="160" fill="#fff"/><circle cx="50" cy="40" r="27" fill="#000"/></mask></defs>
      <g mask="url(#${gid}m)"><circle cx="40" cy="46" r="30" fill="#FFE27A" ${S(2.4)}/></g>
      <circle cx="60" cy="50" r="25" fill="${face}" ${S(3)}/>
      <circle cx="44" cy="40" r="3.4" fill="#D6D3F5"/><circle cx="77" cy="61" r="2.6" fill="#D6D3F5"/><circle cx="72" cy="35" r="2" fill="#D6D3F5"/>
      ${eyes(51, 69, 50, 'happy')}
      ${smile(60, 59, 4)}${blush(44, 76, 57)}
      ${stick(90, 100, 94, 46, '#E2B53E', 2.8)}${heart(94, 40, 1)}
      ${paw(89, 78, face)}`;
    },
  },

  // 36 서른여섯 · 황금 보물 용 — 배 비늘 6×6
  36: {
    color: '#FFC23F', hide: '배 비늘 6×6 = 36개',
    sparkles: [[44, 36], [78, 34], [60, 70]], crown: [60, 21, 0],
    draw() {
      const gd = '#FFC23F', belly = '#FFF1B8';
      const gid = uid('glow');
      let scales = '';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) scales += `<circle cx="${(49 + c * 4.4).toFixed(1)}" cy="${(71 + r * 4.4).toFixed(1)}" r="1.5" fill="#E39A12"/>`;
      const wing = (m: string) => `<path transform="${m}" d="M42 58 C 28 34, 8 36, 4 52 C 12 52, 16 58, 17 64 C 24 58, 30 60, 34 67 C 36 62, 40 62, 44 66 Z" fill="#FF8A3D" ${S(2.6)}/>`;
      const coin = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.4" fill="#FFD43B" ${S(1.8)}/>`;
      return `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="#FFE27A" stop-opacity=".75"/><stop offset=".6" stop-color="#FFC23F" stop-opacity=".25"/><stop offset="1" stop-color="#FFC23F" stop-opacity="0"/></radialGradient></defs>
      <circle cx="60" cy="58" r="64" fill="url(#${gid})"/>
      ${wing('')}${wing('translate(120 0) scale(-1 1)')}
      <path d="M78 92 C 102 98, 112 80, 104 66" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
      <path d="M78 92 C 102 98, 112 80, 104 66" fill="none" stroke="${gd}" stroke-width="7" stroke-linecap="round"/>
      <path d="M104 68 L97 60 L104 52 L111 60 Z" fill="#FF8A3D" ${S(2.2)}/>
      ${feet(46, 74, gd, 9, 5)}
      <ellipse cx="60" cy="80" rx="26" ry="24" fill="${gd}" ${S(3)}/>
      <ellipse cx="60" cy="82" rx="18.5" ry="18.5" fill="${belly}" ${S(2.4)}/>
      ${scales}
      <path d="M43 30 C 36 20, 36 10, 40 3 C 45 11, 49 18, 51 25 Z" fill="#FFF6DA" ${S(2.4)}/>
      <path d="M77 30 C 84 20, 84 10, 80 3 C 75 11, 71 18, 69 25 Z" fill="#FFF6DA" ${S(2.4)}/>
      <ellipse cx="60" cy="43" rx="25" ry="21" fill="${gd}" ${S(3)}/>
      ${shine(47, 32, 7, 3.8, -25)}
      <ellipse cx="60" cy="54" rx="13" ry="8" fill="${belly}" ${S(2.2)}/>
      <ellipse cx="56" cy="53" rx="1.6" ry="2.2" fill="${INK}"/><ellipse cx="64" cy="53" rx="1.6" ry="2.2" fill="${INK}"/>
      ${eyes(49, 71, 41)}${blush(40, 80, 48)}
      <path d="M56 58 Q60 61 64 58" fill="none" ${S(2)}/>
      ${stick(22, 104, 22, 44, '#8B5A2B', 3.4)}
      <circle cx="22" cy="37" r="9" fill="#7FE7FF" ${S(2.6)}/><circle cx="19" cy="34" r="3" fill="#fff"/>
      ${paw(34, 78, gd, 6.4, 5.6)}
      ${coin(92, 106)}${coin(100, 103)}${coin(95, 100)}`;
    },
  },
};

export interface CharArtOpts {
  /** 지금 숫자(돌로 바뀌면 다름). 기본 = 캐릭터 번호 */
  num?: number;
  star?: Star;
  /** 판 위 작은 그림: 숫자 글씨 생략 */
  noNumber?: boolean;
  /** 가문 보석 생략 */
  noGems?: boolean;
}

export const famIcon = (f: FamilyId, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${famShape(f)}</svg>`;
export const roleIcon = (r: RoleId, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${roleShape(r)}</svg>`;

function numberText(num: number, changed: boolean): string {
  const fs = String(num).length === 1 ? 24 : 21;
  return `<text x="60" y="121" text-anchor="middle" font-family="Jua, sans-serif" font-size="${fs}" fill="${changed ? '#FFE27A' : '#fff'}" stroke="${INK}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">${num}</text>`;
}

/** 숫자 친구 그림(SVG 문자열) */
export function charArt(char: number, size: number, opts: CharArtOpts = {}): string {
  const art = ART[char];
  const num = opts.num ?? char;
  if (!art) return minionArt(num, size, '#C79BFF');
  const star = opts.star ?? 1;
  const fams = familiesOf(num);
  let over = '';
  if (fams.includes('prime')) over += art.sparkles.map(([x, y], i) => sparkle(x, y, i === 0 ? 1.15 : 0.9)).join('');
  if (fams.includes('rich')) over += crown(...art.crown);
  const gems = opts.noGems
    ? ''
    : fams.map((f, i) => `<g transform="translate(-2 ${-4 + i * 15}) scale(.62)"><circle cx="12" cy="12" r="12" fill="${INK}" opacity=".55"/>${famShape(f)}</g>`).join('');
  const k = star === 3 ? 1.1 : star === 2 ? 1.05 : 1;
  const body = k === 1 ? art.draw() : `<g transform="translate(60 104) scale(${k}) translate(-60 -104)">${art.draw()}</g>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 122" style="overflow:visible" aria-hidden="true">
    ${pedestal(UNITS[char]?.role ?? null, star)}${body}${over}${gems}${opts.noNumber ? '' : numberText(num, num !== char)}</svg>`;
}

/** 부자 친구가 쓰러지며 생긴 꼬마(작은 숫자 젤리) */
export function minionArt(num: number, size: number, color: string): string {
  const body = 'M60 48 C 80 48, 92 64, 92 80 C 92 96, 78 104, 60 104 C 42 104, 28 96, 28 80 C 28 64, 40 48, 60 48 Z';
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 122" style="overflow:visible" aria-hidden="true">
    <ellipse cx="60" cy="106" rx="30" ry="7" fill="#2B2163" opacity=".8"/>
    <path d="${body}" fill="${color}" ${S(3)}/>${shine(48, 60, 7, 4)}
    ${eyes(51, 69, 74, 'norm', 0.8)}${smile(60, 84, 3.4)}
    ${numberText(num, false)}</svg>`;
}

export function charColor(char: number): string {
  return ART[char]?.color ?? '#C79BFF';
}
