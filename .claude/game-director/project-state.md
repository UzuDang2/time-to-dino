# project-state.md

마지막 검증: 2026-04-23 (**10th session — 웹 세션, claude.ai/code Linux 샌드박스**, UI 이터레이션 포함).
라운드 1(`a4a5688`): hunt_start 카드 잔존 버그 수정 + 동굴/평원 돌멩이 가중치 70:30 상향.
라운드 2(UI): 토스트 fade-out 0.25s easeOutCirc로 단축, listen 보스 감지 → 공룡 토스트 + 거리별 테두리 색(빨강/노랑/초록), 보스 인접 시 BossJumpscare 연출, 승리 시 [맵 보기] 모드 + moveHistory 기반 방문 순서 번호 + 플로팅 재시작/승리화면 버튼.
변경 파일: `gameStyles.css`, `index.html`, `.claude/game-director/*.md`.
이번 세션은 웹 환경 특성상 Notion MCP 미연결 + `*.notion.site` 방화벽 차단 상태였음. Notion 스펙 조회는 불가했고, repo 내 SSOT(JSON·코드)만으로 작업 완수.
**시트 SSOT 불일치 잔여**: `weights.동굴.env`/`weights.평원.env`는 시트에 없고 JSON에만 있음. 다음 `make data` 시 롤백 위험 — 로컬 Mac 후속(`pending.md` 10차 세션 블록 참조).

9th session — D-43~D-55 범위(사냥감 전투 1단계 포함)는 main에 병합돼있으나 이 파일에는 직접 요약 누락. 보강은 다음 로컬 세션에서.

8th session — D-39 LootToast 맵 내부 + 불투명 0.8, D-40 find_food 토스트,
D-41 롱프레스/컨텍스트 메뉴 차단, D-42 보스 가시성 분리. 4건 모두 UI/상태 변경만, 시트/드롭 로직 무영향.
`bossVisible` state 도입으로 listen 1칸 → 이동 시 보스 아이콘 자동 은닉(지형 revealed 유지). LootToast 최상위 중복 마운트 제거.
CSS+JS 이중으로 롱프레스 텍스트 선택/컨텍스트 메뉴 차단, input/textarea 예외. 로컬 python 서버 200 응답 확인,
마커 9종 모두 served HTML에서 확인됨. 브라우저 E2E는 요한이 손으로 검증 예정(모바일 롱프레스 특성 필수).

7th session — D-37 HUD 2줄 압축 + D-33~D-36 메모리 기록 보완.
`StatPanel` 3행 → 2행(생명/배고픔/시간 한 줄 + 보스/발각 한 줄). 모바일 `@media (max-width: 480px)` padding 축소.
vw=375 시뮬 검증: row1 24px / row2 26px / 메시지 29px, overflow 없음. 콘솔 에러 0.
D-33(water/fish + weights DSL) / D-34(good 타일 100/80/80) / D-35(반복 뒤져보기 페널티) / D-36(휴식 모달 강조)는
이전 세션 구현 커밋 `4551965`에 포함돼 있으나 메모리 기록이 누락 → 7th 세션에서 design-decisions.md에 소급 append.

6th session — D-31 listen 거리별 내레이션 + D-32 머지 UX 간소화.
`index.html::useCard` listen 분기 4단계(거리 1/2/3/≥4), `InventoryModal::openInfo` 롱프레스+탭 즉시 머지/조합.
브라우저 E2E 5케이스(listen dist 1/2/3/4/5) + 머지(산딸기→딸기모둠) + 조합(식물섬유+질긴줄기→깨끗한 천) PASS. 콘솔 에러 0.
5th session (D-24 머지·조합 통합 시스템) 구현 유지. 요한 UX QA 대기).

## 위치 & 실행

- **프로젝트 루트**: `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino`
  (iCloud Drive. ~/Desktop 아님. 경로에 공백·틸드 포함 → 모든 bash 명령에서 쌍따옴표 필수)
