# project-state.md

코드베이스 현재 상태 + 마지막 검증 + 운영 환경.
세부 변경 풀텍스트는 `design-decisions.md` (활성) / `archive/` (압축본).

압축본 작성: 2026-05-12.

---

## 마지막 검증 (최신)

**2026-05-12 (D-284, 베이스캠프 복귀 가방→보관함 강제 선택 UI)**

기존 silent 손실 회복 (handleRunEnd가 fit 실패 시 `continue`로 폐기하던 동작 → 강제 UI 라우팅).

- `InventorySystem.canFitAll(items)` 신설 — 상태 변경 없이 큰 면적 순 fit 시뮬.
- `handleRunEnd`: outcome='victory' + fit 불가 → `setPendingReturn` + `setView('returnTransfer')`. fit OK → 기존 자동 흐름.
- `finalizeReturn`: 자동·강제 공통 commit 진입점 (alreadyMoved flag 분기).
- `ReturnTransferModal`: D-271 PackTransferModal 베이스. 가방·보관함 동시 그리드. [보관함으로]·[버리기(2단계)]·[복귀(가방 비었을 때만)] 3버튼. 닫기 X.

Preview MCP 시각 검증:
- 강제 케이스 (camp 70/70 + pack 3개): modal 진입, 선택 highlight, [버리기] "정말로?" 확정, [보관함으로] 자리 부족 토스트, pack 전부 폐기 후 [🏕️ 베이스캠프 도착] 활성 + 클릭 시 camp 복귀.
- 자동 케이스 (camp 0 + 3개 1x1): canFitAll.ok=true, 모달 안 뜸.
- 콘솔 실에러 0.

**파일**: `inventory.js:1011-1066` (canFitAll), `index.html:11688-11693` (pendingReturn state), `index.html:11710-11811` (handleRunEnd 분기 + finalizeReturn), `index.html:4781-4970` (ReturnTransferModal), `index.html:12180-12219` (라우터).

요한 라이브 QA는 `pending.md` D-284 항목 (8건 — 강제 진입·자동 transfer·폐기·복귀 조건·점수 정책·UX 확정).

---

**2026-05-12 (D-283, [📚 레시피] 모달 — 가방·보관함 공통)**

`recipeBrowserOpen` state + 헤더 [📚 레시피] 버튼. 클릭 시 viewport 중앙 fixed modal(zIndex 2000)에 `CraftPanel` 카테고리 탭 모드. recipes=`filteredAllRecipes`(lock gate 통과). 가방·보관함 일관. Preview MCP: 보관함→[📚 레시피] 클릭→카테고리 탭(전체·음식·무기·방어구·재료)+22개 레시피 노출 확인.

**파일**: `index.html:1672-1673` (state), `index.html:2087-2102` (버튼), `index.html:2327-2370` (modal).

요한 라이브 QA는 `pending.md` D-283 항목. 잠긴 레시피(tier 2+, 예: clean_cloth)는 작업대 학습 후 노출 — 사용자가 "모든" 의미를 잠긴 것 포함으로 원할 시 후속 작업 (lock 표시 UI 추가).

---

**2026-05-12 (D-282, 초기 base stat 체력 5 / 배고픔 6)**

`BASE_MAX_HEALTH` 6→5, `BASE_MAX_HUNGER` 10→6 (`index.html:3282-3283`). HUD fallback도 5/6으로 정합. 텐트 보너스는 그대로. Preview MCP: localStorage clear→reload→탐험 진입 HUD `❤️ 5/5 · 🍖 6/6` 확인.

**파일**: `index.html:3282-3283` (BASE 상수), `index.html:230-232` (HUD fallback).

요한 라이브 QA는 `pending.md` D-282 항목.

---

**2026-05-12 (D-281, 들고 있는 아이템 free-floating)**

PC 마우스 추적 + 모바일 마지막 터치 지점 정착. InventoryModal에 `floatingPointer` state + document `pointermove`/`pointerdown` listener. floating div `position:fixed` + `transform:translate(-50%,-50%)` + `pointerEvents:none` + `zIndex:9999`. Claude Preview MCP sim(pointermove 300,600) → floating 좌표 정확 일치 + 스크린샷 확인.

**파일**: `index.html:1655-1670` (state+listener), `index.html:2161-2178` (floating div).

요한 라이브 QA는 `pending.md` D-281 항목.

---

**2026-05-12 (D-280, 인벤토리 5+1 케이스 + 보관함 정리)**

가방·보관함 공통 인터랙션 5케이스(요한 명시) + 정렬 기능.

