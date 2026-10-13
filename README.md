# game5 — 숫자체스: 합창 대작전

초등 5~6학년 '약수와 배수'를 다루는 롤토체스식 숫자 오토배틀러. 지금은 **3주차(캐릭터 그림 25명 · 박자 전투 장면 · 소리 · 상대 판 구경)** 단계입니다.

## 실행

```bash
npm install
npm test             # 단위 테스트(수학표, 노래 값, 결정성·대칭, 합창·단단·멈춤·분열)
npm run dev          # http://localhost:5173/play.html — 게임(컴퓨터와 한 판), /dogam.html — 캐릭터 도감, /balance.html — 덱 대 덱 자동 대전
npm run balance      # 밸런스 리포트(터미널). --quick 빠르게, --out design/balance-report.md 저장
npm run battle -- "대합창" "단단 독창"   # 두 덱의 전투 글자 로그 (--basic 이면 기본 공격도)
npx tsx tools/tune.ts tools/variants.json --mid   # 수치 조정 실험 비교
npx tsx tools/gen-tables.ts > design/수치표.md    # 수치표 다시 만들기
```

## 구조

- `src/engine/` — 게임 엔진(순수 TypeScript, 화면과 분리 → 2단계 Durable Object가 그대로 씀)
  - `math.ts` 수학표(가문, 약수, 분열 짝, 숫자 돌) · `data.ts` 캐릭터·밸런스 수치(**수치의 기준**) · `battle.ts` 결정적 박자 전투 · `log.ts` 글자 로그 · `rng.ts` 시드 난수
- `src/game/` — 한 판의 규칙(상점·카드 풀·경제·레벨·합체·라운드·몬스터·메달·보상) + 임시 컴퓨터(`bot.ts`)
- `src/ui/`, `play.html` — 게임 화면(가문·직업 판 늘 펼침, 두 겹 카드, 누르기→누르기 / 끌어 놓기, 상대 판 구경)
  - `art/` 캐릭터 그림(몸 = 캐릭터·숨은 숫자, 옷·무기·받침 = 직업, 보석 = 가문) · `battle-view.ts` 박자 전투 장면(박자 줄, 합창, 말풍선, 다음 합창 예고) · `sound.ts` 숫자 음·화음(Web Audio) · `insight.ts` 결정적 장면·팁·칭찬 배지
  - `dogam.html` 캐릭터 도감(25명의 모습·숨은 숫자·노래)
- `src/sim/` — 밸런스 측정(대표 덱 파워 지수, 무작위 덱 필드)
- `src/balance/`, `balance.html` — 브라우저 측정 페이지(Web Worker)
- `tests/` — Vitest
- `tools/` — 밸런스 리포트·전투 로그·조정 실험·수치표 생성 CLI

## 문서

- [최종 기획서](design/숫자체스_최종기획서.md) · [수치표(자동 생성)](design/수치표.md) · [밸런스 리포트](design/balance-report.md)
- [구현용 데이터(설계 단계)](design/numberchess_data.json) — 1주차부터는 `src/engine/data.ts`가 기준
- [화면 목업](design/mockups/) (캐릭터 생김새 시안 포함) · [아이디어 후보안](design/아이디어_후보안.md)
- `design/sim/`, `design/check.py` — 설계 단계 시뮬레이터·검산(기록용, 엔진으로 대체됨)