- **런타임**: 바닐라 HTML/JS. package.json 없음. Python 빌드 파이프라인만 존재.
- **로컬 서버**: `.claude/launch.json`에 `python3 -m http.server 8765` 설정됨. 브라우저에서 `localhost:8765`로 테스트.

## 파일 트리 (2026-04-22 기준)

```
time-to-dino/
├─ index.html                 49366B, 1025줄  ← 메인. React(Babel Standalone) 컴포넌트 다 들어있음.
├─ mapGenerator.js            8594B           ← 7x7 hex, 지역 5종, BFS 거리, 보스/탈출구 배치
├─ inventory.js               13332B          ← 테트리스식. static ITEMS에 1단계 5종 + 레거시 공존
├─ boss.js                    4254B
├─ dropTable.js               2484B           ← 하드코딩. TTD_DATA.DROP_TABLE 치환 대기
├─ effectParser.js            4998B           ← DSL 파서. parseItemEffect/applyItemEffect/describeEffect
├─ combatDeck.js              2983B           ← RUNTIME_CARDS.throw, buildCombatDeck, consumeExtraCard
├─ gameComponents.jsx         3158B
├─ gameRenderer.js            4534B
├─ gameStyles.css             3663B
├─ Makefile                                   ← `make data` / `make data-offline`
├─ README.md                                  ← 데이터 파이프라인 사용법
├─ scripts/
│  └─ fetch_data.py          17156B           ← 시트 xlsx → JSON + data.js. Notion items.raw.json 변환 포함
├─ data/                      (gitignored 없음. data/.sheet_cache.xlsx만 ignore)
│  ├─ base_cards.json                         5개 (search/listen/find_food/find_weapon/hide)
│  ├─ extra_cards.json
│  ├─ combat_cards.json                       5개 (punch/throw_stone/stab_weapon/dodge/run_away)
│  ├─ monsters.json                           1개 (벨로시랩터만)
│  ├─ prey.json
│  ├─ buildings.json
│  ├─ items.json              7970B           9개 (ITM-1~9. ITM-1~4 레거시 + ITM-5~9 1단계)
│  ├─ items.raw.json          6320B           Notion MCP 페치 원본. 수동 갱신.
│  ├─ data.js                                  window.TTD_DATA 번들 (AUTO-GENERATED)
│  └─ drop_table.json                          ★수동 추출(하드코딩 스냅샷). 시트 탭 생기면 자동 덮어쓰기.
└─ .claude/
   ├─ launch.json                             static 서버 설정
   └─ game-director/                          ← 여기. 내 메모리.
```

## 데이터 SSOT 매핑

| 영역 | SSOT | 스냅샷 경로 | 최신 커밋? |
|---|---|---|---|
| 카드(베이스) | 시트 `베이스탐험카드` | `data/base_cards.json` | **커밋됨** (2026-04-22) |
| 카드(1차 확정) | 시트 `1차_확정카드` | `data/extra_cards.json` | **커밋됨** (2026-04-22) |
| 전투카드 | 시트 `전투카드` | `data/combat_cards.json` | **커밋됨** (2026-04-22) |
| 몬스터 | 시트 `몬스터` | `data/monsters.json` | **커밋됨** (2026-04-22) |
| 사냥감 | 시트 `사냥감` | `data/prey.json` | **커밋됨** (2026-04-22) |
| 빌딩 | 시트 `빌딩` | `data/buildings.json` | **커밋됨** (2026-04-22) |
| 드롭 확률 | 시트 `드롭테이블` ✅ | `data/drop_table.json` (시트 자동 재생성) | **커밋됨** (2026-04-22, push됨) — 추후 시트 값 변경 시 `make data` 재실행 필요 |
| 드롭 풀 | 시트 `드롭풀` ✅ | `data/drop_table.json` (시트 자동 재생성) | **커밋됨** (2026-04-22, push됨) — 동일 |
| 아이템 | Notion `🎒 아이템` DB | `data/items.raw.json` → `data/items.json` | **커밋됨** (2026-04-22) |

