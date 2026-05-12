# design-decisions.md

요한·디렉터가 내린 활성·구조적 결정. 후임이 "왜 이런 구조지?"로 고민하지 않게 하는 것이 목적.

회귀 fix·SUPERSEDED·다단계 폴리시·복기 로그는 모두 `archive/design-decisions-archive.md`로 옮겼다. 전체 D-XX 흔적은 `archive/INDEX.md` 한 줄 인덱스 참조 (147건 전수).

압축본 작성: 2026-05-12 (요한 지시 — 활성 결정만 압축, 회귀류는 archive).

---

## 1. 코어 원칙

### D-11. 보스 = 공포 — 전투 빈도를 낮게 유지

밸런싱 판단 제1 원칙. 기획서 "몬스터는 두려운 존재" / "한 사이클 종료 후 유저 1칸 후퇴 + 3턴 대기"가 모두 조우를 희소 사건으로 만드는 설계. 드롭·카드 효율·발각 확률 튜닝 시 이 원칙이 우선.

### D-12. 텍스트 톤 — 1인칭 완료형 내레이션

시스템 메시지는 "~했다 / ~했지만 ~" 형태. 가능한 곳에 감각 단어(공기·냄새·소리). 건조한 "아이템 획득"은 금지 — 예: "[숲] 나뭇가지를 발견했다.". `index.html::useCard` 메시지 포맷이 컨벤션 기준.

### D-19. 이동마다 발각률 +5% (보스=공포 강화)

타일 1칸 이동마다 발각률 +5% (상한 100). 7x7 맵의 대각선 6~8칸 기준 16칸 이동에 추격 임계(80) 도달. `숨기`(-15)·`귀 기울이기`(-5)로 의도 관리. chase 전환 판정도 같은 턴 `movedDetection`으로 즉시 평가 — "한 턴 더 이동해서 벗어난다"가 안 먹힘.

### D-20. 방문 타일에만 지역명 노출 (스포일러 방지)

지역 이름 오버레이는 `tile.visited && tile.region`에서만. `revealed`(정찰)에서는 미노출. "가보기 전엔 냄새·소리·그림자만 단서"라는 1인칭 분위기 보존.

### D-42. 보스 가시성 분리 — 이동 시 재은닉

`bossVisible` 별도 state. `listen` 1칸에서 setTrue, `moveTo`에서 setFalse. 지형 `revealed`는 유지(지형 단서는 기억 가능). 매 이동마다 귀기울이기를 다시 소비해야 보스 위치 확인 — 공포 원칙 강화.

### D-86. 보스 이동 템포 1턴=1칸 고정

유저 행동 1턴당 보스 1칸 이동(이전: 2턴 1칸). 11x11 확대 후 "보스가 너무 멀다" 체감 해소. chase 모드도 동일.

### D-62. 보스 미방문 타일 선호 배회

일반 모드 보스가 인접 중 미방문 우선. chase에선 미적용(최단 접근 우선). `boss.js::visitedTiles` Set + `moveRandom`/`moveTowards` 모두 이동 후 add. `bossMoveHistory`(UI) vs `visitedTiles`(AI) 분리.

---

## 2. 맵 & 타일

### D-87. 맵 크기 8x8 (D-61 11x11 축소)

`MAP_SIZE = 8` (64타일). `mapGenerator.js`가 gridSize 비율 기반 — empty 12~19 / good 5 / trap 3 / 보스 최소 거리 5칸. D-61 11x11이 너무 넓어 "보스 위협보다 맵 횡단이 콘텐츠 중심"이 되는 문제 해소.

### D-54. 원형 스크롤 패딩 — 완전 투명

`PADDING_HEXES = 7`. 플레이 그리드 주변에 빈 hex 영역 확보, 테두리·장식 없음. 사용자가 "맵이 여기서 끝난다"는 경계감을 못 느끼게 — 공포의 개방감 보존. `mapGenerator.js::getMapExtent()`로 SVG 크기 산출.

### D-89. 타일 아이콘 통합 중앙 스택

한 타일의 모든 아이콘(사냥감/사체/지형/플레이어/보스)을 타일 중앙 정사각 슬롯 스택으로. n=1~4까지 자동 배치(중앙/ㅇㅇ/ㅇㅇ/ㅇ/ㅇㅇ ㅇㅇ). `computeTileIcons(tile, ctx)` 순수 함수 — HexTile + GameMap 동일 입력→동일 결과. trace는 같은 타일에 prey/carcass 가시화 시 자동 생략 (중복 방지).

---

## 3. 보스 시스템

### D-93. 포식 중 보스 타일 진입 안전

