# game5 — 숫자체스: 합창 대작전

초등 5~6학년 '약수와 배수'를 다루는 롤토체스식 숫자 오토배틀러. 지금은 **5주차(튜토리얼 · 처음 보는 순간 말풍선 · 수학 수첩 · 들어가기·기록·친구 유령 · Cloudflare 배포 준비)** 단계입니다.

## 실행

```bash
npm install
npm test             # 단위 테스트(수학표, 노래 값, 결정성·대칭, 합창·다이아·멈춤·분열)
npm run dev          # http://localhost:5173/play.html — 게임(서버 없이 혼자 하기), /dogam.html — 캐릭터 도감, /balance.html — 덱 대 덱 자동 대전
npm run cf:dev       # http://127.0.0.1:8787 — Cloudflare 서버까지(들어가기·기록·친구 유령). 켜 두면 npm run dev 화면에서도 /api가 이어짐
npm run balance      # 밸런스 리포트(터미널). --quick 빠르게, --out design/balance-report.md 저장
npm run battle -- "대합창" "다이아 독창"   # 두 덱의 전투 글자 로그 (--basic 이면 기본 공격도)
npx tsx tools/tune.ts tools/variants.json --mid   # 수치 조정 실험 비교
npx tsx tools/gen-tables.ts > design/수치표.md    # 수치표 다시 만들기
npx tsx tools/ai-sim.ts 80          # 컴퓨터끼리 전체 판: 난이도별 순위, 2인 맞대결, 카드 출전
npx tsx tools/ai-sim.ts 140 --decks # 어려움 4명에게 덱 고정: 실제 경제 속 덱 세기(중반 밸런스)
```

## 배포 (Cloudflare 무료 플랜, 구구팡·구구단 디펜스와 같은 방식)
서버는 Cloudflare **Workers + Durable Objects(SQLite)** 로 동작합니다. (Pages가 아니라 **Workers**로 만들어야 합니다.)

1. Cloudflare 대시보드 → **Workers & Pages** → **Create application**
2. **Import a repository**(GitHub 저장소 가져오기)를 고르고 `game5` 저장소를 선택
3. 프로젝트 이름은 `number-chess` (`wrangler.jsonc`의 name과 같아야 함), 배포 명령은 기본값 `npx wrangler deploy` 그대로 두고 **Deploy**
   - 게임 화면 만들기(`npm run build`)는 `wrangler.jsonc`의 `build.command`로 배포 명령이 알아서 먼저 합니다.
4. 끝나면 `https://number-chess.<내 계정 subdomain>.workers.dev` 주소로 접속합니다.

배포되는 가지(브랜치)는 대시보드의 **Settings → Build → Branch**에서 정합니다(기본 `main`). 지금 작업은 `claude/amazing-dijkstra-uta0a1` 가지에 있으니 `main`에 합치거나 그 가지를 고르세요.
`wrangler.jsonc`에 저장소 설정이 모두 들어 있어서 따로 데이터베이스를 만들 필요가 없습니다.

**무료 한도(하루, 같은 계정의 다른 게임과 함께 씀)에서 숫자체스가 쓰는 양**
- 데이터베이스 쓰기: 들어가기 3~5줄, 한 판 끝 기록 1줄 + 친구 유령 1~2줄, 처음 본 말풍선 1줄. 대략 하루 1만 판 넘게 버팀
- 게임 계산(상점·전투·컴퓨터)은 모두 브라우저에서 해서 서버 시간은 거의 안 씀
- 한도가 차면 들어가기·기록만 멈추고, 혼자 하기는 그대로 됩니다

**들어가기:** 학교(검색해서 고르기, `public/data/schools.json`은 구구팡과 같은 NEIS 목록·학교 코드) + 닉네임 + 숫자 4자리. 비밀번호는 PBKDF2 해시, 10번 틀리면 10분 잠금, 같은 기기는 자동으로 들어가짐(계정당 기기 10개). 계정은 게임마다 따로 저장되지만 규칙은 다른 게임과 같습니다.

## 구조

- `src/engine/` — 게임 엔진(순수 TypeScript, 화면과 분리 → 2단계 Durable Object가 그대로 씀)
  - `math.ts` 수학표(가문, 약수, 분열 짝, 숫자 돌) · `data.ts` 캐릭터·밸런스 수치(**수치의 기준**) · `battle.ts` 결정적 박자 전투 · `log.ts` 글자 로그 · `rng.ts` 시드 난수
- `src/game/` — 한 판의 규칙(상점·카드 풀·경제·레벨·합체·라운드·몬스터·메달·보상)
  - `items.ts` 숫자 돌·보물 끼우기(칸 2개, 두 번째는 6라운드), 지금 숫자, 가문 세기, 미리보기(3줄 + 30박)
  - `bot.ts` 컴퓨터 쉬움(똑딱이)·보통(척척이)·어려움(번뜩이)
- `src/ui/`, `play.html` — 게임 화면(가문·직업 판 늘 펼침, 두 겹 카드, 누르기→누르기 / 끌어 놓기, 상대 판 구경)
  - `art/` 캐릭터 그림(몸 = 캐릭터·숨은 숫자, 옷·무기·받침 = 직업, 보석 = 가문) · `battle-view.ts` 박자 전투 장면(박자 줄, 합창, 말풍선, 다음 합창 예고) · `sound.ts` 숫자 음·화음(Web Audio) · `insight.ts` 결정적 장면·팁·칭찬 배지
  - `dogam.html` 캐릭터 도감(25명의 모습·숨은 숫자·노래)
- `src/game/tutorial.ts` — 튜토리얼 대본(하나쌤 34단계, 고정 상점·몬스터, 퀴즈)
- `src/net/api.ts`, `src/ui/login.ts`, `src/ui/tips.ts` — 서버 연결·들어가기 상자, 처음 보는 순간 말풍선·수학 수첩
- `src/shared/` — 학교 검색·닉네임 규칙·비속어 거르기(브라우저와 서버가 함께, 구구팡과 같은 규칙)
- `worker/index.ts`, `wrangler.jsonc` — Cloudflare 서버(들어가기·기록·도감·친구 유령)
- `src/sim/` — 밸런스 측정(대표 덱 파워 지수, 무작위 덱 필드)
- `src/balance/`, `balance.html` — 브라우저 측정 페이지(Web Worker)
- `tests/` — Vitest
- `tools/` — 밸런스 리포트·전투 로그·조정 실험·수치표 생성 CLI

## 문서

- [최종 기획서](design/숫자체스_최종기획서.md) · [수치표(자동 생성)](design/수치표.md) · [밸런스 리포트](design/balance-report.md)
- [구현용 데이터(설계 단계)](design/numberchess_data.json) — 1주차부터는 `src/engine/data.ts`가 기준
- [화면 목업](design/mockups/) (캐릭터 생김새 시안 포함) · [아이디어 후보안](design/아이디어_후보안.md)
- `design/sim/`, `design/check.py` — 설계 단계 시뮬레이터·검산(기록용, 엔진으로 대체됨)