시트: `https://docs.google.com/spreadsheets/d/1iS4Lmjx32w0Mu527foFtc8pQn3pw6APcQYnvcKdVM9o`
Notion 아이템 DB: 데이터소스 `83c97925-dcba-405f-8e9d-83488270028d`, 페이지 `8c76219106854ea58b6817e6d9bd8042`

## Notion 아이템 DB 스키마 (검증 2026-04-22)

SQLite-like 타입:
- **title**: 이름
- **auto_increment**: 아이템 ID (ITM-1, ITM-2, …)
- **select**: 아이템 등급 [1단계/2단계/3단계/(레거시: 일반/희귀/전설)] · 가방칸수 [1x1/2x1 가로/2x1 세로/L자/2x2/3x1] · 카테고리 [재료/소모품/무기/도구/장비/음식/기타] · 재료 타입 [환경재료/음식재료]
- **multi_select**: 나오는 지역 [숲/덤불/평원/시냇물/동굴] · 능력치 (공격력/방어력/명중률/생명력/배고픔/이동력/시야 ±N) · 태그 · 획득 방법
- **number**: 무게/공격력/방어력/명중률/내구도/생명력 회복/배고픔 회복
- **checkbox**: 머지 가능 · 일회용
- **text**: 조합법 · 설명 텍스트 · 효과 요약 · **사용 효과** (DSL)
- **relation**: 재료(자기참조) · 결과물(자기참조)

## 등록된 아이템 9종 (items.json, 2026-04-22 단계 체계 적용)

| ID | 이름 | 등급(=단계) | 머지 | 일회용 | 나오는 지역 | 재료 타입 | 사용 효과 | effect.usable |
|---|---|---|---|---|---|---|---|---|
| ITM-1 | 목재 | 2단계 | ✓ | × | (미지정) | (없음) | (비어있음) | false |
| ITM-2 | 식물 섬유(끈) | 2단계 | ✓ | × | (미지정) | (없음) | (비어있음) | false |
| ITM-3 | 깨끗한 천 | 2단계 | ✓ | × | (미지정) | (없음) | (비어있음) | false |
| ITM-4 | 붕대 | 2단계 | × | ✓ | (미지정) | (없음) | (비어있음) | false |
| ITM-5 | 돌맹이 | 1단계 | ✓ | × | 평원/동굴/시냇물 | 환경재료 | `spawn_card:throw` | **true** |
| ITM-6 | 나뭇가지 | 1단계 | ✓ | × | 숲 | 환경재료 | `미정` | false |
| ITM-7 | 질긴줄기 | 1단계 | ✓ | × | 덤불 | 환경재료 | `미정` | false |
| ITM-8 | 버섯 | 1단계 | × | ✓ | 숲/동굴 | 음식재료 | `hunger+1` | **true** |
| ITM-9 | 산딸기 | 1단계 | × | ✓ | 덤불/평원 | 음식재료 | `hunger+1` | **true** |

- **1단계 (5종)**: 파밍으로 직접 획득. 드롭 풀에 연결됨.
- **2단계 (4종)**: 조합으로만 얻는 파생 재료. 현재 게임 루프에서는 획득 불가(조합 시스템 미구현). D-14 참고.
- Notion 등급 select에는 레거시 옵션 "일반/희귀/전설"이 아직 남아있음(비파괴적 마이그레이션). 현재 9개 아이템 중 어느 것도 레거시 값을 쓰지 않음. 옵션 제거는 요한 확인 대기.

## 코드 연결 현황

