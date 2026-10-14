// 받침에 맞는 조사 붙이기: josa('하나쌤', '을/를') → '하나쌤을', josa(12, '와/과')처럼 숫자도 됨(읽는 소리 기준).
// '을(를)'처럼 괄호로 둘 다 적으면 아이들이 읽기 어려워서 만든 도우미.

// 숫자 끝자리 읽는 소리: 영 일 이 삼 사 오 육 칠 팔 구 (10·20…은 '십'이라 받침 있음)
const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];
const DIGIT_RIEUL = [false, true, false, false, false, false, false, true, true, false];

function ending(word: string | number): { batchim: boolean; rieul: boolean } {
  const s = String(word).trim();
  const last = s[s.length - 1] ?? '';
  if (/[0-9]/.test(last)) {
    const d = Number(last);
    return { batchim: DIGIT_BATCHIM[d], rieul: DIGIT_RIEUL[d] };
  }
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return { batchim: false, rieul: false };
  const jong = code % 28;
  return { batchim: jong !== 0, rieul: jong === 8 };
}

/** pair는 '받침 있을 때/없을 때' 순서: '을/를' '이/가' '은/는' '과/와' '으로/로' '이에요/예요' */
export function josa(word: string | number, pair: string): string {
  const [withB, without] = pair.split('/');
  const e = ending(word);
  const pick = pair === '으로/로' && e.rieul ? without : e.batchim ? withB : without;
  return `${word}${pick}`;
}

/** 조사만 */
export const josaOnly = (word: string | number, pair: string) => josa(word, pair).slice(String(word).length);
