// 캐릭터 도감: 25명의 모습·직업·가문·숨은 숫자·노래를 한 장에.
import './style.css';
import { ART, charArt, famIcon, roleIcon } from './art/chars';
import { FAM_COLOR, ROLE_COLOR } from './art/parts';
import { FAMILIES, ROLES, UNITS } from '../engine/data';
import { familiesOf } from '../engine/math';
import { songText } from '../engine/describe';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const css = `
.dg { max-width: 1340px; margin: 0 auto; padding: 18px 16px 40px; }
.dg h1 { font-family: Jua; font-size: 34px; margin: 0; }
.dg .lead { color: var(--muted); margin: 4px 0 14px; }
.dg h2 { font-family: Jua; font-size: 22px; margin: 18px 0 8px; color: var(--gold); }
.dg .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.dg .cardx { border: 3px solid var(--cc); border-radius: 18px; background: linear-gradient(180deg, #2c2366, #1b1446); padding: 8px 12px 12px; position: relative; }
.dg .cardx .art { display: grid; place-items: center; height: 170px; }
.dg .nm { font-family: Jua; font-size: 22px; text-align: center; }
.dg .tt { text-align: center; color: var(--muted); font-size: 13px; font-weight: 700; }
.dg .chips { display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; margin: 6px 0; }
.dg .chip { display: inline-flex; align-items: center; gap: 3px; background: #15103a; border-radius: 999px; padding: 2px 9px 2px 5px; font-size: 13px; font-weight: 800; }
.dg .hide { background: rgba(255,212,59,.12); border: 1.5px dashed #FFD43B; border-radius: 10px; padding: 4px 8px; font-size: 13px; color: #FFE58A; font-weight: 700; text-align: center; }
.dg .song { font-size: 12.5px; color: #e6e2ff; margin-top: 6px; line-height: 1.45; }
.dg .line { font-size: 13px; color: #cfc8ff; font-style: italic; text-align: center; margin-top: 4px; }
.dg .cost { position: absolute; right: 12px; top: 8px; font-family: Jua; color: var(--gold); }
.dg .stars { display: flex; gap: 16px; align-items: end; justify-content: center; }
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const card = (n: number) => {
  const u = UNITS[n];
  const fams = familiesOf(n);
  return `<div class="cardx" style="--cc:var(--c${u.cost})"><div class="cost">${u.cost}골드</div>
    <div class="art">${charArt(n, 160)}</div>
    <div class="nm">${n} ${esc(u.name)}</div><div class="tt">${esc(u.title)}</div>
    <div class="chips"><span class="chip" style="color:${ROLE_COLOR[u.role]}">${roleIcon(u.role, 16)}${ROLES[u.role].name}</span>${fams.map((f) => `<span class="chip" style="color:${FAM_COLOR[f]}">${famIcon(f, 16)}${FAMILIES[f].name}</span>`).join('')}</div>
    <div class="hide">숨은 숫자: ${esc(ART[n].hide)}</div>
    <div class="song">♪ ${n}의 배수 박마다: ${esc(songText(u))}</div>
    <div class="line">“${esc(u.line)}”</div></div>`;
};
const nums = Object.keys(UNITS).map(Number).sort((a, b) => UNITS[a].cost - UNITS[b].cost || a - b);
let html = `<div class="dg"><h1>숫자 친구 도감</h1><div class="lead">몸 = 그 캐릭터(숫자가 몸에 숨어 있어요) · 옷·무기·받침 = 직업 · 왼쪽 위 보석 = 가문</div>`;
for (const cost of [1, 2, 3, 4, 5]) {
  html += `<h2>${cost}골드</h2><div class="grid">${nums.filter((n) => UNITS[n].cost === cost).map(card).join('')}</div>`;
}
html += `<h2>별(성) 모습</h2><div class="stars">${[1, 2, 3].map((s) => `<div style="text-align:center">${charArt(4, 90 + s * 10, { star: s as 1 | 2 | 3 })}<div class="jua">${s}성</div></div>`).join('')}</div></div>`;
document.getElementById('app')!.innerHTML = html;