포식 중 같은 타일 진입은 게임 오버 회피. `inPredationSafe = encounter && boss.predationStay > 0` 분기 → 토스트 "거대한 짐승이 식사에 정신이 팔려있다. 들키기 전에 빠져나가자!". 식사 끝나면 일반 경로 복귀 — "1~2턴 내 빠져나가야 한다"는 자연 제한. hunt_start 카드는 보스 이동 후 push, inPredationSafe면 생략.

### D-139. 보스 포식 후보 — L1 포함 모든 prey

`boss.js` 포식 후보 필터에서 `level !== 2` 가드 제거. L1·L2 가리지 않고 거리 2 이내 모든 prey가 포식 타겟. L1 사냥감도 보스 미끼로 활용 가능.

### D-90. 제자리 시간 보내기 + 포식 3턴 + 사체 알림 + 큰생고기

5건 묶음. 핵심: 보스 포식 시스템 표면화 — 보스가 "사라지는 동안 무엇을 하는지"를 정보·기회로 노출.

- **A. 제자리 [시간 보내기]** — `moveTo(currentTile)` 허용(`isWaitInPlace` 분기). WaitConfirmModal로 명시 확인. 시간/배고픔/발각/보스이동 모두 그대로 진행.
- **B. 보스 포식 stay 3턴** — `boss.js::predationStay = 3`. (D-140에서 L1만 2턴으로 분기.)
- **C. 사체 타일 알림** — `carcassTiles` Set→Map<tileId, {preyType}>. 첫 도착 시 토스트 "거대한 짐승이 무자비하게 OOO을(를) 뜯어먹은 흔적이다.". `boss.js` 콜백 시그니처 확장(`onPredationStart(preyId, tileId, prey)` / `onPredationComplete(tileId, preyId, preyType)`).
- **D. 인접+귀기울이기 → 점프스케어 + PredationListenModal** — 진홍 테두리, 🦖 + prey emoji + 🩸. "몰래 통과해서 지나갈 좋은 기회".
- **E. 큰생고기 신규** — `big_meat` 1단계(hunger+2/health-2, 생고기 ×2). L2 prey meat 절반. 파생 조합 `big_meat+branch→big_meat_skewer` / `→grilled_big_meat_skewer`.

### D-94. 거대한 먹이 + 보스 유인 시스템

`giant_bait`(2x2, is_bait=true). 합성 `big_meat×4 → giant_bait`. ItemInfoModal에 [먹이로 유인하기] 버튼 — 클릭 시 currentTile에 미끼 배치 → 보스 prey 추적 메커니즘 재사용(synthetic prey 패턴 — boss.js는 무변경).

### D-249 v2. 공격성 사냥감 선공 = 자동 hunt 진입

aggressive=true L2(boar/dinosaur) 사냥감 칸 진입 시 자동으로 hunt 모드 진입. HP 직접 차감 없이 첫 턴부터 회피/방어/공격 카드 정상 사용. 보스=공포 일관 — 강제 전투 자체가 위협. preyNarration `‼️ {이름}이(가) 풀숲을 박차고 달려든다! 사냥이 시작된다.`. 시트 `사냥감.aggressive` "Y"/"N" SSOT.

---

## 4. 인벤토리 & 합성

### D-08. 롱프레스 임계값 400ms

짧은 탭=정보창 / 400ms 이상=선택·이동·머지·회전. Android 표준(500ms)보다 빠르고 iOS(~300)보다 여유. `index.html::LONG_PRESS_MS`.

### D-22. 손패 상한 3장 → 5장

`HAND_SIZE = 5`. 초기 드로우·이동 보충 모두 이 상수 참조. 3장은 단순 루프(뒤져보기·이동·이동)에 갇히고, 5장은 발각률 관리 vs 파밍 교환이 매 턴 유의미.

### D-23. "카드로 아이템 사용" 프레임워크 (consume DSL)

카드 스펙에 `consume` DSL 필드 — `category:음식;scale:recover=2` 등. `effectParser.js::parseCardConsume(raw) → {filters, scales}` + `scaleEffect(parsed, scales)` + `matchesConsumeFilter(consume, inv, notion)`. `CardItemConsumeModal`로 후보 선택. 후보 0개면 카드 미소모(실수 방지). 첫 구현체: 휴식 카드(음식 1개 소비 → 회복 ×2 + 발각 -10).

### D-24. 머지·조합 통합 시스템

같은 슬롯 겹침 = 머지(같은 id) OR 조합(다른 id). `MERGE_COUNT=2`(전역 상수, inventory.js). 머지: Notion `머지 가능` + `결과물` relation. 조합: `combos.json` 전역 리스트 (`{ingredients:[...], result:""}`). `confirmPlacement` 분기 순서: 머지 → 조합 → swap. 시그니처 유지(`canMerge`/`mergeItems`/`confirmPlacement`) — 회귀 0.