- ① 빈칸 드롭 자동 확정 ([확정] 버튼 클릭 없이 셀 탭 즉시 배치).
- ② 같은 size 다른 type → swap = **자리 교체 후 자동 확정** (selection 해제). 라이브 QA 보완(2026-05-12). target shape이 item 원위치에 fit 안 되면 selectedItem=target fallback.
- ③ A(소) → B(대) 내부 fit → `pickup_swap` (B 픽업 + A 확정).
- ④ B(대) → C(소) + 옆 빈칸 → `displace` (B 배치 + C 픽업).
- ⑤ 자리 부족 → `blocked` + 내레이션 바 피드백.
- 정리: `sortStorage()` — 카테고리(무기→방어구→음식→재료) + 등급 내림차순. 가방·보관함 헤더의 [🧹 정리] 버튼.

**파일**: `inventory.js:747-958` (`confirmPlacement` 재구현 + `_shapeArea` + `sortStorage`), `index.html:1736-1759` (`applyDropResult` 확장), `index.html:1846-1860` (`handleCellClick` 자동확정), `index.html:1891-1947` (`previewInfo` 확장), `index.html:2131-2148` ([확정] 라벨), `index.html:1995-2024` (보관함 헤더 [정리] 버튼).

검증 sim: 단위 5케이스 + 정렬 모두 ok. 시각 검증(보관함 모달): [🧹 정리] 버튼 노출 OK, 무기·방어구·음식·재료 4종 주입 후 정리 → 첫 행 좌→우 카테고리 순서로 fit 정확.

요한 라이브 QA는 `pending.md` D-280 항목.

---

**2026-05-08 (D-277, 방어 카드 2턴 지속 시인성 3중 큐)**

- ① `HuntCard`에 "2턴" 파란 chip(손패·슬롯·preview 일관)
- ② 슬롯 N+1 carry 오버레이(파란 dashed outline + 좌하단 "🛡️ 지속" 배지, N+1 자체 defense면 숨김)
- ③ "나" 박스 라이브 stack `🛡️ {liveStack}/{cap}` + 0.6s alternate 펄스

`combatDeck.js`의 `!card` / autoFail continue 분기에 누락된 stack 스냅샷 추가 — 모든 turn에 `defenseStack` 부착 보장.

검증 sim: L2 boar 4턴 attack + crouch 슬롯1만 → T1 stack 2(흡수 후), T2 stack 0(흡수 후 만료), T3·T4 dmg 통과 ✓. 임시 DOM 인젝션 시각 검증으로 chip + 펄스 적용 확인 ✓. 콘솔 실에러 0, BABEL pass.

요한 라이브 QA는 `pending.md` D-277 항목.

---

## 검증 히스토리 (이전 검증, 1줄 요약)

오래된 → 최신. 풀텍스트는 archive.

