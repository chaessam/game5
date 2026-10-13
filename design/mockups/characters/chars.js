// 숫자 친구 그림 시안: 3겹 규칙
// ① 몸 = 캐릭터(숫자가 몸에 숨어 있음)  ② 옷·무기·받침 = 직업  ③ 보석·몸빛 = 가문(숫자에서 계산 → 돌로 숫자가 바뀌면 보석만 바뀜)
const INK = '#1d1440';
const S = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export const FAM_COLOR = { even: '#3FA8FF', tri: '#2ED47A', five: '#FFD43B', prime: '#A97BFF', rich: '#FFAE1F' };
export const FAM_NAME = { even: '짝꿍', tri: '세모', five: '다섯손', prime: '단단', rich: '부자' };
export const ROLE_COLOR = { knight: '#C5D3E8', ninja: '#F0506E', hunter: '#E0A15A', mage: '#7FE7FF', singer: '#FF6FA8', healer: '#6EF0C8' };
export const ROLE_NAME = { knight: '기사', ninja: '닌자', hunter: '헌터', mage: '마법사', singer: '싱어', healer: '힐러' };

export function families(n) {
  let dc = 0;
  for (let i = 1; i <= n; i++) if (n % i === 0) dc++;
  const f = [];
  if (n % 2 === 0) f.push('even');
  if (n % 3 === 0) f.push('tri');
  if (n % 5 === 0) f.push('five');
  if (dc === 2) f.push('prime');
  if (dc >= 6) f.push('rich');
  return f;
}