### D-14. 아이템 등급 = 파생 단계 (1/2/3단계)

`아이템 등급` select를 "희소도(일반/희귀/전설)" → "파생 깊이(1/2/3단계)"로 재정의. 1=파밍 직접 / 2=조합 파생 / 3=고차 조합. 드롭 풀 연결 여부와 1:1 매핑.

### D-150. 방어구 내구도 — 방어 카드 사용 시 1씩 차감

`armorState: {[itemId]:{durabilityLeft}}` 도입. `cardDefense > 0` 슬롯 활성 턴마다 모든 방어구 1씩 차감. `armorUsage` 반환 → 사냥 종료 후 인벤 반영(broken=제거). 잎사귀(3) / 나무 방패(4) / 천 갑옷(4) / 강화 방패(6) / 비늘 갑옷(6).

### D-153. 방어 카드 — 인벤 방어구 잔여 내구도 표시

HuntCombatModal 카드 UI에 잔여 내구 표기. 손패=시작 시점 잔여 / 슬롯=사용 후 잔여(before-1). 색 #88aaff(방어 stat 색).

### D-145. 캠프 보관함을 InventoryModal로 재사용

캠프 보관함이 가방과 동일 `InventoryModal` 사용(`title` prop 분기, `mode='storage'`). 선택/머지/swap/조합/레시피 패널 모두 동일. `gridTemplateColumns/Rows`를 인라인으로 덮어 동적 그리드 크기. `onUseItem`/`onLureBait` 미전달 — 캠프엔 음식 사용·미끼 컨텍스트 없음.

### D-137. '구운' 음식은 휴식 카드 요리 모달에서만

`result.startsWith('grilled_')` = 생명력 회복 효과 보유. 가방 합성 패널에선 카드 노출은 OK지만 만들기 버튼은 비활성(`🔥 휴식 필요`). 휴식 카드 → CookingModal 경로로만 실제 제작 가능. `allowCooking` prop으로 분기.

---

## 5. 베이스캠프 & 빌딩

### D-109. 베이스캠프 1단계 (App view 분기 + localStorage)

App을 view='intro'/'play'/'camp' 분기로 재구조. IntroScenarioScreen → CampScreen(보관함 + 퀘스트 + 건설 + [탐험 떠나기]) → Game(맵 한 사이클). localStorage `ttd:campState:v1` 영속화 — 첫 마운트가 부재면 intro, 존재면 camp로 진입(시나리오 스킵).

### D-113. 베이스캠프 화면 재구성 + 가방 + 보관함 + transfer

보관함 InventorySystem(12,8) 세로 김. 직렬화 v2 + 마이그레이션 폴백(좌표 충돌 시 빈 자리). `campState.pack`(5,5) 신규 — [탐험 떠나기]가 pack 인스턴스를 Game `initialInventory`로 인계, 사망=폐기 / 승리=handleRunEnd로 보관함 인입. `transferItems(src,dst,ids)` 헬퍼 — durabilityLeft/rotation 보존. PackTransferModal 다중선택([가방으로]/[보관함으로]/[서로 바꾸기]).

### D-168. 텐트 1~10 레벨 시스템 + 동적 cap helpers

베이스 max 너프(체력 8→6, 배고픔 12→10). 텐트 Lv.1~10 보상 3주기(가방+1 / 생명력+1 / 배고픔+1).

**핵심 helpers (모든 cap의 SSOT)**:
- `getMaxHealth(campState) = BASE_MAX_HEALTH + allCampBonuses(campState).health_max`
- `getMaxHunger(campState) = BASE_MAX_HUNGER + allCampBonuses(campState).hunger_max`
- `getPackBonusSlots(campState)`, `getCampStorageSlots(campState)`

신규 코드는 `tentLevel`만 신뢰(`tentBuilt:bool` 호환 잔존). StatPanel `maxHealth/maxHunger` props 동적. 직렬화 v3 — 두 필드 동시 저장. `stone+stone → stone_block`(2단계 재료) 신규.

**금기**: `MAX_HEALTH`/`MAX_HUNGER` 하드코딩 X — 항상 helper 경유.

### D-170. 동적 MAX 재-clamp (회복 효과 한도 초과 버그픽스)

D-168 동적 cap 도입 시 effectParser 정적 STAT_BOUNDS(12/8)로 clamp되어 한도 초과되던 버그. setStat 콜백 두 곳(`useItem`, `resolveConsumeChoice`)에서 런타임 `MAX_HUNGER`/`MAX_HEALTH`로 재-clamp. effectParser는 정적 유지(공용 한도). **게임 SSOT는 항상 setStat 진입점** — 규칙 강화.

