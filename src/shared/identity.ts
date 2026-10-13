// 학교 / 닉네임 / 비밀번호 규칙 (브라우저와 서버가 함께 사용). 구구팡·구구단 디펜스와 같은 방식.
import { hasProfanity } from './profanity';

const strip = (s: unknown) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>"'`\\]/g, '');

export function normalizeNick(s: unknown): string {
  return strip(s).replace(/\s+/g, ' ').trim().slice(0, 10);
}

export function normalizeSchoolCode(s: unknown): string {
  const v = String(s == null ? '' : s).trim();
  return /^[0-9A-Za-z]{4,12}$/.test(v) ? v : '';
}

/** 닉네임에 문제가 있으면 안내 문장, 없으면 null */
export function nickError(nick: unknown): string | null {
  const v = normalizeNick(nick);
  if (v.length < 2) return '닉네임은 2글자 이상 적어 주세요.';
  if (hasProfanity(v)) return '사용할 수 없는 말이 들어 있어요. 다른 닉네임을 적어 주세요.';
  return null;
}

/** 학교(검색해서 고른 학교 코드)와 닉네임 확인 */
export function identityError({ schoolCode, nick }: { schoolCode: unknown; nick: unknown }): string | null {
  if (!normalizeSchoolCode(schoolCode)) return '학교를 검색해서 골라 주세요.';
  return nickError(nick);
}

export const pinOk = (pin: unknown) => /^\d{4}$/.test(String(pin ?? ''));