### 이미 동작 (end-to-end)
- `index.html` script 로드 순서: `data.js → mapGenerator → inventory → boss → dropTable → effectParser → combatDeck` (20–27줄)
- `mapGenerator.pickWeightedRegion()` → `tile.region` 5종 (숲 28 / 덤불 24 / 평원 24 / 시냇물 12 / 동굴 12)
- 탐험 '뒤져보기' 카드 → `rollTileDrop(region)` → `InventorySystem.ITEMS[item].name`으로 획득 메시지 (index.html ~813)
- 인벤토리 정보창 (`ItemInfoModal`, ~270): `TTD_DATA.ITEMS`에서 이름으로 매칭 → `effect` 파싱 → `describeEffect` 표시 → 사용 버튼 활성/비활성
- 롱프레스(400ms) = 선택/이동/머지 / 짧은 탭 = 정보창 (이유는 `design-decisions.md`)
- 아이템 사용 시 `handleUseItem` (~761): `EffectParser.applyItemEffect` 호출 → `setStat(hunger/health)` / `addThrowCard` / 소비 시 인벤에서 제거

### 부분 연결 (아직 미완)
- `combatExtraCards` state는 존재 (index.html ~661), `addThrowCard`로 누적은 됨. 그러나 **전투 UI 자체가 없음** →
  누적된 throw 카드를 쓸 진입점 없음. `CombatDeck.buildCombatDeck(base, extras)` / `consumeExtraCard`는 정의됐지만 호출되지 않음. (pending.md에 보류 명시.)

### 완료 (이번 이터레이션)
- `dropTable.js` → `window.TTD_DATA.DROP_TABLE.{regions, pool}` 우선 참조. 비어있으면 기존 하드코딩 값 폴백.
  `resolveDropSource()` 함수로 런타임 호출마다 TTD_DATA를 다시 읽기 때문에 `data.js` 늦 로딩에 안전.
  현재 `data/drop_table.json`은 시트 탭이 아직 없어 **수동 스냅샷**(하드코딩 값 그대로). 시트 탭 생성 후 `make data`가 덮어쓰면 런타임 동작은 그대로 유지됨.

### 미연결
- 보스 전투 발생 조건 → 전투 모드 전환 → 전투 UI. 전부 없음.
- 2단계 아이템 (조합으로 상위 재료). 조합법 문자열은 Notion에만 있고 파서 없음.
- 빌딩 시스템 실제 런타임 연결.
- 몬스터 2종 이상 (monsters.json에 벨로시랩터 1종).

## Git 상태 (2026-04-22, 3차 세션 말)

- 브랜치: `main`, origin/main과 **동기화** (요한 명시 승인으로 push 완료).
- 이번 푸시 결과: `bdedceb..f175550  main -> main` (1커밋 → 원격 반영).
- 이번 세션 원격 반영 커밋:
  - `f175550` feat(balance,ui): 탐험 5건 반영 — 카드/아이템 정리 + 지역명 + 이동 발각률
- 누적 origin/main 상태 (최근 → 과거):
  - `f175550` feat(balance,ui): 탐험 5건 반영 (3차 세션 push)
  - `bdedceb` 푸시 (2차 세션 중간)
  - `02c0e01` refactor(items): 등급→단계 통합 + 드롭 테이블 JSON 배선
  - `9761a7c` feat: 아이템 사용 DSL + 전투 카드 임시 풀 + 정보창
  - `55cc183` build: 데이터 파이프라인 인프라
- 워킹 트리 깨끗. `.claude/` .gitignore로 제외 확인.
- ⚠ 시트 탭 추가 후 `make data`로 재생성된 `drop_table.json`은 **값 변화가 없어** 워킹 트리에 diff 없음(수동 스냅샷과 시트 값이 동일). 추후 시트에서 수치 조정 시 diff 발생 → 별도 커밋 사이클.

## QA 대기 (2026-04-22, 요한 측)