### D-174. 베이스캠프 빌딩 SSOT 통합 (Phase A+B+v3..v6)

D-168 텐트만 활성이던 빌딩 그리드를 시트 SSOT 기반 6종 빌딩(치료소·작업대·무기 제작소·보호구 제작소·감시탑·보관함) × stage 1~3으로 풀 가동.

**핵심**:
- `data/buildings.json` 18 rows (시트 `빌딩` 탭 SSOT).
- `BUILDING_DEFS` / `BUILDING_SLOTS` 9칸 (텐트 + 빌딩 6 + 잠금 2).
- `allCampBonuses(campState)` 9키 합산 — `buildingLevels:{[id]:stage}` × stage 곱셈 누적.
- 텐트 v2: 모든 레벨 `camp_storage+7` 단일화 (그리드 7×20).
- 시트 빌딩은 [받기] 단계 없이 즉시 [완수] (시나리오 부재).
- 감시탑은 보스 정보 직접 노출 0건 — **D-08(D-11)** 보스=공포 보존.
- 직렬화 v4 — `buildingLevels:{}` + `oneShotInventory:{}` 신규 (v3 폴백 호환).
- `inventory.js::expandStorage(slotsToOpen)` 좌측부터 풀기.
- `findIdByKoreanName` 한글→영문 id 매핑.
- 시트 입력은 디렉터가 `python3 scripts/fetch_data.py --sheet-op=...` 4종으로 직접 처리 (요한 떠넘기기 금지).

### D-177. 빌딩 [받기]→[완수] 통합 + 다중 HUD + 빨간 점

- `BuildingsGrid`: 수락 가능(다음 stage + active 미등록) 카드 우상단 빨간 점(`.building-takeable-dot`). 조합 초록·퀘스트 노란과 색 분리.
- `BuildingDetailModal` sheet 분기: 텐트 패턴([받기]→active 등재→[완수])과 동일.
- `CampScreen.onTakeQuest` prefix 라우팅 — `bld_*`는 직접 active, `tent_*`는 TentQuestModal.
- `ActiveQuestHUDPanel` 단일 → 다중 active(텐트 1 + 빌딩 6 동시) + 자체 스크롤(maxHeight 60vh).
- dim 분리: 미빌드 일반 빌딩은 카드 1.0, 아이콘만 0.45. locked: 카드 0.3.

### D-271. 베이스캠프 UX 4중 개편

하단 버튼 행 통합 `[기록보기][보관함][탐험 떠나기]` 3개. [📦 보관함] → `setStorageOpen(true)` → `InventoryModal mode="storage"` (D-145·D-149·D-150 floating popover). 가방↔보관함 transfer는 [탐험 떠나기] 흐름의 `packDeparting=true` 상태로 진입.

### D-280. 인벤토리 5+1 케이스 + 보관함 정리 (2026-05-12)

요한 명시 5케이스 매트릭스 + 정리. 가방·보관함 공통.

**5케이스 — `confirmPlacement(x, y)` 분기**:
1. **① 빈칸 드롭** — `overlapped.length === 0` → `action: 'place'`. UI: `handleCellClick`이 setPendingPos 후 즉시 `confirmPlacement` 호출 (이전엔 [확정] 버튼 클릭 한 번 더 필요).
2. **② 같은 size 다른 type** — `sameSize` (`shape.length`/`shape[0].length`/area 모두 동일) → `action: 'swap'`. **자리 교체 후 자동 확정 (selection 해제)** — 요한 D-280 보완(2026-05-12 라이브 QA). target.shape을 item 원위치에 placeItem, selectedItem=null. target shape이 item 원위치에 fit 안 되면 selectedItem=target fallback.
3. **③ A(소) → B(대)** — `itemArea < targetArea` + A의 모든 점유 칸이 B의 점유 칸 집합 내부면 → `action: 'pickup_swap'`. B를 손에 들고 A를 (x,y) 확정. 이전 모듈은 무조건 swap이라 B의 다른 칸이 빈 grid에 못 들어가 fail.
4. **④ B(대) → C(소) + 옆 빈칸** — `itemArea > targetArea` + overlap=1(C만) → `action: 'displace'`. B를 (x,y) 배치 + C 픽업. C 외에 다른 아이템이 영역에 있으면 overlap>=2 분기로 빠짐.
5. **⑤ 자리 부족** — overlap>=2 또는 disabled 침범 등 → `action: 'none', reason: 'blocked'`. UI는 내레이션 바 "자리가 부족해 옮길 수 없다."

