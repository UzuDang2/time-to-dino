# game-director 메모리

타임투다이노(time-to-dino)의 디렉터(나 / 이 프로젝트를 맡은 Claude 인스턴스)가 세션을 넘어 유지해야 하는
상태·결정·근거를 보관하는 디렉토리. **이곳은 디렉터 개인 메모리이며 git에 올라가지 않는다**
(`/.gitignore`에 `.claude/`가 이미 있음).

## 호출 루틴 (세션 시작 시 내가 해야 할 일)

1. 이 README 먼저 읽는다.
2. `project-state.md` — 코드·데이터·Notion·시트의 현재 상태 팩트. 늘 이게 "실물"이라고 가정하지 말고,
   의심스러우면 실물을 다시 읽는다 (특히 `data/items.json`, `data/data.js`의 최종 수정 시각).
3. `design-decisions.md` — 왜 지금 이런 구조인지. 요한이 의사결정한 근거. 이걸 읽어야 내가 과거의 나와 싸우지 않는다.
4. `pending.md` — 남은 과제와 대기 중인 요한 수동 작업. 뭘 다음에 할 수 있는지 결정하는 기준.

> 💡 **Shortcut**: `ttd-brief` 스킬이 위 4파일 로드 + git status 확인을 한 번에 해준다. 매번 Read·Bash 개별 호출 대신 `Skill(ttd-brief)` 호출.

작업 끝나면:
- 상태가 바뀌면 `project-state.md` 갱신.
- 설계 결정이 추가·변경되면 `design-decisions.md`에 append (삭제하지 말고 취소선 or "SUPERSEDED" 표기).
- 과제 완료/추가는 `pending.md` 갱신.

## 반복 작업용 스킬

아래 3개 스킬은 `.claude/skills/`에 정의되어 있고 `Skill` tool로 호출한다. 매번 절차 외우지 말고 이 스킬을 호출해서 토큰 절약.

| 스킬 | 언제 | 대체되는 수작업 |
|---|---|---|
| **`ttd-brief`** | 세션 시작 / 컨텍스트 복원 | 메모리 4파일 개별 Read + git 확인 (5~8 tool calls) |
| **`ttd-make-data`** | 시트·Notion 변경 후 / `data/*.json` 재생성 | `cd` + `make data` + 출력 판독 (3~4 tool calls) |
| **`ttd-commit-push`** | 이터레이션 완료 시 | status 확인 + add + 커밋 템플릿 + push (5+ tool calls) |

## 원칙

- **SSOT는 시트(수치) + Notion 아이템 DB**. 코드의 하드코딩은 전부 임시다. 수정 시 항상 "이걸 시트에 옮길 수 있는가"를 먼저 본다.
- **문자열 DSL 우선**. 컬럼 폭발을 피하고 파서를 쓴다 (`effectParser.js` / `scripts/fetch_data.py`).
- **보스 = 공포**. 전투를 자주 일어나게 만드는 변경에는 브레이크를 건다.
- **텍스트 1인칭 오감**. 시스템 메시지는 건조하게 쓰지 않는다 — "발견했다" 같은 완료형 한국어 내레이션 톤 유지.
- **기존 파일 편집 > 신규 파일**. 구조 리팩터링은 요한 확인 후.
- **파괴적 변경 금지 (자동 모드라도)**. 데이터·시트·Notion 삭제는 절대 자율로 하지 않는다.

## 파일 책임 분담

| 파일 | 담는 것 | 담지 않는 것 |
|---|---|---|
| `README.md` (이 파일) | 메모리 사용법·원칙·인덱스 | 구체 팩트·과제 |
| `project-state.md` | "지금 코드·데이터가 어떤 상태인가"의 스냅샷 | 왜 그런지, 뭐 할지 |
| `design-decisions.md` | 의사결정·근거·번복된 결정의 이력 | 현재 상태의 팩트, TODO |
| `pending.md` | 할 일, 대기 중인 수동 작업, 후보 이터레이션 | 원인·근거 |
