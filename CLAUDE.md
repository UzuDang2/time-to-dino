# time-to-dino — 프로젝트 가이드

이 파일은 새 세션 시작 시 자동 로드된다. 짧게 유지. 자세한 절차는 `.claude/skills/`에.

## 데이터 SSOT (가장 중요)

- **단일 원본은 Google Sheet** (`scripts/fetch_data.py:9`, ID `1iS4Lmjx32w0Mu527foFtc8pQn3pw6APcQYnvcKdVM9o`). 모든 게임 수치(아이템·무기·사냥감·전투카드·이벤트…)는 이 시트에서만 편집한다.
- 노션의 🎒 아이템 DB / 전투 카드 DB는 **D-30부터 레거시 참조용**. 수치 갱신 대상 아님 — 시트가 우선이다. (노션엔 SSOT 자식 페이지 [📊 게임 데이터(시트)] 임베드 + 레거시 DB에 callout 박혀 있음.)
- 시트 쓰기는 `.secrets/sheets-sa.json`(서비스 계정 키) 필요. 키 없으면 사용자에게 시트 직접 편집 요청, JSON+`data/data.js` 직접 수정은 임시 우회로 다음 `make data` 시 시트→JSON으로 덮어씌워질 수 있음.
- "노션 동기화" 발화가 와도 노션을 마스터 취급 금지. 위 한 줄을 먼저 알리고 의도 재확인.

## 작업 위임 트리 (어느 에이전트에 던질까)

토큰·메인 컨텍스트 절약을 위해 적절한 에이전트로 위임한다.

| 작업 유형 | 위임 대상 | 기준 |
|---|---|---|
| 단순 한두 줄 수정·문구 변경 | **메인 직접** | 위임 오버헤드가 더 큰 경우 |
| 코드베이스 탐색 (어디 있어?) | **Explore 서브** | 3+ 검색 필요할 때만 |
| 거대 리팩터·마이그레이션 (>200줄, schema 변경, 대규모 prop 체인) | **계획봇 → 코드봇** | 메인 컨텍스트에 코드 풀텍스트 누적 방지 |
| TTD 게임 기획·시스템 설계 | **game-director** | 기획서·코드 일치성 점검 |
| 디자인·피그마·UI 토큰 | **피그마 디렉터** | 디자인 파일·메타데이터 조회 |
| 요구사항 모호 | **질문봇** | 위임 전에 요구사항부터 |
| 리뷰 / 회고 | **마무리봇** (회고) / `code-reviewer` 서브 (코드 리뷰) | 세션 종료 신호 시 마무리봇 |

**메인이 직접 하지 말아야 할 신호** — 한 작업이 다음 중 하나라도 해당되면 위임 검토:
- 파일 풀텍스트(>500줄) 여러 번 읽어야 함
- 직렬화·schema 마이그레이션 동반
- 6+ 파일에 걸친 동시 수정
- 한 개의 큰 결정이 여러 개의 후속 결정을 낳는 트리

## 디렉터 메모리 동기화 규칙

`.claude/game-director/{design-decisions.md, pending.md, project-state.md}`는 다음 세션의 컨텍스트 베이스. **stale 상태로 두면 안 된다.**

- 새 D-XX 결정이 생기면 → `design-decisions.md` 끝에 한 단락 append (결정/구현/검증/파일).
- 작업 완료 → `pending.md`에서 해당 항목 이동, 신규 대기 추가.
- 큰 변경 → `project-state.md` 마지막 검증 날짜·요약 갱신.
- 트리거: `ttd-commit-push` 스킬 1.5단계가 블로킹 체크포인트로 강제한다.

## 핵심 경로 (자주 참조)

- 메인 코드: `index.html` (거대 단일 파일, React 인라인)
- 데이터 산출물: `data/*.json`, `data/data.js` (브라우저 번들, AUTO-GENERATED)
- 데이터 파이프라인: `scripts/fetch_data.py`
- 디렉터 메모리: `.claude/game-director/`
- 스킬: `.claude/skills/{ttd-brief, ttd-commit-push, ttd-make-data}`

## 자주 빠지는 함정

- **데이터 변경 후 `make data` 호출 여부**: 시트 변경했으면 호출, JSON 직접 수정만 했으면 호출 X (호출하면 시트→JSON 덮어쓰기로 변경분 손실).
- **`tentBuilt:bool` 잔존**: D-168부터 `tentLevel:0..10`으로 이행. 직렬화 v3는 두 필드 동시 저장으로 호환. 새 코드에선 `tentLevel`만 신뢰.
- **`MAX_HEALTH`/`MAX_HUNGER` 하드코딩 금지**: D-168부터 동적. `getMaxHealth(tentLevel)` / `getMaxHunger(tentLevel)` helper 사용.

## 응답·진행 정책

- 한국어 응답 (사용자 메모리: `feedback_language_locale.md`).
- 자율 진행 (사용자 메모리: `feedback_autonomous_mode.md`) — 결정 묻지 말고 권장안으로 자율 완주, 보고는 결과 한 번.
