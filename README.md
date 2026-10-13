# game5 — 숫자체스: 합창 대작전

초등 5~6학년 '약수와 배수'를 다루는 롤토체스식 숫자 오토배틀러(설계 단계).

- [최종 기획서](design/숫자체스_최종기획서.md) — 규칙, 가문·직업 시너지, 숫자 캐릭터 24명, 숫자 돌, 경제, 튜토리얼, 대기방·멀티, 1단계 제작 범위
- [구현용 데이터](design/numberchess_data.json) — units / families / roles / items / economy 수치
- [화면 목업](design/mockups/) — 방 로비, 준비 단계, 전투 합창 (초기 설계 기준)
- [아이디어 후보안](design/아이디어_후보안.md) — 숫자체스를 고르기 전 비교한 게임 아이디어들
- `design/check.py` — 1~40 수학표로 가문·약수·분열 짝·스킬 수치 검산
- `design/sim/` — 밸런스 조정에 쓴 결정적 전투 시뮬레이터(node). 최종 수치는 `tunedV7.js`