**previewInfo도 동일 매트릭스로 확장** — kind: `place|swap|pickup_swap|displace|merge|blocked|oob`. [확정] 버튼 라벨도 "들고 교체" / "밀어내기"로 차등 표시. [확정] 버튼은 유지 (회전 후 재확정·명시적 confirm용).

**applyDropResult 분기**: `swap`은 inventory.selectedItem=null이라 setSelectedItem(null)+setPendingPos(null)로 떨어져 자동 확정. `pickup_swap | displace`는 inventory.selectedItem(=새 target) 전환 + pendingPos 갱신. blocked 시 onFlashMessage 호출.

**보관함 정리 — `sortStorage()` 메서드**:
- 카테고리 순위 (`무기/weapon=0 → shield/armor/방어구=1 → food/음식=2 → 그 외=3`).
- 카테고리 내 등급 내림차순 → 면적 내림차순 → 이름 안정.
- 가상 grid에 좌상→우하로 fit (큰 면적 우선 정책 제거 — 카테고리 순서 보존).
- selectedItem 있으면 사전 cancelSelection.
- 모달 헤더 우측 [🧹 정리] 버튼 (가방·보관함 공통, 단 가방은 칸 적어 효용 낮음).

**검증**: 단위 5케이스 + 정렬 모두 ok. ① place ok, ② swap ok+selectedItem=null(자동 확정, D-280 보완 후), ③ pickup_swap ok+B픽업, ④ displace ok+C픽업, ⑤ blocked. 정렬: 무기(0,0)→방어구(2,0)→음식(3,0)→재료(4,0) 첫 행 좌→우. Claude Preview MCP 라이브 swap sim(목재↔딸기): selectedAfterSwap=null, 자리 정확히 교체, [확정] 버튼 사라짐 — 통과.

**파일**: `inventory.js:747-958` (`confirmPlacement` 재구현 + `_shapeArea` 헬퍼 + `sortStorage`), `index.html:1736-1759` (`applyDropResult` 확장), `index.html:1846-1860` (`handleCellClick` 자동확정), `index.html:1891-1947` (`previewInfo` 확장), `index.html:2131-2148` ([확정] 라벨), `index.html:1995-2024` (보관함 헤더 [정리] 버튼).

### D-281. 들고 있는 아이템 free-floating — 마우스/터치 추적 (2026-05-12)

요한 지시: "들고 있는 아이템이 마우스 커서를 따라다니게 + 모바일은 마지막 터치 지점쯤의 공중에 떠있게". 기존 floating 아이템은 `pendingPos` 셀에 자석 정렬돼서 마우스를 따라가지 않음 — 셀 단위로 점프.

**구현**: `InventoryModal`에 `floatingPointer` state(viewport 좌표). selectedItem 있을 때만 document에 `pointermove`/`pointerdown` listener 등록 → 좌표 갱신. cleanup은 useEffect deps=[selectedItem]로 자동.

- PC: `pointermove`가 마우스 이동마다 발화 → 실시간 추적.
- 모바일: 단일 탭은 `pointerdown`만 발화(드래그 없으면 `pointermove` 미발화) → 마지막 터치 지점에 정착, 다음 탭마다 새 위치로 점프.

**floating div**: `position:fixed` + `transform:translate(-50%,-50%)`로 viewport 좌표에 중심 정렬. `pointerEvents:none`으로 아래 셀 클릭 통과. `zIndex:9999` 모든 모달 위.

**원본 자리**: selectedItem은 그리드 render에서 이미 filter됨 (line 2119). 즉 빈 칸으로 보임 — 별도 처리 불필요.

**검증**: Claude Preview MCP `pointermove(300,600)` dispatch → floating left:300px / top:600px / transform 중앙 정렬 일치. 스크린샷에 목재 빨간 박스가 정확히 (300,600) 근처 떠있음 확인.

**파일**: `index.html:1655-1670` (`floatingPointer` state + listener), `index.html:2161-2178` (floating div free-floating).

### D-282. 초기 base stat — 체력 5 / 배고픔 6 (2026-05-12)

요한 지시: 시작 시 stat 5/6으로 강화. 기존 6/10에서 둘 다 축소 — 게임 초반 압박감 + 텐트 빌드 동기 강화.

`BASE_MAX_HEALTH = 5` / `BASE_MAX_HUNGER = 6` (`index.html:3282-3283`). HUD progress fallback도 5/6으로 정합 (`index.html:230-232`). 텐트 보너스(`getMaxHealth(campState)` / `getMaxHunger(campState)`)는 그대로 — base만 변경.

기존 저장 게임은 load 시 새 cap으로 자동 clamp.

**검증**: localStorage clear → reload → 탐험 진입 HUD 표시 `❤️ 5/5 / 🍖 6/6` Claude Preview MCP 확인. `BASE_MAX_HEALTH` 5, `BASE_MAX_HUNGER` 6 정확.