- 요한이 `localhost:8765` 로드 후 뒤져보기 카드로 시트 기반 드롭이 정상 작동하는지 검증 예정.
- 검증 범위: (a) 각 지역 타일에서 획득 아이템이 이전과 동일 (b) 파이프라인(시트 → `make data` → 런타임)이 실제로 배선됐음을 확인.
- 디렉터 측 변경 없음. 요한 피드백 후속 처리.

## Notion 스키마 현황 (2026-04-22 재검증)

- `아이템 등급` select 옵션: `["1단계","2단계","3단계"]` 3개. 레거시 "일반/희귀/전설" **완전 제거 확인**.
- `카테고리` select 옵션: `["재료","소모품","무기","도구","장비","음식","기타"]` 건재. Board view `카테고리별` 그룹핑 유효.
- `카테고리별`·`등급별` board view는 **유지 결정(D-16)**. pending.md에서 "삭제" 항목 제거.

## Notion 구 드롭 테이블 DB 상태

- URL/ID: `8b7e1f19c624484c9f3f30685943cc53`
- **2026-04-22 2차 세션: 요한이 수동 삭제 완료.** notion-fetch 재조회 시 `<database ... deleted>` 플래그 확인됨. SSOT 혼선 해소.

## 검증 메모 — 실물 vs 브리핑 차이

| 항목 | 브리핑 | 실물 | 비고 |
|---|---|---|---|
| items.json 아이템 수 | "1단계 5종" | 9종 (ITM-1 ~ 9) | ITM-1~4=2단계, ITM-5~9=1단계로 재정렬(2026-04-22) |
| drop_table.json | "자동 생성되도록 선반영" | 수동 스냅샷 파일 존재 | 시트 탭 추가 후 `make data` 돌리면 자동 덮어쓰기 |
| Notion 드롭 DB (`8b7e1f19c624484c9f3f30685943cc53`) | "폐기 또는 레거시 마킹 대상" | 내가 이번에도 건들지 않음 | 다음 이터레이션에서 요한 확인 후 정리 |
| 커밋 상태 | 요한 "이후 커밋하자" 명시 | 이번 턴에 커밋 진행 | D-13 예외 적용 — 요한 명시 요청 |

## 2026-04-22 5차 세션 변경점 (D-24 머지·조합 통합 시스템)

**요약**: 요한의 통합 시스템 결정(머지 = 파생+공간 압축 / 조합 = 다른 재료 결합 / 하나의 분기)을 구현.
코드·Notion·파이프라인 3단계에 걸쳐 배선. 디렉터가 합리적 기본값으로 Notion 조합 맵 확정, QA 시 요한 변경 가능.

1. **Notion 아이템 DB 업데이트** (디렉터 MCP):
   - ITM-1(목재) 조합법: "나뭇가지 + 나뭇가지 → 목재" (튼튼한 목재 3단계 후순위 제거)
   - ITM-2(식물 섬유) 조합법: "질긴줄기 + 질긴줄기 → 식물 섬유(끈)" / `결과물`=깨끗한 천
   - ITM-3(깨끗한 천) 조합법: "식물 섬유(끈) + 질긴줄기 → 깨끗한 천" / `결과물`=붕대
   - ITM-4(붕대) 조합법: "깨끗한 천 + 식물 섬유(끈) → 붕대" (2재료로 간소화, 약초 제거)
   - ITM-5(돌맹이) `머지 가능`=NO (상위 아이템 없음)
   - ITM-6(나뭇가지) `결과물`=목재
   - ITM-7(질긴줄기) `결과물`=식물 섬유(끈)

2. **`scripts/fetch_data.py` 신규 유틸**:
   - `ITEM_NAME_TO_ID` — 한글↔영문 id 매핑 SSOT (9개 + `"식물 섬유"` 별칭)
   - `parse_combo_recipe(raw)` — `조합법` 텍스트 DSL → `[(ingredients, result)]` 파싱. 괄호 주석·수량 표기 제거.
   - `build_combos_from_items(items)` — 아이템 전체 스캔 후 combos 리스트 평탄화. 미매핑 이름은 경고+스킵.
   - `transform_notion_items`에 `id`/`merge_result`/`merge_enabled` 필드 추가.
   - `BROWSER_BUNDLE_KEYS`에 `combos.json → COMBOS` 등록.