- **2026-04-22** (D-01~D-24) — 데이터 SSOT 정착, 머지·조합 통합, 손패 5장, consume 프레임워크.
- **2026-04-23** (D-37~D-42) — HUD 2줄 압축, LootToast 맵 내부, 보스 가시성 분리.
- **2026-04-24** (D-43~D-87) — 사냥감 전투 1단계~3단계 통합, 9th~13th 세션. 방어구 5종(D-72), 웅크리기·방패막기(D-73), 4턴 패턴 DSL(D-75), 보스 포식(D-77), 사체 타일(D-78), 베이스캠프 1단계(D-109), 런 점수(D-110), 베이스캠프 2단계 + 가방(D-113), 맵 8x8 축소(D-87), 보스 1턴=1칸(D-86), canMove 우선순위(D-85).
- **2026-04-25** (D-88~D-99, 13th 세션) — 핀치줌 드리프트(D-88), 타일 중앙 스택(D-89), 보스 포식 표면화 5건(D-90), 사냥 UI 가독성(D-91), 1단계 재료 이모지(D-92), 포식 동시 도착 안전(D-93), 거대한 먹이 + 보스 유인(D-94), L2 meat -1(D-95), 정수 시스템 통일(D-96), 무기 카드 재조정(D-97), L1 행동 패턴(D-98), 뗀석기(D-99).
- **2026-04-26** (D-100~D-102, 14th 세션) — 새총 너프(D-100), dodge evade=1(D-101), L1 evade 1 통일(D-102).
- **2026-04-27** (D-126~D-155, 16th 세션) — 가방 모달 폴리시 다단계(D-126~D-134), 카메라 추적(D-135), L2 명중 1 보장(D-138), L1 prey 포식 2턴(D-140), 퀘스트 HUD(D-141·142), 방어구 시스템(D-143·146·150·153), 보관함 12x6 + popover(D-147·149·152), 캠프 보관함 InventoryModal 재사용(D-145), 텐트 퀘스트(D-148·151), 퀘스트 목록 모달(D-154·155).
- **2026-04-29** (D-161~D-175, 17th 세션) — **내레이션 바 단일화(D-161)**, MessageText 버그픽스(D-162), campState 백업(D-163), 데이터 밸런스(D-164), 보스 경고 단계(D-165), 빌드 시각(D-166), 회피 통일(D-167), **텐트 1~10 + 동적 cap(D-168)**, CLAUDE.md(D-169), 회복 clamp(D-170), 하단 버튼 인라인(D-171), 인벤 마커 7회(D-172), 캐시 무효화(D-173).
- **2026-04-29~30** (D-174~D-185, 17~18th 세션) — **베이스캠프 빌딩 SSOT 통합 Phase A+B+v3..v6(D-174)**, 뗀석기 6(D-175), 포켓몬식 BattleStage(D-176), 빌딩 통합 + 다중 HUD(D-177), Figma 카드 비주얼(D-178), 손패 부채꼴(D-179), BattleStage 시안 v1(D-180), 풀스크린(D-181), 캐릭터 가림 해결(D-182), 시원 + 결과 팝업(D-183), 내 정보 박스(D-184), hover 어두움(D-185).
- **2026-04-30** (D-186~D-194, 18th 세션) — 5존 정렬(D-186), 시안 v2 3-block(D-188), 손패 폴리시 + stone_block hotfix(D-189), 4-건 폴리시(D-190), 단일 카드 0.8배(D-191), HP 게이지 즉시 반영(D-192), **카드 = 단일 컴포넌트 cqw(D-193)**, HP=❤️ + 턴 시각화(D-194).
- **2026-05-01** (D-195~D-207, 19th 세션) — 사냥 시각 시스템 정착 + 카메라 sync(D-195), 4→3 step(D-196), float jumping 가드(D-197), float remount 근본 수정(D-198), 피격 damped sine(D-199), 4-step 시퀀스 폴리시(D-200~D-204), 호흡 +400 + 회피 30px(D-205), tail 단축(D-206), 비공격 카드 모션(D-207).
- **2026-05-06** (D-249~D-250, 20th 세션) — L2 공격성 사냥감 선공 v1(D-249) → 자동 hunt 진입 v2로 정정(D-249 v2), 도망치기 카드 슬롯 추가형(D-250).
- **2026-05-07** (D-271) — 베이스캠프 UX 4중 개편 ([기록보기][보관함][탐험 떠나기] 통합).
- **2026-05-08** (D-273~D-277) — ActiveQuestHUD z-index 회복(D-273), 전투 정합 4건(D-274), 콤보 +1(D-275), L2 ❓ 슬롯(D-276), **방어 2턴 시인성 3중 큐(D-277) — 최신**.
- **2026-05-10** (D-278~D-279) — 나무쑤시개 합성법 복원(D-278), 베이스캠프 보관함 라우팅 회복(D-279).
- **2026-05-12** (D-280) — 인벤토리 5+1 케이스 재정의 (빈칸 자동확정·같은size swap·A<B pickup_swap·B>C+옆빈칸 displace·자리부족 blocked) + 보관함 정리(카테고리+등급 내림차순).
- **2026-05-12** (D-281~D-284) — 들고 있는 아이템 free-floating(D-281), 초기 base 5/6(D-282), [📚 레시피] 모달(D-283), **복귀 시 fit 불가 강제 선택 UI(D-284) — 최신**.

---

## 위치 & 실행

- **프로젝트 루트**: `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino`
  (iCloud Drive. 경로 공백·틸드 → bash 명령에 쌍따옴표 필수)
- **런타임**: 바닐라 HTML/JS. package.json 없음. Python 빌드 파이프라인만 존재.
- **로컬 서버**: `.claude/launch.json`에 `python3 -m http.server 8765` 설정.

---

## 핵심 파일 트리

```
time-to-dino/
├─ index.html                메인. React 인라인 거대 단일 파일.
├─ mapGenerator.js           hex 그리드 + 지역 5종 + BFS + 보스/탈출구 배치
├─ inventory.js              테트리스식 + 머지·조합 + craftRecipe + consumeWeaponUse + expandStorage
├─ boss.js                   visitedTiles + onPlayerMove + predationStay
├─ dropTable.js              rollTileDrop(region, opts) — forceCategory / forceAny
├─ effectParser.js           DSL 파서. parseItemEffect/applyItemEffect/parseCardConsume/scaleEffect
├─ combatDeck.js             buildHuntDeck/resolveHunt + parsePreyActions/findPreyAction/rollUnknownAction
├─ gameComponents.jsx
├─ gameRenderer.js
├─ gameStyles.css
├─ Makefile                  `make data` / `make data-offline`
├─ scripts/
│  └─ fetch_data.py          시트 xlsx/API → JSON + data.js. gspread `--sheet-op` 4종(append-row/delete-row/update-cell/ensure-tab).
├─ data/                     AUTO-GENERATED
│  ├─ base_cards.json        탐험 카드
│  ├─ extra_cards.json
│  ├─ combat_cards.json      전투 카드
│  ├─ monsters.json
│  ├─ prey.json              사냥감 (level/evade/attack/aggressive 등)
│  ├─ prey_actions.json      종별 특수 행동 20종 (D-108)
│  ├─ buildings.json         6종 × stage 1~3 (D-174)
│  ├─ items.json
│  ├─ weapons.json
│  ├─ armors.json
│  ├─ combos.json            조합 레시피
│  ├─ data.js                window.TTD_DATA 번들
│  └─ Assets/
│     ├─ character/Player.png
│     └─ cards/punch.png + icons/{att,acc,eva,def}.png
└─ .claude/
   ├─ launch.json
   ├─ settings.json
   ├─ skills/                ttd-brief / ttd-commit-push / ttd-make-data
   └─ game-director/         디렉터 메모리 (이 디렉토리)
      ├─ design-decisions.md (활성 결정만)
      ├─ pending.md (활성 QA + 외부 액션만)
      ├─ project-state.md (이 파일)
      └─ archive/
         ├─ INDEX.md (전체 D-XX 147건 인덱스)
         └─ design-decisions-archive.md (회귀/SUPERSEDED/폴리시 풀텍스트)
```