---

## 6. 사냥 전투

### D-110. 런 점수 + 전리품 결과창 + 이동거리 점수

`calculateRunScore` 순수 함수. victory=false→0. 생존 100 + uniqueTilesVisited×3 + (detection<80 ? 30 : 0) + L1×5/L2×20/보스위협권×15 + 자원(무기 5, shield/armor 8, grade 1/2/3 → 1/3/6). 시간 잔여→이동거리(고유 타일)로 교체("남으면 좋은데 굳이?" 모호함 제거).

`LootResultScreen` 신규 — 인벤 그리드 시각, 셀 탭=선택/해제. 점수 실시간 재계산. `runStats` 추적(`l1PreyKills/l2PreyKills/bossDangerEntered`). `campState.runs` 확장(`bestScore/totalScore/lastScore`).

### D-51. 무기 내구도 + 실시간 재고

무기 아이템 인스턴스에 `durabilityLeft:number` 런타임 필드. 전투카드 `full_loss`(Y/N) 컬럼 — Y면 1회 사용에 전량 차감.

`combatDeck.js::resolveHunt(prey, userSlots, {weaponState})`:
- `weaponState = {[weaponId]:{durabilityLeft}}` 턴 루프 내부에서 추적.
- 슬롯 3개에 창던지기 배치해도 1턴에 창 1자루 잃으면 2·3턴 autoFail(`reason='weapon_missing'`).
- 결과 `weaponUsage:{[id]:{used,broken,fullLossCount,durabilityFinal}}` 반환.

`inventory.js::consumeWeaponUse(item,n,fullLoss)`. ItemInfoModal 내구도 노출. `loss_chance:0~100` 컬럼(D-97에서 도입) — 확률 분실(throw_spear 50%).

### D-96. 회피·명중 % → 정수 (결정론)

확률 굴림 제거. `acc ≥ evade → 명중 / acc < evade → 회피`. max 정규화: prey evade 60%→3, card accuracy 20%→3. 도주 누적 패널티: ×10%p → -1/회(정수 단위).

`parseEvadesByTurn(prey)`는 export — `resolveHunt`(판정)와 `computedEvades`(UI 렌더)가 동일 공식 SSOT. EvadeBadge `회피 N` (% 제거).

### D-101. 유저 회피 시스템 — dodge 카드 evade=1

`dodge`: success_rate 75→100(결정론), `evade:1` 신규 필드. `combatDeck.js::resolveHunt::takeDamageThisTurn`이 prey attack 턴에 `cardEvade > preyAttackAccuracy`면 0 데미지. StatBadges에 `💨+N` 표시(D-167 톤 통일).

### D-98. L1 사냥감 행동 패턴 (peek/evade/defend)

L1 행동을 3턴 actions_per_turn DSL로 도입. 규칙 — `peek≤2 / evade≤1 / defend≤1`. 사냥감별 컨셉 차등 (토끼=peek,defend,evade / 메뚜기=peek,peek,evade 등). L1 defense=1 일괄. `parsePreyActions` fallback도 L1/L2 분기.

### D-108. 사냥감 행동 풀 SSOT 분리 + 종별 특수공격

시트 `사냥감행동` 탭 SSOT — `id,name,type,damage,accuracy,defense,description`. 20행(기본 4 + 종별 특수 16). `combatDeck.js::findPreyAction(id)` 매칭, 못 찾으면 폴백. 종별 특수: tusk_charge(boar dmg 3), pounce_bite(dino dmg 2 acc 1), feint_strike(fox acc 2 — dodge 무력화), iron_curl(armadillo def 3), wing_slap(큰 새), frenzy_claw(badger) 등.

### D-275. 연속 카드 보너스 +1 (콤보 시스템)

직전 슬롯(t-1)과 현재 슬롯(t)의 카드 id 동일 + 둘 다 있으면 콤보. 핵심 스탯 1개에 +1(우선순위 `damage > defense > evade > accuracy`). 직전 비교 방식 — 3연속이면 t=1, t=2 각각 +1 (누적 +2 아님). `combatDeck.js::resolveHunt`가 `turns[].combo/comboBonus` 부착. UI: 슬롯 골드 outline + "콤보 +1" 배지 + 글로우, 턴 로그 "연속 +1" chip.

### D-276. L2 사냥감 행동패턴 ❓ 슬롯 (긴장감)

L2 7종 모두 turn3을 `?` 토큰으로 통일. `findPreyAction`이 `?` → unknown sentinel. `rollUnknownAction(prey)`가 비-? 토큰 풀에서 균등 추첨. `resolveHunt`가 turn 진입 시 swap + `revealedAction` 부착. UI: ❓ + "알 수 없음" + 보라 dashed 보더 → step1에서 `setSlotActions` swap. L1엔 미적용 (L2 차별화).