3. **`data/combos.json` (신규, 4 레시피)**:
   ```
   branch + branch → wood
   stem + stem → plant_fiber
   plant_fiber + stem → clean_cloth
   clean_cloth + plant_fiber → bandage
   ```
   `data/data.js`에 `COMBOS` 키로 번들.

4. **`inventory.js` 리팩터**:
   - `InventorySystem.MERGE_COUNT=2` 상수.
   - `ITEMS`에 2단계 엔트리(`wood`/`plant_fiber`/`clean_cloth`/`bandage`) 추가. 1단계 merge_result 배선.
   - 레거시 `material_low/mid/high`는 `mergeable:false`로 마킹(사실상 비활성, 삭제 유예).
   - `resolveDef(type)` — Notion 값 우선, static 폴백.
   - `lookupCombo(typeA, typeB)` — sort 기반 순서 무관 비교.
   - `canMerge` — `grade` 기반 승급 → `merge_result` 존재 여부로 전환.
   - `canCombine`/`getCombineResult` 신설.
   - `confirmPlacement` 분기: **머지 → 조합 → swap**. `{action, resultType}` 반환.
   - `_placeDerivedItem` 헬퍼로 결과물 배치 중복 제거.
   - 시그니처는 모두 유지 — 기존 호출부 회귀 없음.