export function famShape(f) {
  const c = FAM_COLOR[f];
  const st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  return {
    even: `<circle cx="7.5" cy="12" r="5.5" fill="${c}" ${st}/><circle cx="16.5" cy="12" r="5.5" fill="${c}" ${st}/>`,
    tri: `<path d="M12 3 L21.5 20 L2.5 20 Z" fill="${c}" ${st}/>`,
    five: `<circle cx="12" cy="12" r="9" fill="${c}" ${st}/><path d="M8 15 V9 M10.5 15 V7 M13 15 V7 M15.5 15 V9" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    prime: `<path d="M12 2.5 L20 9 L12 21.5 L4 9 Z" fill="${c}" ${st}/>`,
    rich: `<path d="M3 18 L4.5 7 L9 11.5 L12 4.5 L15 11.5 L19.5 7 L21 18 Z" fill="${c}" ${st}/>`,
  }[f];
}
export const famIcon = (f, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${famShape(f)}</svg>`;

export function roleShape(r) {
  const c = ROLE_COLOR[r];
  const st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  return {
    knight: `<path d="M5 3.5 H19 V11 C19 16.5 15 20 12 21.5 C9 20 5 16.5 5 11 Z" fill="${c}" ${st}/><path d="M12 7 V17 M8 11 H16" ${st}/>`,
    ninja: `<path d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z" fill="${c}" ${st}/><circle cx="12" cy="12" r="2.2" fill="#fff" ${st}/>`,
    hunter: `<path d="M7 2.5 C 19 6, 19 18, 7 21.5" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M7 2.5 C 19 6, 19 18, 7 21.5" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M7 2.5 V21.5 M3 12 H20 M16.5 8.5 L20 12 L16.5 15.5" fill="none" ${st}/>`,
    mage: `<path d="M3 21 H21 L16 18 L13.5 2.5 L8 18 Z" fill="#4B3FA8" ${st}/><path d="M12 9.5 l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="${c}"/>`,
    singer: `<path d="M9 19 V6 L19 3.5 V16" fill="none" ${st}/><ellipse cx="6.5" cy="19" rx="3.6" ry="2.8" fill="${c}" ${st}/><ellipse cx="16.5" cy="16.5" rx="3.6" ry="2.8" fill="${c}" ${st}/>`,
    healer: `<path d="M12 21 C 4 15, 2 10, 5 6.5 C 8 3.5, 11 5, 12 7 C 13 5, 16 3.5, 19 6.5 C 22 10, 20 15, 12 21 Z" fill="${c}" ${st}/><path d="M12 10 V16 M9 13 H15" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  }[r];
}
export const roleIcon = (r, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${roleShape(r)}</svg>`;

// ---------- 공통 부품 ----------
function eyes(x1, x2, y, mode = 'norm', s = 1, lid = '#fff') {
  if (mode === 'happy')
    return `<path d="M${x1 - 5 * s} ${y + 1} Q${x1} ${y - 6 * s} ${x1 + 5 * s} ${y + 1} M${x2 - 5 * s} ${y + 1} Q${x2} ${y - 6 * s} ${x2 + 5 * s} ${y + 1}" fill="none" ${S(3)}/>`;
  const one = (x) =>
    `<ellipse cx="${x}" cy="${y}" rx="${5.6 * s}" ry="${6.6 * s}" fill="#fff" ${S(1.6)}/>` +
    `<circle cx="${x + 0.8 * s}" cy="${y + 1.2 * s}" r="${3.9 * s}" fill="${INK}"/>` +
    `<circle cx="${x + 2.1 * s}" cy="${y - 0.6 * s}" r="${1.5 * s}" fill="#fff"/>`;
  if (mode === 'cool') {
    // 반쯤 감은 눈: 아래 반쪽 + 굵은 눈꺼풀 선
    const half = (x) =>
      `<path d="M${x - 6 * s} ${y} A ${6 * s} ${6.6 * s} 0 0 0 ${x + 6 * s} ${y} Z" fill="#fff" ${S(1.6)}/>` +
      `<circle cx="${x + 1 * s}" cy="${y + 2.6 * s}" r="${3.3 * s}" fill="${INK}"/><circle cx="${x + 2.2 * s}" cy="${y + 1.7 * s}" r="${1.2 * s}" fill="#fff"/>` +
      `<path d="M${x - 7.2 * s} ${y - 0.6} L${x + 7.2 * s} ${y + 0.6}" ${S(3.4)}/>`;
    return half(x1) + half(x2);
  }
  let out = one(x1) + one(x2);
  return out;
}
const blush = (x1, x2, y) =>
  `<ellipse cx="${x1}" cy="${y}" rx="4.6" ry="2.6" fill="#ff6b9a" opacity=".5"/><ellipse cx="${x2}" cy="${y}" rx="4.6" ry="2.6" fill="#ff6b9a" opacity=".5"/>`;
const smile = (x, y, w = 5) => `<path d="M${x - w} ${y} Q${x} ${y + w} ${x + w} ${y}" fill="none" ${S(2.6)}/>`;
const sparkle = (x, y, k = 1) =>
  `<path transform="translate(${x} ${y}) scale(${k})" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#fff" stroke="#8A5CFF" stroke-width="1.3" stroke-linejoin="round"/>`;
const starPath = (cx, cy, R, r, rot = -90) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
};
const goldStar = (x, y, R = 6) => `<path d="${starPath(x, y, R, R * 0.45)}" fill="#FFD43B" ${S(1.8)}/>`;
const crown = (x, y, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-12 6 L-10 -7 L-4.5 -1 L0 -10 L4.5 -1 L10 -7 L12 6 Z" fill="${FAM_COLOR.rich}" ${S(2.4)}/><circle cx="0" cy="1.5" r="2.4" fill="#ff5d7a" ${S(1.2)}/></g>`;
const note = (x, y, c = '#FF6FA8', k = 1) =>
  `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0 V-12 L8 -14 V-3" fill="none" ${S(2.2)}/><ellipse cx="-2.6" cy="0.5" rx="3.6" ry="2.8" fill="${c}" ${S(1.8)}/><ellipse cx="5.4" cy="-2.5" rx="3.6" ry="2.8" fill="${c}" ${S(1.8)}/></g>`;

function pedestal(role) {
  const c = ROLE_COLOR[role];
  const ns = `vector-effect="non-scaling-stroke"`;
  const pat = {
    knight: `<path d="M-16 -18 H16 V0 C16 11 7 17 0 20 C-7 17 -16 11 -16 0 Z" fill="${c}" opacity=".55" stroke="${c}" stroke-width="2" ${ns}/>`,
    ninja: `<path d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6 Z" fill="${c}" opacity=".6"/>`,
    hunter: `<circle r="32" fill="none" stroke="${c}" stroke-width="2.4" ${ns}/><circle r="20" fill="none" stroke="${c}" stroke-width="2.4" ${ns}/><circle r="8" fill="${c}"/>`,
    mage: `<circle r="34" fill="none" stroke="${c}" stroke-width="2" ${ns}/><circle r="27" fill="none" stroke="${c}" stroke-width="1.4" ${ns}/><path d="${starPath(0, 0, 27, 10.3)}" fill="none" stroke="${c}" stroke-width="1.6" ${ns}/>`,
    singer: `<circle r="10" fill="${c}" opacity=".7"/><circle r="20" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 5" ${ns}/><circle r="31" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 6" ${ns}/>`,
    healer: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="0" cy="-20" rx="6" ry="11" fill="${c}" opacity=".6" transform="rotate(${a})"/>`).join('') + `<circle r="7" fill="#fff" opacity=".8"/>`,
  }[role];
  return `<ellipse cx="60" cy="104" rx="43" ry="10.5" fill="#2B2163" stroke="${INK}" stroke-width="2.5"/>
    <g transform="translate(60 104) scale(1 0.26)">${pat}</g>
    <ellipse cx="60" cy="104" rx="43" ry="10.5" fill="none" stroke="${c}" stroke-width="1.6" opacity=".9"/>`;
}

// ---------- 캐릭터 ----------
let uid = 0;
const CH = {};

// 4 거부기 · 네모 등껍질 거북 기사 — 배 껍질이 2×2 = 4칸
CH[4] = {
  role: 'knight', name: '거부기', title: '네모 등껍질 거북 기사', cost: 1, hide: '배 껍질 네모 4칸(2×2)',
  sparkles: [[46, 70], [74, 86], [52, 24]], crown: [60, 12, 0],
  draw() {
    const skin = '#9BE07F';
    return `
    <rect x="25" y="44" width="70" height="58" rx="18" fill="#4F8F4A" ${S(3)}/>
    <path d="M30 56 L25 62 M90 56 L95 62 M30 88 L25 82 M90 88 L95 82" stroke="${INK}" stroke-width="2"/>
    <ellipse cx="46" cy="103" rx="9.5" ry="5" fill="${skin}" ${S(2.6)}/><ellipse cx="74" cy="103" rx="9.5" ry="5" fill="${skin}" ${S(2.6)}/>
    <rect x="35" y="50" width="50" height="50" rx="15" fill="${skin}" ${S(3)}/>
    <rect x="41" y="57" width="38" height="38" rx="8" fill="#F6E7A6" ${S(2.4)}/>
    <path d="M60 57 V95 M41 76 H79" stroke="${INK}" stroke-width="2.4"/>
    <path d="M91 62 L99 28 L103.5 29 L96 63 Z" fill="#E8EEF6" ${S(2.2)}/>
    <path d="M85 62 L103 66" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M85 62 L103 66" stroke="#E2B53E" stroke-width="3.6" stroke-linecap="round"/>
    <ellipse cx="91" cy="68" rx="7" ry="6" fill="${skin}" ${S(2.6)}/>
    <circle cx="60" cy="36" r="19" fill="${skin}" ${S(3)}/>
    <path d="M40 34 C40 12, 80 12, 80 34 Z" fill="#B9C7DC" ${S(3)}/>
    <rect x="37" y="31" width="46" height="7" rx="3.5" fill="#8FA2C2" ${S(2.4)}/>
    <path d="M60 16 V31" stroke="${INK}" stroke-width="2"/><circle cx="48" cy="25" r="1.6" fill="${INK}"/><circle cx="72" cy="25" r="1.6" fill="${INK}"/>
    <path d="M60 17 C 57 5, 70 0, 78 4 C 71 7, 66 11, 62 18 Z" fill="#FF5D6C" ${S(2.4)}/>
    ${eyes(52, 68, 45)}${blush(45, 75, 51)}${smile(60, 51, 4)}
    <path d="M11 56 H41 V74 C41 88, 31 96, 26 100 C21 96, 11 88, 11 74 Z" fill="#B9C7DC" ${S(3)}/>
    <path d="M16 61 H36 V74 C36 85, 29 91, 26 94 C23 91, 16 85, 16 74 Z" fill="none" stroke="#E2B53E" stroke-width="2.6"/>
    <rect x="20" y="66" width="12" height="12" rx="2" fill="#4F8F4A" ${S(1.8)}/><path d="M26 66 V78 M20 72 H32" stroke="${INK}" stroke-width="1.6"/>`;
  },
};

// 8 먹물이 · 여덟 다리 문어 닌자 — 다리 8개
CH[8] = {
  role: 'ninja', name: '먹물이', title: '여덟 다리 문어 닌자', cost: 2, hide: '다리 8개',
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
      cups += `<circle cx="${(ex - c * 1).toFixed(1)}" cy="${ey - 6}" r="1.5" fill="#FFD3DF"/>`;
    }
    return `${legsO}${legsF}${cups}
    <path d="M28 68 C 24 34, 42 15, 60 15 C 78 15, 96 34, 92 68 C 80 77, 40 77, 28 68 Z" fill="${skin}" ${S(3)}/>
    <ellipse cx="44" cy="27" rx="8" ry="4.5" fill="#fff" opacity=".45" transform="rotate(-30 44 27)"/>
    <path d="M91 39 C 101 33, 108 40, 116 34 C 113 44, 103 47, 92 46 Z" fill="#F0506E" ${S(2.2)}/>
    <path d="M91 44 C 100 46, 104 54, 112 54 C 106 60, 97 56, 91 50 Z" fill="#F0506E" ${S(2.2)}/>
    <path d="M27 38 C 45 30, 75 30, 93 38 L93 47 C75 40, 45 40, 27 47 Z" fill="#3A3F6B" ${S(2.4)}/>
    <rect x="53" y="33" width="14" height="7" rx="2" fill="#C5D3E8" ${S(1.6)}/>
    ${eyes(49, 71, 51, 'norm', 0.9)}
    <path d="M33 57 C 50 53, 70 53, 87 57 C 87 67, 78 73, 60 73 C 42 73, 33 67, 33 57 Z" fill="#3A3F6B" ${S(2.4)}/>
    <path d="M44 63 Q 50 66 56 63 M64 63 Q 70 66 76 63" stroke="#5A609A" stroke-width="1.6" fill="none"/>
    <g transform="translate(103 18) rotate(20)"><path d="M0 -10 L2.8 -2.8 L10 0 L2.8 2.8 L0 10 L-2.8 2.8 L-10 0 L-2.8 -2.8 Z" fill="#DCE3EE" ${S(2)}/><circle r="2.2" fill="${INK}"/></g>
    <path d="M86 12 L94 15 M84 20 L92 21" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  },
};

// 7 칠색이 · 무지개 고양이 궁수 — 꼬리 무지개 7색
CH[7] = {
  role: 'hunter', name: '칠색이', title: '무지개 고양이 헌터', cost: 1, hide: '꼬리 무지개 7색',
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
    <ellipse cx="49" cy="103" rx="8" ry="4.6" fill="${fur}" ${S(2.4)}/><ellipse cx="67" cy="103" rx="8" ry="4.6" fill="${fur}" ${S(2.4)}/>
    <ellipse cx="58" cy="86" rx="20" ry="17" fill="${fur}" ${S(3)}/>
    <ellipse cx="58" cy="89" rx="10" ry="9" fill="#fff" opacity=".9"/>
    <path d="M36 38 L33 10 L55 25 Z" fill="${fur}" ${S(3)}/><path d="M39 33 L37.5 17 L50 26 Z" fill="#FFB3C7"/>
    <path d="M80 38 L83 10 L61 25 Z" fill="${fur}" ${S(3)}/><path d="M77 33 L78.5 17 L66 26 Z" fill="#FFB3C7"/>
    <ellipse cx="58" cy="46" rx="27" ry="22" fill="${fur}" ${S(3)}/>
    <path d="M42 28 C 45 15, 70 12, 76 24 L 84 27 C 68 21, 54 21, 42 28 Z" fill="#B8763E" ${S(2.6)}/>
    <path d="M70 19 C 82 7, 96 5, 102 2 C 96 11, 86 18, 73 22 Z" fill="#FF5D6C" ${S(2.2)}/>
    ${eyes(48, 68, 47, 'cool', 1, fur)}${blush(40, 76, 55)}
    <path d="M52 55 Q55 58.5 58 55 Q61 58.5 64 55" fill="none" ${S(2.4)}/>
    <path d="M30 51 L40 53 M30 57 L40 56 M86 51 L76 53 M86 57 L76 56" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M22 50 C 6 64, 6 90, 22 104" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M22 50 C 6 64, 6 90, 22 104" fill="none" stroke="#B8763E" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M22 50 L22 104" stroke="${INK}" stroke-width="1.3"/>
    <path d="M44 77 L4 77" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M9 72 L3 77 L9 82" fill="none" ${S(2.4)}/>
    <path d="M44 77 L50 73 M44 77 L50 81" stroke="#FF5D6C" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="40" cy="78" rx="6" ry="5.4" fill="${fur}" ${S(2.4)}/>`;
  },
};

// 9 여우비 · 아홉 꼬리 구미호 마법사 — 꼬리 9개
CH[9] = {
  role: 'mage', name: '여우비', title: '아홉 꼬리 구미호', cost: 2, hide: '꼬리 9개',
  sparkles: [[44, 48], [76, 46], [60, 88]], crown: [50, 30, -14],
  draw() {
    const fur = '#FF9B4A';
    const tid = `tail${uid++}`;
    const shape = 'M0 0 C -17 -10, -19 -38, -3 -58 C 2 -52, 8 -52, 12 -56 C 20 -36, 13 -10, 0 0 Z';
    const angs = [-38, -58, -78, -98, 34, 50, 66, 82, 98];
    const tails = `<defs><clipPath id="${tid}"><path d="${shape}"/></clipPath></defs>` + angs
      .map((a) => `<g transform="translate(60 84) rotate(${a})"><path d="${shape}" fill="${fur}"/><g clip-path="url(#${tid})"><ellipse cx="4" cy="-56" rx="20" ry="15" fill="#FFF8EE"/></g><path d="${shape}" fill="none" ${S(2.6)}/></g>`)
      .join('');
    const flame = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 -10 C 6 -4, 7 3, 0 7 C -7 3, -6 -4, 0 -10 Z" fill="#7FE7FF" ${S(1.8)}/><path d="M0 -3 C 2 0, 2 3, 0 4 C -2 3, -2 0, 0 -3 Z" fill="#fff"/></g>`;
    return `${tails}
    <ellipse cx="52" cy="103" rx="7" ry="4.4" fill="${fur}" ${S(2.4)}/><ellipse cx="68" cy="103" rx="7" ry="4.4" fill="${fur}" ${S(2.4)}/>
    <ellipse cx="60" cy="88" rx="17" ry="15" fill="${fur}" ${S(3)}/><ellipse cx="60" cy="91" rx="9" ry="9" fill="#FFF4E6"/>
    <path d="M41 42 L35 12 L57 30 Z" fill="${fur}" ${S(3)}/><path d="M37.5 22 L35 12 L44 18 Z" fill="${INK}"/>
    <path d="M79 42 L85 12 L63 30 Z" fill="${fur}" ${S(3)}/><path d="M82.5 22 L85 12 L76 18 Z" fill="${INK}"/>
    <ellipse cx="60" cy="52" rx="24" ry="20" fill="${fur}" ${S(3)}/>
    <path d="M42 57 C 49 70, 71 70, 78 57 C 70 52, 50 52, 42 57 Z" fill="#FFF4E6"/>
    <ellipse cx="60" cy="58" rx="3" ry="2.2" fill="${INK}"/>
    ${eyes(50, 70, 50, 'norm', 0.95)}${blush(42, 78, 59)}
    <path d="M56 62 Q60 65 64 62" fill="none" ${S(2.2)}/>
    <ellipse cx="60" cy="34" rx="25" ry="6" fill="#4B3FA8" ${S(2.6)}/>
    <path d="M44 33 C 50 21, 55 6, 74 -4 C 68 9, 71 22, 77 33 C 66 36, 54 36, 44 33 Z" fill="#4B3FA8" ${S(2.6)}/>
    <path d="M47 28 C 58 31, 66 31, 75 27" stroke="#FFD43B" stroke-width="3" fill="none"/>
    ${goldStar(62, 16, 4.6)}<circle cx="70" cy="6" r="1.6" fill="#FFD43B"/>
    <path d="M80 86 L98 58" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M80 86 L98 58" stroke="#B8763E" stroke-width="2.8" stroke-linecap="round"/>
    ${goldStar(99, 55, 8)}
    <ellipse cx="79" cy="86" rx="6" ry="5.4" fill="${fur}" ${S(2.4)}/>
    ${flame(16, 26)}${flame(108, 34)}`;
  },
};

// 17 맴순이 · 17년 매미 싱어
CH[17] = {
  role: 'singer', name: '맴순이', title: '17년 매미 싱어', cost: 3, hide: '땅속에서 17년(단단한 수)',
  sparkles: [[18, 60], [102, 60], [52, 92]], crown: [60, 18, 0],
  draw() {
    const g = '#A4E36A';
    const wing = (m) => `<g transform="${m}"><path d="M48 58 C 30 40, 6 44, 4 64 C 8 84, 34 88, 50 72 Z" fill="#DDF6FF" opacity=".85" ${S(2.6)}/><path d="M46 62 C 32 58, 18 60, 8 66 M44 66 C 32 70, 20 76, 14 80 M36 60 L30 76 M24 58 L22 80" stroke="#7FB8D6" stroke-width="1.5" fill="none"/></g>`;
    return `${wing('')}${wing('translate(120 0) scale(-1 1)')}
    <ellipse cx="51" cy="103" rx="7" ry="4.4" fill="${g}" ${S(2.4)}/><ellipse cx="69" cy="103" rx="7" ry="4.4" fill="${g}" ${S(2.4)}/>
    <ellipse cx="60" cy="80" rx="18" ry="22" fill="${g}" ${S(3)}/>
    <path d="M44 84 Q60 89 76 84 M45 92 Q60 97 75 92" stroke="#5FA83A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M34 42 C 34 14, 86 14, 86 42" fill="none" stroke="${INK}" stroke-width="8.5" stroke-linecap="round"/>
    <path d="M34 42 C 34 14, 86 14, 86 42" fill="none" stroke="#FF6FA8" stroke-width="4.5" stroke-linecap="round"/>
    <ellipse cx="60" cy="47" rx="26" ry="19" fill="${g}" ${S(3)}/>
    <ellipse cx="46" cy="36" rx="7" ry="3.8" fill="#fff" opacity=".45" transform="rotate(-25 46 36)"/>
    <rect x="25" y="36" width="12" height="18" rx="5" fill="#FF6FA8" ${S(2.6)}/><rect x="83" y="36" width="12" height="18" rx="5" fill="#FF6FA8" ${S(2.6)}/>
    ${eyes(49, 71, 45, 'happy')}${blush(44, 76, 52)}
    <ellipse cx="60" cy="56" rx="4.4" ry="5" fill="#7a1035" ${S(2.2)}/>
    <path d="M74 82 L86 66" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M74 82 L86 66" stroke="#59607A" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="88" cy="62" r="7" fill="#DCE3EE" ${S(2.4)}/><path d="M84 59 L92 65 M84 65 L92 59" stroke="#9AA6BC" stroke-width="1.4"/>
    <ellipse cx="74" cy="83" rx="6" ry="5.4" fill="${g}" ${S(2.4)}/>
    ${note(104, 30, '#FF6FA8')}${note(14, 28, '#FF6FA8', 0.8)}`;
  },
};

// 6 붕붕이 · 꿀벌 간호사 — 꿀단지 육각형, 다리 6개
CH[6] = {
  role: 'healer', name: '붕붕이', title: '꿀벌 간호사', cost: 1, hide: '꿀단지 육각형 · 다리 6개',
  sparkles: [[44, 64], [78, 62], [60, 92]], crown: [60, 26, 0],
  draw() {
    const y = '#FFD34D';
    const id = `bee${uid++}`;
    const hex = (cx, cy, r) => [0, 60, 120, 180, 240, 300].map((a, i) => `${i ? 'L' : 'M'}${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`).join(' ') + ' Z';
    return `
    <ellipse cx="38" cy="44" rx="14" ry="9" fill="#E8F7FF" opacity=".9" transform="rotate(-35 38 44)" ${S(2.4)}/>
    <ellipse cx="82" cy="44" rx="14" ry="9" fill="#E8F7FF" opacity=".9" transform="rotate(35 82 44)" ${S(2.4)}/>
    <path d="M50 34 C 46 26, 42 22, 40 16 M70 34 C 74 26, 78 22, 80 16" fill="none" ${S(2.4)}/>
    <circle cx="40" cy="15" r="3.6" fill="${INK}"/><circle cx="80" cy="15" r="3.6" fill="${INK}"/>
    <ellipse cx="51" cy="103" rx="6.4" ry="4" fill="#2B2350" ${S(2)}/><ellipse cx="69" cy="103" rx="6.4" ry="4" fill="#2B2350" ${S(2)}/>
    <ellipse cx="29" cy="70" rx="5" ry="3.6" fill="#2B2350" transform="rotate(-30 29 70)"/><ellipse cx="91" cy="70" rx="5" ry="3.6" fill="#2B2350" transform="rotate(30 91 70)"/>
    <defs><clipPath id="${id}"><ellipse cx="60" cy="68" rx="29" ry="31"/></clipPath></defs>
    <ellipse cx="60" cy="68" rx="29" ry="31" fill="${y}"/>
    <g clip-path="url(#${id})"><rect x="20" y="76" width="80" height="7" fill="#2B2350"/><rect x="20" y="90" width="80" height="7" fill="#2B2350"/></g>
    <ellipse cx="60" cy="68" rx="29" ry="31" fill="none" ${S(3)}/>
    <ellipse cx="46" cy="50" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-30 46 50)"/>
    <path d="M44 41 L46 28 H74 L76 41 C 66 38, 54 38, 44 41 Z" fill="#fff" ${S(2.6)}/>
    <path d="M60 39 C 55 35, 54 31, 57 30 C 59 29.5, 60 31, 60 32 C 60 31, 61 29.5, 63 30 C 66 31, 65 35, 60 39 Z" fill="#FF6F91" stroke="${INK}" stroke-width="1.3"/>
    ${eyes(50, 70, 57)}${blush(43, 77, 64)}${smile(60, 65, 4)}
    <path d="${hex(22, 86, 13)}" fill="#FFB321" ${S(2.6)}/>
    <path d="M13 79 Q 16 84 18 79 Q 20 86 23 79 Q 26 83 30 79" fill="#FFDD7A" stroke="none"/>
    <path d="M18 86 H26 M16 91 H28" stroke="#C97A00" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="32" cy="82" rx="5.4" ry="4.8" fill="${y}" ${S(2.4)}/>
    <path d="M90 78 L104 60" stroke="${INK}" stroke-width="5.6" stroke-linecap="round"/><path d="M90 78 L104 60" stroke="#C98B4E" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="105" cy="57" rx="6" ry="7.5" fill="#FFB321" transform="rotate(38 105 57)" ${S(2.2)}/>
    <ellipse cx="88" cy="80" rx="5.4" ry="4.8" fill="${y}" ${S(2.4)}/>`;
  },
};

// 5 오롱이 · 불가사리 마법사 — 팔 5개
CH[5] = {
  role: 'mage', name: '오롱이', title: '불가사리 마법사', cost: 1, hide: '팔 5개',
  sparkles: [[38, 76], [84, 74], [72, 40]], crown: [60, 16, 0],
  draw() {
    const c = '#FF8A70';
    const star = starPath(60, 64, 46, 25);
    let dots = '';
    for (let i = 0; i < 5; i++) {
      const a = ((-90 + i * 72) * Math.PI) / 180;
      for (const k of [30, 38]) dots += `<circle cx="${(60 + k * Math.cos(a)).toFixed(1)}" cy="${(64 + k * Math.sin(a)).toFixed(1)}" r="2.1" fill="#FFD1C2"/>`;
    }
    return `
    <path d="${star}" fill="${INK}" stroke="${INK}" stroke-width="16" stroke-linejoin="round"/>
    <path d="${star}" fill="${c}" stroke="${c}" stroke-width="10" stroke-linejoin="round"/>
    ${dots}
    ${eyes(51, 69, 61)}${blush(45, 75, 69)}${smile(60, 69, 4.5)}
    <ellipse cx="60" cy="23" rx="15" ry="4.4" fill="#4B3FA8" ${S(2.4)}/>
    <path d="M49 22 C 54 12, 60 2, 76 -6 C 70 5, 70 14, 71 22 C 64 25, 55 25, 49 22 Z" fill="#4B3FA8" ${S(2.4)}/>
    ${goldStar(61, 13, 4)}
    <path d="M104 50 L114 30" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M104 50 L114 30" stroke="#B8763E" stroke-width="2.8" stroke-linecap="round"/>
    ${goldStar(115, 27, 7.5)}`;
  },
};

// 36 서른여섯 · 황금 보물 용 — 배 비늘 6×6 = 36
CH[36] = {
  role: 'mage', name: '서른여섯', title: '황금 보물 용', cost: 5, hide: '배 비늘 6×6 = 36개',
  sparkles: [[44, 36], [78, 34], [60, 70]], crown: [60, 21, 0],
  draw() {
    const gd = '#FFC23F', belly = '#FFF1B8';
    const gid = `glow${uid++}`;
    const rays = `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="#FFE27A" stop-opacity=".75"/><stop offset=".6" stop-color="#FFC23F" stop-opacity=".25"/><stop offset="1" stop-color="#FFC23F" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="58" r="64" fill="url(#${gid})"/>`;
    let scales = '';
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) scales += `<circle cx="${(49 + c * 4.4).toFixed(1)}" cy="${(71 + r * 4.4).toFixed(1)}" r="1.5" fill="#E39A12"/>`;
    const wing = (m) => `<path transform="${m}" d="M42 58 C 28 34, 8 36, 4 52 C 12 52, 16 58, 17 64 C 24 58, 30 60, 34 67 C 36 62, 40 62, 44 66 Z" fill="#FF8A3D" ${S(2.6)}/>`;
    const coin = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.4" fill="#FFD43B" ${S(1.8)}/>`;
    return `${rays}
    ${wing('')}${wing('translate(120 0) scale(-1 1)')}
    <path d="M78 92 C 102 98, 112 80, 104 66" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    <path d="M78 92 C 102 98, 112 80, 104 66" fill="none" stroke="${gd}" stroke-width="7" stroke-linecap="round"/>
    <path d="M104 68 L97 60 L104 52 L111 60 Z" fill="#FF8A3D" ${S(2.2)}/>
    <ellipse cx="46" cy="103" rx="9" ry="5" fill="${gd}" ${S(2.4)}/><ellipse cx="74" cy="103" rx="9" ry="5" fill="${gd}" ${S(2.4)}/>
    <ellipse cx="60" cy="80" rx="26" ry="24" fill="${gd}" ${S(3)}/>
    <ellipse cx="60" cy="82" rx="18.5" ry="18.5" fill="${belly}" ${S(2.4)}/>
    ${scales}
    <path d="M43 30 C 36 20, 36 10, 40 3 C 45 11, 49 18, 51 25 Z" fill="#FFF6DA" ${S(2.4)}/>
    <path d="M77 30 C 84 20, 84 10, 80 3 C 75 11, 71 18, 69 25 Z" fill="#FFF6DA" ${S(2.4)}/>
    <ellipse cx="60" cy="43" rx="25" ry="21" fill="${gd}" ${S(3)}/>
    <ellipse cx="47" cy="32" rx="7" ry="3.8" fill="#fff" opacity=".5" transform="rotate(-25 47 32)"/>
    <ellipse cx="60" cy="54" rx="13" ry="8" fill="${belly}" ${S(2.2)}/>
    <ellipse cx="56" cy="53" rx="1.6" ry="2.2" fill="${INK}"/><ellipse cx="64" cy="53" rx="1.6" ry="2.2" fill="${INK}"/>
    ${eyes(49, 71, 41)}${blush(40, 80, 48)}
    <path d="M56 58 Q60 61 64 58" fill="none" ${S(2)}/>
    <path d="M22 104 L22 44" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M22 104 L22 44" stroke="#8B5A2B" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="22" cy="37" r="9" fill="#7FE7FF" ${S(2.6)}/><circle cx="19" cy="34" r="3" fill="#fff"/>
    <ellipse cx="34" cy="78" rx="6.4" ry="5.6" fill="${gd}" ${S(2.4)}/>
    ${coin(92, 106)}${coin(100, 103)}${coin(95, 100)}`;
  },
};

export const CHARS = CH;

/**
 * 캐릭터 SVG. char = 누구(모습·직업), num = 지금 숫자(가문 보석·몸빛). 돌로 숫자가 바뀌면 num만 바뀜.
 */
export function drawChar(char, size, num = char) {
  const c = CH[char];
  const fams = families(num);
  let over = '';
  if (fams.includes('prime')) over += c.sparkles.map(([x, y], i) => sparkle(x, y, i === 0 ? 1.15 : 0.9)).join('');
  if (fams.includes('rich')) over += crown(...c.crown);
  const gems = fams.map((f, i) => `<g transform="translate(-2 ${-4 + i * 15}) scale(.62)"><circle cx="12" cy="12" r="12" fill="#1d1440" opacity=".55"/>${famShape(f)}</g>`).join('');
  const fs = String(num).length === 1 ? 24 : 21;
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 122" style="overflow:visible">
    ${pedestal(c.role)}
    ${c.draw()}
    ${over}
    ${gems}
    <text x="60" y="121" text-anchor="middle" font-family="Jua, sans-serif" font-size="${fs}" fill="#fff" stroke="${INK}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">${num}</text>
  </svg>`;
}