### D-277. 방어 카드 2턴 지속 시인성 3중 큐

방어 카드(defense > 0)가 발동 turn + 다음 turn까지 2턴 흡수 — 시인성 3중:
1. **카드면 "2턴" chip** — `.hunt-card-defense-duration` 파란 그라데이션, 손패·슬롯·preview 일관.
2. **슬롯 N+1 carry 오버레이** — 파란 dashed outline + 좌하단 "🛡️ 지속" 미니 배지. N+1 자체 defense면 숨김(자기 stack 우선).
3. **"나" 박스 라이브 stack** — 동적 `🛡️ {liveStack}/{cap}` + 0.6s alternate 펄스. step1 시점 즉시 set, step2 시점 turn.defenseStack 동기화.

`combatDeck.js::resolveHunt` 빈 슬롯/autoFail continue 분기에도 stack 스냅샷 부착 보장.

### D-250. 도망치기 — 카드 슬롯 추가형 (20% × 무한)

D-225 즉발 SUPERSEDED. 버튼 → 빈 슬롯에 도망치기 카드 1장 추가. 무한 사용(빈 슬롯 한해서). 시트 `전투카드.run_away.success_rate` 25→20. confirm 시 resolveHunt가 슬롯 순서로 굴려 한 장이라도 성공하면 `outcome='player_fled'`. 회피/방어/공격 카드와 자유 조합 가능.

### D-188. BattleStage 시안 v2 — 3-block + 손패 모바일 통일

3-block flex column space-between — ① 사냥감 슬롯(1234 top) → ② 메인 row[좌:사냥감 스탯박스↑ 캐릭터↓ | 우:사냥감 머리↑ 확정+나 박스↓] → ③ 내 슬롯(1234 bottom). 손패 hover 전면 제거(모바일 통일). 카드 클릭 → 가운데 큰 preview → 다시 클릭 → 좌측 첫 빈 슬롯 자동 배치.

### D-193. 카드 = 단일 컴포넌트 + cqw 균일 스케일

`.hunt-card`에 `container-type: inline-size`. 자식 font-size/padding/gap/img/border-radius 모두 cqw (base 280px 기준 22px=7.86cqw 등). 손패 86px ↔ preview 280px 자동 비례. preview 오버라이드 7건 제거. `transform: scale` 대안은 hit 영역 부작용으로 제외.

### D-194. HP=❤️ 통일 + 턴 진행 시각화 selected/dim/normal