5. **UI 배선** (`index.html`):
   - `InventoryModal`에 `onFlashMessage` prop 추가. `setMessage` 연결.
   - `previewInfo.kind`에 `'combine'` 분기 추가 (drag overlap 미리보기 상태).
   - 확정 버튼 레이블 `확정 (조합)` 분기.
   - 결과 메시지: "두 재료를 합쳐 X을(를) 얻었다." / "재료를 조합해 X을(를) 만들었다."
   - CSS `.inventory-preview.ok.combine` 보라 점선(#b794f4).

**E2E 로직 검증** (브라우저 내 JS 12 케이스 PASS / 콘솔 에러 0):
- TTD_DATA.ITEMS=9, COMBOS=4 로드.
- `branch.merge_result==='wood'` / `stone.mergeable===false` (Notion 반영 확인).
- branch+branch → merge wood, stem+stem → merge plant_fiber.
- plant_fiber+stem → combine clean_cloth, clean_cloth+plant_fiber → combine bandage.
- stone+branch → swap (조합·머지 모두 불가).
- 3×branch → 공간 압축: items 수 3→2.
- wood/bandage는 `canMerge=false` (terminal).

**남은 이슈**:
- 요한 수동 UI QA (드래그 미리보기·메시지·실제 인벤 변화) 대기. 로직은 PASS.
- 시트 `rest` row / `find_weapon` 삭제는 4차 세션부터 계속 대기.

## 2026-04-22 4차 세션 변경점 (손패 5장 + 휴식 카드 + 카드로 아이템 사용 프레임워크)

**요약**: 요한 QA 통과 후 신규 지시 3건 구현. D-22(손패 확장) + D-23(프레임워크) 신설.

1. **`HAND_SIZE=5` 상수 도입** (`index.html`)
   - `Game` 컴포넌트 밖 모듈 스코프에 선언. 초기 드로우 `slice(HAND_SIZE)`, `moveTo`의 보충 루프 `while (newHand.length < HAND_SIZE)`, 상단 카운터 `손패 {hand.length}/{HAND_SIZE}` 모두 이 상수 참조.
   - `HandCards` 그리드 3열 → 5열. 검증 결과 uniqueTops=1(한 줄), 각 카드 ≈194px.

2. **"카드로 아이템 사용" 프레임워크** (D-23 설계 참조)
   - `effectParser.js` 신규 API: `parseCardConsume(raw)`, `scaleEffect(parsed, scales)`, `matchesConsumeFilter(consume, inv, notion)`.
   - `index.html` 컴포넌트: `CardItemConsumeModal({ inventory, filter, titleText, emptyText, onSelect, onClose })`.
   - `useCard`가 `card.consume` 존재 시 `openConsumeForCard`로 분기 → 필터 통과 아이템 목록 모달 → 선택 시 `resolveConsumeChoice`가 스케일 적용 + 아이템 1개 소비 + `finalizeCardUse`로 카드 본체 소모.
   - 후보 0개면 카드 미소모 (유저 실수 방지).

3. **휴식 카드** (프레임워크 첫 구현체)
   - 스펙: `id='rest'`, `name='휴식'`, `count=1`, `effect='음식 1개 소비 · 회복 x2'`, `detection=-10`, `time=1`, `consume='category:음식;scale:recover=2'`.
   - 시트 `베이스탐험카드`에는 아직 row 없음 → `REST_FALLBACK` 상수로 런타임 보강. 시트 row가 추가되면 자동으로 보강 스킵(id 중복 방지).
   - BASE_CARDS 로드 경로에 `consume`/`extra_effect` 컬럼 매핑 추가 — 시트에 컬럼이 생기면 즉시 반영.

**E2E 검증 결과**:
- 손패 5/5 노출, 5열 한 줄 배치 OK.
- 음식 찾기 → 버섯 획득 → 이동 1회 → 휴식 카드 뽑힘 → 클릭 → 모달 "버섯 (배고픔 +1)" 후보 → 선택 → 배고픔 11→12 (+2 반영) → 메시지 "버섯을(를) 소모하고 배고픔 +2." → 카드 무덤행(4/5, 무덤 2).
- 콘솔 에러 0.

## 2026-04-22 2차 세션 변경점 (요한 QA 후 밸런스·UI 5건)

1. **구 Notion 드롭 DB (`8b7e1f19...`)**: 요한 수동 삭제 완료. `deleted` 플래그 확인.
2. **`find_weapon` 탐험 카드 제거**:
   - `index.html`: BASE_CARDS 로드 경로에 `EXCLUDED_CARD_IDS=Set(['find_weapon'])` 필터. 폴백 상수 배열에서도 제거. useCard의 find_weapon 분기 삭제.
   - **시트 `베이스탐험카드` 5번째 데이터 행은 아직 남음** — 요한 수동 삭제 대기. Chrome MCP clipboard 경로는 탭 hidden 상태(document.hasFocus()=false, visibilityState=hidden)라 `navigator.clipboard.writeText` 실패(`Document is not focused`). D-17 레시피가 요한이 Chrome 포그라운드에 둔 세션에서만 안정적임이 확인됐고, **탭 hidden에서는 clipboard 쓰기 불가**가 새 제약.
3. **`food` 독립 아이템 제거 + `find_food` 재배선**:
   - `inventory.js::ITEMS`에서 `food: {...}` 엔트리 삭제.
   - `dropTable.js::rollTileDrop`에 `opts.forceCategory` 파라미터 추가(`'env'|'food'`) — 카테고리 1차 추첨 생략, 직접 해당 풀에서 추첨.
   - `index.html::useCard` find_food 분기: `rollTileDrop(region, {forceCategory:'food'})` 호출 → 지역 음식재료 풀에서 추첨. 풀이 비거나 region 없으면 "먹을 만한 건 보이지 않는다" 폴백.
   - Notion 아이템 DB에는 `food` 독립 레코드가 **애초에 없음** 확인(9종 모두 실재료). 아카이브 불필요.
4. **방문 타일 지역 이름 오버레이** (`index.html::HexTile`):
   - 타일 상단(상부 오프셋 -32~-44) 에 `<g class="hex-region-label">` 추가. 반투명 rect 배경 + 흰색 텍스트.
   - 조건: `tile.visited && tile.region`. revealed만 된 타일에는 미표시(스포일러 방지).
   - region 영어 코드(forest 등) 대비 매핑 맵 `REGION_LABEL` 추가 — 현재는 한글 그대로 반환.
5. **이동 시 발각률 +5%** (`index.html::moveTo`):
   - 이동마다 `const movedDetection = Math.min(100, detection + 5); setDetection(movedDetection);`.
   - `chaseMode` 전환 판정(`>=80`)과 `boss.onPlayerMove(targetId, movedDetection)` 호출도 새 값 기준으로 갱신. 이동 즉시 80 돌파 시 같은 턴 chase 전환.

브라우저 검증: 로컬 서버(`python3 -m http.server 8765`) + Chrome MCP 로드. 손패에 find_weapon 없음, 이동 1회 후 detection bar width=5%, region 라벨 "평원"/"동굴" 노출 확인. 콘솔 에러 0.

## 2026-04-24 11차 세션 변경점 — 사냥 전투 B/C/D (D-50/51/52)

요한 노션 기획 3건을 일괄 구현. 계획봇 계획서 + 요한 확정 스펙 기반.

1. **B. 명중률(accuracy) 축 분리 (D-50)**:
   - 시트 `전투카드`에 `accuracy`(int) + `full_loss`(Y/N) 컬럼 신설 + 6종 카드 값 기입.
   - 시트 `무기`에 `accuracy` 컬럼 신설(weapon_basic 10, slingshot 90).
   - `scripts/fetch_data.py::rows_to_weapons`에 `accuracy` 캐스팅 추가.
   - `combatDeck.js::buildHuntDeck`: 카드에 owning weapon.accuracy 합산 + `weaponId` 필드 주입.
   - `combatDeck.js::resolveHunt`: `effectiveEvade = max(0, evadeRate - card.accuracy)` 판정.
   - `index.html::HuntCombatModal`: 손패/슬롯 카드에 "명중 +N%" 배지 노출.

2. **C. 무기 내구도 (D-51)**:
   - weapon_basic durability 10→5 (시트).
   - 전투카드 `full_loss` 컬럼(throw_spear=Y).
   - `inventory.js`: `consumeWeaponUse(item, n, fullLoss)` 헬퍼 + addItem/_placeDerivedItem에 `durabilityLeft` 초기화.
   - `combatDeck.js::resolveHunt`: `opts.weaponState`로 실시간 재고 추적. card.weaponId 있는데 durabilityLeft<=0이면 autoFail 로그. success 시 weaponState 차감(fullLoss면 전량).
   - `index.html::handleHuntResolve`: `result.weaponUsage`에서 weaponId별 used/fullLossCount/broken 추출 → 인벤 인스턴스에 consumeWeaponUse 적용. 기존 requirement 기반 일괄 소비를 무기/비무기로 분기.
   - `ItemInfoModal`: 무기 아이템 인스턴스에 "내구도 N/M" 표시.

3. **D. 새총 조합 (D-52)**:
   - `combatDeck.js::parseRequirement`: `" + "` 구분 DSL 파서. 기존 단일 requirement 호환.
   - `buildHuntDeck`: 복합 요구 재료 각각의 보유 수 체크, slotLimit = min(보유들).
   - `handleHuntResolve`: 복합 requirement도 각 재료 1개씩 차감(무기는 weaponUsage 경로).
   - 시트 4개 탭 편집: 아이템마스터/무기/조합레시피/전투카드에 slingshot·slingshot_shot row 추가.
   - `inventory.js::ITEMS`에 slingshot 정적 폴백 등록.

**브라우저 검증**: 이번 세션에선 미실행. 요한에게 수동 QA 위임 (pending.md 체크리스트 참조).
