// 전국 초등학교 목록 불러오기 + 검색 (브라우저와 서버가 함께 사용). 구구팡(newgame)의 schools.js와 같은 규칙.
// 목록 파일: public/data/schools.json (구구팡 scripts/update-schools.mjs 로 만든 NEIS 목록, 학교 코드가 같음)
// 형식: { updated, source, schools: [[학교코드, 학교명, 시도, 시군구], ...] }

export const SCHOOLS_PATH = '/data/schools.json';

export interface School {
  code: string;
  name: string;
  sido: string;
  addr: string;
  base: string;
}
export interface SchoolIndex {
  list: School[];
  byCode: Map<string, School>;
  updated?: string;
}

// 통합 전 이름으로 저장된 시도를 지금 이름으로(표시만, 코드는 그대로)
const SIDO_RENAMED: Record<string, string> = { 광주: '전남광주', 전남: '전남광주' };
export const currentSido = (sido: string) => SIDO_RENAMED[sido] || sido;

/** "송우초등학교" → "송우" */
export const baseName = (name: string) => String(name || '').replace(/\s+/g, '').replace(/(초등학교|초교|초)$/, '');
export const shortSchool = (name: string) => String(name || '').replace(/초등학교$/, '초');
export const placeOf = (s: Pick<School, 'sido' | 'addr'>) => [s.sido, s.addr].filter(Boolean).join(' ');

export function indexSchools(data: { schools?: [string, string, string, string][]; updated?: string } | null): SchoolIndex {
  const list: School[] = [];
  const byCode = new Map<string, School>();
  for (const row of data?.schools ?? []) {
    const [code, name, sido, addr] = row;
    if (!code || !name) continue;
    const s: School = { code: String(code), name, sido: currentSido(sido), addr: addr || '', base: baseName(name) };
    list.push(s);
    byCode.set(s.code, s);
  }
  return { list, byCode, updated: data?.updated };
}

/** "송우", "송우초", "송우 초등학교" 모두 같은 결과 */
export function searchSchools(index: SchoolIndex, query: string, limit = 30): School[] {
  const q = baseName(query);
  if (!q) return [];
  const exact: School[] = [];
  const starts: School[] = [];
  const contains: School[] = [];
  for (const s of index.list) {
    if (s.base === q) exact.push(s);
    else if (s.base.startsWith(q)) starts.push(s);
    else if (s.base.includes(q)) contains.push(s);
    if (exact.length >= limit) break;
  }
  const byPlace = (a: School, b: School) => a.base.localeCompare(b.base, 'ko') || placeOf(a).localeCompare(placeOf(b), 'ko');
  return [...exact.sort(byPlace), ...starts.sort(byPlace), ...contains.sort(byPlace)].slice(0, limit);
}

export function countSameName(index: SchoolIndex, name: string): number {
  let n = 0;
  for (const s of index.list) if (s.name === name) n++;
  return n;
}