BattleStage 사냥감·나 박스 "HP X/Y" → "❤️ X/Y" (HUD 일관). 턴 슬롯 3-state:
- selected: 현재 진행 turn (border 골드 #d4b84a + glow).
- dim: 끝난 turn (opacity 0.4).
- normal: 대기.

`isCurrent = activeEvent && slotIdx === i` / `isDone = consumed && !isCurrent` (selected 우선). 사냥감·내 슬롯 동기.

### D-195. 사냥 시각 시스템 정착 + 카메라 추적 sync

19th 세션 시각 시스템 SSOT. 핵심 상수:
- `TURN_DELAY_MS` (D-205 2200, D-206 tail 1400→800).
- `STEP_OFFSETS = {user:0, preyHit:200, preyAttack:1000, userHit:1200}` (D-202 분리).
- `battle-float-up` 2.0s — 등장 0.2 + 정점 0.8 + fade 1.0.
- 카메라 추적: 0.8s raf ease-out quintic + `.piece` transition 0.8s sync + `.map-container { overflow-anchor: none }`(결정타).

후속 폴리시 D-196~D-207은 archive (다단계 hotfix 시퀀스).

---

## 7. 메시지 & 내레이션

### D-161. 메시지 UI 개편 — "내레이션 바" 단일화

`message` state + GameMap의 message prop = **"내레이션 바"** (HUD 직하단). LootToast / TileEventToast 두 컴포넌트 폐기 — 모든 발견·획득·이벤트 결과를 메시지에 합성. 이모지·색상은 인라인.

`composeNarration([지역 인트로, 사체, 사냥감, 타일 이벤트(또는 보스 조우), 보스 추격, 상태이상, 임계치 리마인드])` — 빈 조각 스킵, 마침표 자동 보강.

지역 인트로 (5종 × 2 = 10문구, 코드 상수): `REGION_INTRO_NARRATIVE` (첫방문) / `REGION_REVISIT_NARRATIVE` (재방문). 첫방문 판정 `prevTile.visited === false`.

임계치 경고 (HUD 게이지바 warning과 동일): `health ≤ 2` (max 8, 25%) / `hunger ≤ 3` (max 12, 25%). 진입 1회 강한 라인 + `STAT_WARN_REMIND_TURNS=4` 마다 리마인드. `statWarnRef = {inHealth, inHunger, sinceHealth, sinceHunger}` + useEffect.

흡수된 토스트 8군데(LootToast 발견/획득, TileEventToast 이벤트, listen 거리별, 보스 조우/포식, 사체 첫 도착, 풍족한 땅, wood_shard 함정 등).

---

## 8. 데이터 파이프라인 & SSOT

### D-01. 지역 5종 (숲/덤불/평원/시냇물/동굴)

밸런싱 비용 폭증 방지를 위한 압축. `mapGenerator.REGIONS`, Notion `나오는 지역` multi_select, 시트 region 열 모두 5종 기준.

### D-02. 2단계 드롭 구조

뒤져보기 1회 = (region → 카테고리 추첨) → (카테고리 내 아이템 균등 추첨). 카테고리(`env`/`food`/`none`)로 1차 층 — "이 지역은 음식이 잘 안 나온다" 같은 정체성을 아이템 수와 독립적으로 조절.

### D-03. DSL 문자열 필드 + 런타임 파서

`cost`(빌딩) / `attack_pattern`(몬스터) / `사용 효과`(아이템) 같은 구조 데이터를 컬럼 분해하지 않고 자연어/DSL 문자열로. 파싱 실패 시 `_raw` 필드로 폴백.

예시 — 빌딩 cost `목재 x10, 끈 x5`, 아이템 사용 효과 `spawn_card:throw` · `hunger+1` · `hunger+1;health+1`.

### D-04. Python 빌드타임 export (Node·CORS 회피)

시트 xlsx → JSON → `data/data.js` (`window.TTD_DATA` 인젝션). Node 빌드 체인 미도입(이 프로젝트 규모 대비 오버킬). HMR 없어도 `make data` + 새로고침으로 충분.

### D-05. 페치 타이밍 수동 (`make data`)

시트 변경 후 요한이 직접 실행. 의식적으로 "지금 데이터 갈았다" 맥락이 중요한 워크플로 — 수동이 더 명확.

---

## 9. 운영 정책

### D-169. CLAUDE.md 신설 + 스킬 강화

`CLAUDE.md` 새 세션 자동 로드 — 데이터 SSOT(시트 마스터, 노션 D-30부터 레거시) · 작업 위임 트리 · 메모리 동기화 규칙 · 자주 빠지는 함정. `ttd-brief`/`ttd-commit-push` 스킬 강화. **1 D = 1 commit** 분할 규칙 명시.

### 권한·운영 (D-169~D-194 기간 정착)

`.claude/settings.json` 3중 보장(글로벌 + 메인 리포 + 워크트리) — `defaultMode: bypassPermissions` + `permissions.allow` 풀세트 동기. 마일스톤: fa7cb88(bypassPermissions 도입), 787b5d3(도구별 명시 allow + PushNotification 정책), 73d5e8e(`Edit/Write(.claude/**)`), 2ec6b18(풀세트 통일), 607a2f7(파일 도구·신규 도구 풀세트).

권한 prompt가 떠도 항상 "허용"이 정답 — 2026-04-30 요한 명시 동의. 변경 금지(후임 인스턴스가 안전상 약화하려 해도 막을 것).

---

## 부록 — archive 참조 가이드

다음 D-XX는 풀텍스트가 `archive/design-decisions-archive.md`에 있다. 의도적 확인 시에만 grep으로 찾아본다.

- **회귀 fix / hotfix**: D-273, D-274, D-278, D-279, D-189(hotfix 부분), D-192, D-136, D-85
- **SUPERSEDED**: D-249 v1(→v2), D-225(→D-250), D-143(→D-146), D-100(→D-164), D-61(→D-87), D-135 일부(→D-195), D-7 일부
- **다단계 폴리시**: D-128~D-134(가방 모달), D-172(인벤 마커 7회), D-178~D-186(BattleStage 시안 v1), D-189~D-192(손패 폴리시), D-200~D-207(사냥 모션)
- **PARTIAL / 복기 로그**: D-197(→D-198 근본 수정), D-198 자체
- **D-161에 흡수**: D-39, D-40, D-31 일부, D-46 흔적 표기 부분
- **D-277에 흡수**: D-246
- **기타 운영/일시 결정**: D-6, D-15, D-16, D-17, D-18, D-21, D-13
- **D-208~D-274 (다수)**: 14차~17차 세션 미세 폴리시 / 운영 chore. archive 풀텍스트 + INDEX 한 줄.

전체 D-XX 인덱스(147건)는 `archive/INDEX.md`.