---

## 데이터 SSOT 매핑

**시트 = 마스터** (`https://docs.google.com/spreadsheets/d/1iS4Lmjx32w0Mu527foFtc8pQn3pw6APcQYnvcKdVM9o`). 모든 수치 데이터 편집은 시트에서.

| 영역 | 시트 탭 | 산출물 |
|---|---|---|
| 탐험 카드(베이스) | `베이스탐험카드` | `data/base_cards.json` |
| 카드(1차) | `1차_확정카드` | `data/extra_cards.json` |
| 전투 카드 | `전투카드` | `data/combat_cards.json` |
| 사냥감 | `사냥감` | `data/prey.json` |
| 사냥감 행동 풀 | `사냥감행동` | `data/prey_actions.json` |
| 몬스터 | `몬스터` | `data/monsters.json` |
| 빌딩 | `빌딩` | `data/buildings.json` |
| 아이템 | `아이템마스터` | `data/items.json` |
| 무기 | `무기` | `data/weapons.json` |
| 방어구 | `방어구` | `data/armors.json` |
| 조합 | `조합레시피` | `data/combos.json` |
| 드롭 확률 | `드롭테이블` | `data/drop_table.json` |
| 드롭 풀 | `드롭풀` | `data/drop_table.json` |
| 특수 카드 | `특수카드` | `data/special_cards.json` |

**Notion**: D-30 이후 레거시 참조용. 수치 갱신 대상 아님. 노션 callout이 사용자 안내 표지 역할.

**워크플로**: 시트 편집 → `python3 scripts/fetch_data.py` 또는 `make data` → JSON·data.js 재생성 → 커밋. 디렉터는 `--sheet-op={append-row|delete-row|update-cell|ensure-tab}`로 직접 시트 편집(요한 떠넘기기 금지, CLAUDE.md 정책).

---

## 동적 cap helpers (D-168, 다시 명시)

새 코드에서 max 사용 시 다음 helper만 신뢰:

- `getMaxHealth(campState)` = `BASE_MAX_HEALTH (6) + allCampBonuses(campState).health_max`
- `getMaxHunger(campState)` = `BASE_MAX_HUNGER (10) + allCampBonuses(campState).hunger_max`
- `getPackBonusSlots(campState)` = `allCampBonuses(campState).pack`
- `getCampStorageSlots(campState)` = `BASE_CAMP_STORAGE_SLOTS + allCampBonuses(campState).camp_storage`

`MAX_HEALTH` / `MAX_HUNGER` 직접 사용·하드코딩 금지. 회복 효과 clamp는 setStat 진입점에서(D-170).

---

## 권한·운영 (D-169~D-194 정착)

`.claude/settings.json` 3중 보장(글로벌 + 메인 리포 + 워크트리). `defaultMode: bypassPermissions` + `permissions.allow` 풀세트. 권한 prompt가 떠도 항상 "허용"이 정답 — 2026-04-30 요한 명시 동의 (CLAUDE.md 정책).

**1 D = 1 commit** 분할 규칙 (D-169). `ttd-commit-push` 스킬 1.5단계가 디렉터 메모리 동기화 블로킹 체크포인트.

---

## 환경 / 알려진 이슈

- iCloud 경로 공백·틸드 → 쌍따옴표 필수.
- 워크트리(`/.claude/worktrees/<name>/`) cwd 진입 시 `.secrets` 심링크 셋업 필요 — 메인 리포 `.secrets/` 부재면 사용자 키 발급 요청.
- GameMap 8번 remount 별도 진단(D-195 후속) — `overflow-anchor:none` 우회됐지만 근본 미파악. pending에 남아있음.
