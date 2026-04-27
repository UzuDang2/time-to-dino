# design-decisions.md

요한·디렉터가 지금까지 내린 결정과 그 근거. 번복된 결정은 지우지 않고 **SUPERSEDED** 표기로 남긴다.
후임이 "왜 이런 구조지?"로 고민하지 않게 하는 것이 이 파일의 목적.

---

## D-137. '구운' 음식은 휴식 카드 → 요리 모달에서만 제작 (2026-04-27, `index.html`)

요한 원문: "언제부턴가 가방에서 곧바로 요리가 가능한 레시피가 보이고 있어, 가방에선 요리 가능한 레시피가 보일수는 있는데 휴식 카드를 써야지만 요리할 수 있도록 해야해" + "요리는 '구운' 이라는 키워드의 음식을 생성할 수 있는 카드야, 그리고 '구운' 이 붙은건 생명력도 채워지니 특별한 경로로만 만들 수 있어야해".

### 게임 디자인 원칙

- '구운' 키워드 음식 = `result.startsWith('grilled_')` (구운게살꼬치, 고기꼬치구이, 생선꼬치구이, 큰고기꼬치구이 등).
- 이들은 **생명력 회복** 효과가 있어 일반 꼬치보다 강력. 따라서 **특별 경로(휴식 카드 → 요리 모달)로만 제작 가능**.
- 가방 합성 패널에서는 카드 노출은 OK(레시피 미리보기) — 다만 만들기 버튼은 비활성 + 라벨 "🔥 휴식 필요".

### 결정

- `CraftPanel`에 `allowCooking` prop 추가 (기본 undefined=false).
- `recipe.result.startsWith('grilled_')` 판별 → `disabledReason = 'rest_required'`.
- `buttonLabel`에 `'🔥 휴식 필요'` 추가.
- 정렬 우선순위: 만들기 가능 → 휴식 필요 → 공간 부족 → 재료 부족.
- `InventoryModal`의 두 CraftPanel 인스턴스(craft-inline, craft-side) 모두 prop 안 넘김 → 기본 false → grilled 비활성.
- `CookingModal`은 자체 렌더(CraftPanel 미사용) → 기존 동작 유지, 휴식 카드에서만 호출.

### 효과

- 가방에서 음식 카테고리 탭 클릭 시 grilled 레시피 카드는 노출됨 (재료/결과 미리보기).
- 만들기 버튼은 회색 + "🔥 휴식 필요"로 우회 경로 안내.
- 휴식 카드의 [🔥 요리하기] → CookingModal에서만 실제 grilled 제작 가능.

---

## D-136. 단일 재료 변환 레시피가 합성 추천에서 누락되던 버그 수정 (2026-04-27, `inventory.js`)

요한 원문: "돌맹이 3개로 조합할 수 있는 뗀석기가 돌을 터치해도 조합법이 안보이는데 버그같아 보이게수정해줘".

### 원인

`InventorySystem.findRecipesContainingAny`가 ingredients의 unique type 수가 1이면 무조건 "머지형"으로 간주해 제외. stone×3 → chipped_stone(뗀석기)은 단일 재료지만 stone의 정의는 `mergeable: false`라 머지 시스템과 무관한 변환 레시피임. 잘못된 일반화로 누락.

### 결정

`uniq.size === 1`일 때 추가 가드:
- ingredient의 `def.mergeable === true` AND `def.merge_result === recipe.result`이면 진짜 머지형 — 제외 유지.
- 그 외(돌맹이 mergeable=false 또는 result가 merge_result와 다름)는 변환형 — 포함.

### 영향 범위

- 포함되는 레시피: stone×3 → chipped_stone 등 mergeable:false 단일 재료 레시피.
- 제외 유지: branch×2 → wood, stem×N → plant_fiber 등 자동 머지 시스템과 결과 일치하는 머지형(이미 자동 즉시 실행 경로에서 처리되므로 추천 패널 중복 노출 방지).

---

## D-135. 이동 시 부드러운 카메라 추적 (2026-04-27, `index.html`)

요한 원문: "유저가 이동하면 현재 속한 타일이 화면의 중앙으로 오도록 스크롤을 부드럽게 움직여주면 좋겠어, 1초 정도의 속도로. 기존의 화면을 움직이는 기능엔 영향없게 잘해줘".

### 결정

GameMap에 `currentTile` 변경 감지 useEffect 추가:
- 1초 동안 `easeInOutCubic`으로 `containerRef.scrollLeft/Top`을 타일 중앙으로 이동 (rAF 기반).
- 첫 mount는 D-47 `useLayoutEffect`가 instant 처리하므로 `isFirstCenterRef`로 skip.
- `prevTileIdRef`로 currentTile 실제 변경만 반응 — tiles 객체만 바뀐 상태 변경(휴식·사냥 등)에서는 trigger 안 함.
- 사용자 드래그/줌 시작 시 `centerAnimRef.cancel()` 호출 — `beginPan`/`onWheel`/`onTouchStart` 모두에 추가. 자유 조작 우선.
- zoom 좌표 보정: `cur.position.x * zoomRef.current - clientWidth/2` (SVG가 zoom 배수로 렌더링되므로).

### 왜 rAF + ease vs `scroll-behavior: smooth`

- CSS `scroll-behavior: smooth`는 모든 scroll에 적용 → 사용자 드래그/팬 손맛 손상.
- `scrollTo({ behavior: 'smooth' })`는 호출별 적용이지만 브라우저별 속도 다르고 1초 보장 안 됨.
- rAF + easeInOutCubic으로 정확히 1000ms 보장 + cancel 가능.

### 검증

- 이동 시 1초 동안 부드럽게 화면 중앙 추적.
- 추적 중 드래그/핀치/휠 시 즉시 멈추고 사용자 조작에 양보.
- 휴식·사냥 등 currentTile 안 바뀌는 상태 변경에서는 카메라 가만히 있음.

---

## D-134. 가방 모달 자체 스크롤 허용 + stage 추가 stretch (2026-04-27, `gameStyles.css` / `index.html`)

요한 원문: "편의를 위해 가방 ui창 전체의 스크롤도 좀 가능하게 해줘, 지금보다 가방 ui의 최대 길이가 좀 더 길어도 될것같아. 가로모드는 특히 아주 좀더 길어도 좋아".

### D-105 SUPERSEDED

D-105는 "가방 모달 자체 스크롤 차단, 합성 패널 내부만 스크롤"이었지만, 사용자 편의 우선으로 정책 뒤집음.

### 결정

- **`.modal-content.inventory-modal`**: `overflow: hidden` → `overflow-y: auto + -webkit-overflow-scrolling: touch`. 가방 모달 자체가 세로 스크롤 가능. panel 내부 scroll과 함께 이중 스크롤 — 어색하지 않게 panel maxHeight 한도 안에서는 panel scroll, 그 이상은 모달 scroll로 자연스럽게 흡수.
- **portrait `.inventory-stage max-height`**: `100dvh - 72px - safe` → `100dvh - 36px - safe` (top 12 + bottom 24). +36px 추가 길이.
- **portrait `.modal:has(.inventory-stage) padding-bottom`**: `60px + safe` → `24px + safe`. D-129가 도구바 가림 안전 여유로 60px 잡았지만, 자체 스크롤 허용으로 사용자가 스크롤로 해소 가능 → 24px로 축소.
- **landscape padding**: `top 12 / bottom 12` → `top 6 / bottom 6 + safe`. landscape `.inventory-stage max-height`: `100dvh - 24` → `100dvh - 12 - safe`. 사용자 "가로모드는 특히 아주 좀 더" 반영.
- **CraftPanel 인라인 `maxHeight`**: `40dvh` → `50dvh`. portrait에서 panel 가시 카드 ~5개 → ~6.5개. 자식 자연 크기 stage 초과 시 inventory-modal scroll 흡수.

### 트레이드오프

- 이중 스크롤(panel + 모달)은 일반적으로 UX 안티패턴이지만, 사용자가 명시적 요청. 한쪽 끝에 도달하면 다른 쪽으로 자연 전환 (iOS/Android 모두 잘 처리).
- panel 내부 sticky 헤더(D-127)는 panel scroll 컨텍스트 안에서만 동작. inventory-modal scroll로 panel 박스가 viewport 밖으로 나가면 sticky도 같이 사라짐 — 이건 자연스러움(panel 자체가 안 보이니까).

### 검증

- portrait/landscape 양쪽 가방 모달이 viewport 거의 가득 채우는지 확인.
- panel 카드가 panel 자체 스크롤 + 모달 스크롤로 모두 도달 가능 확인.

---

## D-133. landscape 전용 stage stretch — padding-bottom 12px (2026-04-27, `gameStyles.css`)

요한 원문: "가로모드시에 엄청 잘리는데? 디바이스 해상도에 맞게 상하 길이를 최대로 스트레치 해줘야지".

### 문제

D-129에서 portrait용으로 `.modal:has(.inventory-stage) padding-bottom: 60px + safe-area`를 도입. iOS Safari portrait의 도구바·시각 마진 확보 목적. 그러나 landscape에서는:
- viewport height가 작음 (iPhone Pro Max landscape ≈ 430dvh).
- 60px+safe ≈ 81px가 viewport의 19%를 잡아먹음.
- stage max-height calc(100dvh - 72px - safe) ≈ 337px만 남음 → CraftPanel 카드 3개 정도 + 다음 카드 일부만 보이고 잘림.

### 결정

`@media (orientation: landscape) and (min-width: 720px)` 블록에 portrait 룰 덮어쓰기:
- `.modal:has(.inventory-stage) padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px))` — landscape는 도구바가 좌우에 있고 하단 영역이 없으므로 12px 안전 여유면 충분.
- `.inventory-stage max-height: calc(100dvh - 24px - env(safe-area-inset-bottom, 0px))` — top/bottom 12px씩 차감.

### 효과

- iPhone Pro Max landscape (430dvh): stage max-height 337 → 406px (+69px). panel이 viewport 가까이 stretch.
- iPad Pro landscape (1024dvh): stage 952 → 1000px. 기존에도 충분했지만 추가 여유.
- panel 자체는 D-105 룰의 `max-height: none !important + height: 100% !important`로 craft-side에 stretch — 인라인 maxHeight 40dvh는 !important에 덮여 무시됨.

### 검증

- landscape에서 패널 상단/하단 viewport에 거의 가득 차고 카드 잘림 없음 확인.
- portrait는 D-129 padding 60px 유지 — iOS Safari 하단 도구바 영역 안전.

---

## D-132. CraftPanel — 하단 마진 16px + maxHeight 40dvh (2026-04-27, `index.html`)

요한 원문: "여전히 하단부가 잘리지만 전보다는 나아진듯, 근데 스크롤을 담아내는 패널과 그 부모인 가방 ui 전체의 패널간의 바텀 마진값이 없이 딱붙었네 마진 값 16px 정도 넣어줘".

### 결정

- CraftPanel 인라인 스타일 `marginBottom: '16px'` 추가 — panel과 inventory-modal 외곽 사이 시각 여유.
- `maxHeight: '45dvh'` → `'40dvh'` — marginBottom 16px가 자식 자연 크기 합에 추가되면 D-131에서 확보한 stage 여유(13px)를 잠식해 다시 압축 클리핑 발생. 미리 panel을 더 줄여 회귀 차단.

### 계산 (iPhone 14 Pro, dvh ≈ 850px)

- stage max-height: 850 − 72 − 34(safe-area) = 744px.
- inventory-modal 자식 자연 크기: 헤더 40 + grid 233 + 안내 20 + panel(40dvh = 340) + marginBottom 16 + modal-content padding 40 = **689px**.
- 744 − 689 = 55px 여유 → 압축·클리핑 없음.

### 검증 + 후속

- iPhone Pro급 화면에서 마지막 카드 완전 노출 + panel ~ inventory-modal 16px 마진 확인.
- iPhone SE(667dvh) 등 작은 화면은 40dvh도 부족할 가능성. SE 보고 들어오면 35dvh 또는 동적 flex 전환.

---

## D-131. CraftPanel maxHeight 55dvh → 45dvh — 부모 압축 클리핑 해소 (2026-04-27, `index.html`)

요한 원문: "큰고기꼬치구이 아래쪽이 안보이지? 스크롤이 맨아래로 내려와있음에도".

### 진짜 원인 (D-130까지의 panel 내부 padding 조정만으로 해결 안 됨)

레이아웃 체인 추적:
- `.inventory-stage` (column flex, max-height calc(100dvh-72px-safe) ≈ 760px on iPhone Pro)
  - `.inventory-modal` (block, 자식 자연 크기 stack, **overflow: hidden** by D-105)
    - 가방 헤더 (~40px) + grid (~233px) + 안내 (~20px) + padding 40px ≈ **333px**
    - `.inventory-craft-inline` → CraftPanel (maxHeight 55dvh ≈ **458px**)
    - 자식 자연 크기 합 ≈ **791px**.

stage max-height 760px < inventory-modal 자연 크기 791px → stage가 자식(inventory-modal)을 flex shrink로 ~31px 압축 → `overflow: hidden`에 의해 **panel 마지막 부분이 시각적으로 잘림**. panel 자체 scroll은 본인 maxHeight 55dvh 기준으로 동작 → "스크롤 끝까지 갔다"고 판단하지만 보이는 영역은 더 작아 마지막 카드가 안 보임.

### 결정

CraftPanel `maxHeight: '55dvh'` → `'45dvh'`. iPhone Pro 기준 458→374px. 자식 자연 크기 합 ≈ 707px ≤ stage 760px → 압축 없음 → overflow:hidden에 의한 클리핑 없음 → panel scroll bottom이 실제 panel viewport bottom과 일치.

### 왜 동적 flex(`flex: 1`) 대신 정적 dvh 축소

- 동적 해법(inventory-modal을 flex column으로 + craft-inline flex:1)은 더 정확하지만 inventory-modal 다른 자식들의 사이즈 가정과 D-105 overflow 정책을 모두 건드려야 해 회귀 위험 큼.
- 작은 화면(iPhone SE 667px dvh)에서는 45dvh = 300px. 가방 grid 등 333px + 300 = 633px ≤ stage 595px? 595px이라 약간 부족할 수 있음. 추후 SE 환경 검증 필요.

### 검증

- iPhone 14 Pro 시크릿 탭에서 panel scroll 끝까지 갔을 때 마지막 카드 완전 노출 확인.
- iPhone SE 등 작은 화면은 추후 보고에 따라 추가 축소(40dvh) 또는 동적 flex 전환 고려.

---

## D-130. CraftPanel — 내부 padding-bottom 24px (카드 리스트 끝 잘림 해소) (2026-04-27, `index.html`)

요한 원문: "iOS 환경에서의 문제가 아니라 도구바랑 이런 거랑 상관 없고 가방 UI 패널 자체가 스크롤을 담당하는 패널의 영역 안에 최 하단부에 목록이 잘려 보인다고 UI가 잘려 보이는 게 아니라 목록이 잘려 보인다고".

### 문제 재진단

D-128/D-129는 **외곽 모달 viewport 잘림**을 가정하고 dvh·safe-area·padding-bottom을 늘렸는데, 진짜 문제는 그게 아니었음. 사용자 정정:

- **모달 외곽은 잘리지 않음**.
- **CraftPanel 자체(스크롤 담당 패널) 내부**에서, 카드 리스트를 끝까지 스크롤해도 마지막 카드 한두 줄이 panel 하단에 가려져 보임.

원인 후보:
- panel 루트 padding 10px만으로는 sticky 헤더 wrapper 효과 + 모바일 momentum 스크롤 종료 위치 보정에서 마지막 카드가 panel viewport bottom 끝에 너무 빡빡하게 위치 → 시각적으로 잘려 보임.
- 또한 panel padding-bottom 10px만으로는 마지막 카드와 panel 테두리 사이 시각 마진이 부족.

### 결정

CraftPanel 루트 div `padding: '10px'` → `padding: '10px 10px 24px'`. panel 내부 하단에 14px 추가 padding 확보 — 스크롤 끝 마지막 카드와 panel 테두리 사이 24px 여유.

### 왜 panel 내부 조정인가

D-128/D-129처럼 모달 외곽을 키워봐야 panel 자체 내부 클리핑은 해결 안 됨 — 사용자도 명확히 "UI가 잘리는 게 아니라 목록이 잘린다"고 분리해서 지적. 외곽 마진은 D-129 60px로 유지(요한이 "최하단부와 가방 UI 전체 패널 간에 마진을 좀 줘"라고도 했으므로 그 요구 자체는 그대로). 추가로 panel 내부 padding을 키우는 것이 정확한 해결.

### 검증

- 시크릿 탭 가방 모달 → 합성 패널 끝까지 스크롤 시 마지막 카드 완전 노출 + 카드와 panel 테두리 사이 24px 여백 확인.

---

## D-129. 가방 모달 — 하단 여유 60px + 마지막 카드 잘림 해소 (2026-04-27, `gameStyles.css`)

요한 원문: "여전히 조합법 스크롤 최 하단 마지막 패널 1개 정도 사이즈는 완전히 잘려서 보여 그리고 전체 UI 사이즈 만큼 패널 스크롤이 최 하단부가 딱 맞아서 거슬려 최 하단부 와 가방 UI 전체 패널 간에 마진을 좀 줘 최 하단부 쪽에".

### 문제

D-128에서 `100dvh - 24px - safe-area`로 줄였지만:
- iOS Safari 하단 도구바(앞으로/뒤로/공유/탭/메뉴)는 dvh 계산에 정확히 반영 안 되는 케이스가 있음 — 마지막 카드 1개 정도 여전히 잘림.
- 모달 패널 최하단이 viewport 끝에 딱 맞아 시각적으로 거슬림 — 마진 필요.

### 결정

- `.modal:has(.inventory-stage) padding-bottom`: `calc(12px + safe-area)` → `calc(60px + safe-area)`. 하단 60px 마진 + home indicator.
- `.inventory-stage max-height`: `calc(100dvh - 24px - safe-area)` → `calc(100dvh - 72px - safe-area)`. 12px(top) + 60px(bottom) = 72px 차감.

### 왜 60px

- iOS Safari 도구바 자체 ≈ 44px. 그 위에 시각 마진 16px 추가 → 60px이 도구바도 가리고 마진도 확보.
- 더 줄이면(예: 36px) 마지막 카드 잘림이 다시 살아날 위험. 더 늘리면(예: 80px) 패널 자체가 너무 작아져 가시 카드 수 감소.

### 검증

- iOS Safari 시크릿 탭 가방 모달 → 합성 패널 끝까지 스크롤 시 마지막 카드 완전 노출 + 패널 하단과 viewport 끝 사이 60px 마진 확보 확인.

---

## D-128. 가방 모달 — viewport 잘림 + iOS safe-area 보정 (2026-04-27, `gameStyles.css`)

요한 원문: "스크롤의 최하단 패널이 잘려 최대로 내렸거든?" (D-127 sticky 고정 후에도 craft panel 마지막 카드가 viewport 밖으로 잘림 — iOS Safari 시크릿 탭 스크린샷).

### 문제

D-126에서 `.inventory-stage { max-height: 92dvh }`로 줄였지만 padding 합산이 viewport를 초과:
- `.modal:has(.inventory-stage)`: `padding-top: 12px`, `padding-bottom: 0`.
- `.inventory-stage`: `max-height: 92dvh` (= 100dvh의 92%).
- 합계: `12px + 92dvh ≈ 100dvh + 8dvh` → stage 끝이 viewport bottom 아래로 약 8dvh 잘림.
- 추가로 iOS home indicator 영역(`safe-area-inset-bottom ≈ 34px`)도 고려 안 됨.

### 결정

- `.inventory-stage { max-height: calc(100dvh - 24px - env(safe-area-inset-bottom, 0px)) }` — 24px는 modal padding-top 12 + padding-bottom 12 합계.
- `.modal:has(.inventory-stage) { padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)) }` — home indicator 위 여유.

### 왜 calc + env

- `92dvh` 같은 비율은 viewport 크기와 무관하게 padding 합산을 못 맞춤. 절대 단위 차감(`100dvh - 24px`)이 정확.
- `env(safe-area-inset-bottom)`은 iOS Safari에서 home indicator 높이 자동 반영. 데스크톱·non-iOS는 0px fallback.
- `calc()` 안에 `env()` 중첩은 모든 모던 브라우저 지원.

### 검증

- iOS Safari 시크릿 탭에서 가방 모달 → 합성 패널 최하단까지 스크롤 시 마지막 카드 잘리지 않고 끝까지 노출 확인.
- landscape는 `.inventory-stage`가 row 방향이므로 max-height 줄이는 영향 동일하게 적용 (정상).

---

## D-127. CraftPanel — 헤더·카테고리 탭 sticky 고정 (2026-04-27, `index.html`)

요한 원문: "세로화면에서 카테고리 탭이 스크롤안에 포함되어있어 근데 그럼 안돼 스크롤을 내려도 탭은 보여야 하거든".

### 문제

`CraftPanel` 루트 div가 `overflowY: auto + maxHeight: 55dvh`. 내부 헤더("🔨 만들 수 있는 조합" + 닫기)와 카테고리 탭(전체/음식/무기/방어구/재료)이 카드 리스트와 같은 스크롤 컨텍스트에 있어 스크롤하면 같이 사라짐. 카테고리를 바꾸려면 매번 위로 다시 올려야 함.

### 결정

헤더 + 카테고리 탭을 하나의 wrapper로 묶고 `position: sticky, top: -10px` 적용. 음수 top과 `margin: -10px -10px 0`로 패널 padding 영역까지 덮어 카드가 스크롤되어 들어와도 wrapper 배경(`#0f1a2e`)에 가려짐. zIndex:2로 카드보다 위.

### 왜 sticky / 왜 flex column 분리가 아닌가

flex column + 내부 카드 영역만 overflow:auto 방식도 가능하지만:
- D-105 `.inventory-craft-side > div { overflow-y: auto !important, height: 100% !important }`가 landscape에서 루트에 강제 적용 → flex 자식 overflow와 충돌해 이중 스크롤 발생 위험.
- sticky는 루트 overflow:auto 구조를 그대로 유지하면서 자식만 고정하므로 portrait/landscape 양쪽 호환.

### 부수 변경

- 헤더 div의 `marginBottom: '8px'` → `showCategoryTabs ? '8px' : 0` (탭 없을 때 헤더 단독 시 불필요한 여백 제거).
- 탭 div의 `marginBottom: '8px'` 제거 — sticky wrapper의 `paddingBottom: 8px`가 카드 리스트와의 spacing 담당.

---

## D-126. 가방 모달 — 그리드 중앙 정렬 + 모달 dvh 고정 (2026-04-27, `index.html` / `gameStyles.css`)

요한 원문: "가방에서 상단부를 이루는 슬롯부분이 중앙 정렬 아닌게 거슬리고, 하단에 창이 잘려서 싫어" (모바일 iOS Safari 5G 환경 스크린샷 첨부).

### 문제

1. **그리드 좌측 치우침**: `.inventory-grid`는 5×45px 고정폭(약 240px). 부모 `<div style="position:relative">`에는 폭 지정이 없어 모달(`max-width: min(92vw, 760px)`)의 좌측 정렬을 그대로 받음 → 우측에 큰 빈 공간.
2. **하단 잘림**: portrait 모달은 `.inventory-stage { max-height: 92vh }` + `CraftPanel { maxHeight: 55vh }`. iOS Safari `vh`는 주소창이 차지한 영역까지 포함한 "이상화 viewport" 기준이라 실제 보이는 영역을 초과 → 합성 패널 마지막 1~2 항목이 화면 밖으로 잘림. D-118에서 메인 레이아웃은 이미 `100dvh`로 옮겼지만 가방 모달은 `vh`로 남아 있었음.

### 결정

- `index.html` `InventoryModal` — `<div style={{ position: 'relative', width: 'fit-content', margin: '0 auto' }}>`로 wrapper에 fit-content + auto 마진 추가. 절대 위치 자식(`.inventory-item`, `.inventory-preview`, floating)들은 wrapper 기준으로 좌표 잡으므로 같이 중앙으로 따라옴.
- `gameStyles.css` `.inventory-stage { max-height: 92dvh }` — 92vh → 92dvh.
- `index.html` `CraftPanel` 인라인 스타일 `maxHeight: '55dvh'` — 55vh → 55dvh.
- `gameStyles.css` `.modal:has(.inventory-stage) { padding-top: 12px }` — 24px → 12px (상단 여백 절반 줄여 합성 패널에 12px 추가 확보).

### 왜

- **fit-content 중앙 정렬**: grid에 `margin:auto` 직접 주려면 grid 자체에 폭이 정의돼야 하는데(이미 column 합산으로 정의됨) absolute 자식들이 grid 외부에 있어 기준이 어긋남. wrapper에 fit-content 주는 게 가장 침습 없는 방법 — 좌표계 그대로 유지.
- **vh → dvh**: D-118과 일관성. dynamic viewport는 모바일 크롬·사파리에서 주소창 펼침/접힘 둘 다 정확.
- **padding-top 24→12**: 전체 모달 가용 높이를 12px 늘림. 12px는 손가락 탭 안전 영역 확보하면서 합성 패널 마지막 행을 화면에 들어오게 함.

### 검증

- iOS Safari 5G 환경(요한 스크린샷 기기)에서 강제 새로고침 후 가방 그리드 좌우 균등 + 합성 패널 마지막 행("물고기꼬치 → 생선꼬치구이" 이하)까지 자연 스크롤로 도달.
- landscape는 변경 없음 — `inventory-stage`가 `flex-direction: row`로 다른 룰 적용, max-height만 dvh로 바뀜(영향 없음).

---

## D-110. 런 점수 시스템 + 전리품 결과창 + 이동거리 점수 (2026-04-24, `index.html` / `gameStyles.css`)

요한 원문(요지): 런 종료 시 점수를 산출해 보여주고, 전리품을 직접 골라 캠프로 가져갈 수 있어야 한다. 시간 잔여 점수는 모호하니 **이동거리(직접 밟은 고유 타일 수)** 기반으로 바꿔라. 캠프에서 누적 점수도 보이게.

### 결정

#### A. `calculateRunScore` (순수 함수)

`{ victory, uniqueTilesVisited, detection, items, runStats, selectedItems }` → score.

- victory=false → 0 (사망은 점수 무효).
- 생존 100 + `uniqueTilesVisited × 3` + (detection<80 ? 30 : 0).
- runStats: L1 prey ×5, L2 prey ×20, 보스 위협권(거리≤2 진입) ×15.
- 자원: 무기 5, shield/armor 8, grade 1/2/3 → 1/3/6.
- selectedItems가 배열이면 그것만, null이면 items 전체로 자원 점수 산출.

근거: 시간 잔여는 "남으면 좋은데 굳이 일찍 갈 필요?"라는 모호함을 만든다. 이동거리는 탐험의 본질(맵을 더 본다 = 더 본다)을 직접 보상.

#### B. `runStats` 추적 (Game 컴포넌트)

`{ l1PreyKills, l2PreyKills, bossDangerEntered }`.

- 사냥 victory 분기에서 prey.level 보고 +1.
- moveTo 직후 `boss.calculateDistance(target, boss.position) ≤ 2` 시 +1. `bossDangerFlag` ref로 동일 진입 중복 카운트 방지.

#### C. `LootResultScreen` (신규)

- 8x12 인벤 그리드 시각, items.x/y/shape 그대로 배치. 셀 탭 = 선택/해제.
- 초기값: 모든 items 선택. selectedIds 변동 시 점수 실시간 재계산(자원 점수만 변동).
- 헤더 우측 ScoreBadge — 점수 + 산출 항목 미니 리스트.
- [전부 챙기기] / [선택만 챙기기] / [취소].

근거(옵션 B 채택): 전리품 결과창의 본질은 "선택 = 점수 변동" 시각화. 정적 점수만 보면 의미 반감.

#### D. `GameEndModal` 확장

- 승리 시 ScoreBadge(전체 인입 기준) + [📦 전리품 확인] 버튼 노출.
- 사망 시 점수·전리품 버튼 모두 미노출.
- showPathView OR showLoot면 모달 자체 숨김.
- 기존 [🏕️ 베이스캠프로 귀환]은 전체 자동 인입(LootResult 안 거치고 바로 나가도 손해 없음).

#### E. `campState.runs` 확장 + CampScreen 통계

- runs에 `bestScore`, `totalScore`, `lastScore` 추가. serializer/deserializer 마이그레이션 — 기존 키 없으면 0.
- handleRunEnd에서 인입할 itemsToTransfer 기준으로 점수 산출 → bestScore=Math.max, totalScore+=, lastScore=score.
- CampScreen: runs.total>0이면 score-badge 통계(최고/누적/평균/마지막 런).

### 변경 파일

- `index.html`: calculateRunScore, ScoreBadge, buildScoreBreakdown, LootResultScreen 신규. GameEndModal/Game/App/CampScreen 확장.
- `gameStyles.css`: `.score-badge`, `.score-badge .score-value/.score-row/.lbl`, `.loot-item.selected`.

### 검증

- babel transform PASS.
- 단위 검산: 승리 / uniqueTiles=20 / detection=70 / L2 ×1 / 자원 1단계×3 + 2단계×2 → 100 + 60 + 30 + 20 + 3 + 6 = **219** PASS.
- 브라우저 E2E: 후속(요한 QA — pending).

### 후속 / 알려진 한계

- 점수 균형은 첫 이터레이션. L1/L2/보스 가중치 비율은 플레이 후 튜닝 필요.
- 전리품 결과창은 인벤 그리드만 보여줌 — 항목별 이름/점수 기여를 cell hover 등으로 노출하면 더 직관적(추후).

---

## D-108. 사냥감 행동 풀 SSOT 분리 + 종별 특수공격 도입 + HuntModal 회피 표시 정리 (2026-04-24, `사냥감행동` 시트 / `combatDeck.js` / `index.html`)

요한 지시: 사냥감 turn 토큰을 4가지(attack/defend/evade/peek)에 가두지 말고, 시트의 행동 풀에서 골라 쓰는 구조로. 종별 특수공격 도입. HuntModal 슬롯에 행동명·수치 배지 + 회피 1 이상일 때만 회피 노출.

### 배경

- 기존(D-95~D-102): prey.actions_per_turn은 4가지 타입 토큰만 허용. resolveHunt가 toggle 식 분기로 동작.
- 한계: prey 종마다 동일한 'attack' 데미지(prey.attack 필드 단일치). 시각적·기획적 다양성 부족 — 토끼 발차기 vs 멧돼지 어금니 돌진이 같은 '공격'으로 취급.
- HuntModal 회피 슬롯에 `peek/attack/defend`도 "회피 0%" 표시되는 게 어색.

### 변경

#### A. 새 시트 탭 `사냥감행동` (행동 풀 SSOT)

헤더: `id, name, type, damage, accuracy, defense, description`. 20행 — 기본 4(attack/defend/evade/peek) + 종별 특수 16.

- 산출: `data/prey_actions.json` + `TTD_DATA.PREY_ACTIONS`.
- 종별 특수 일례:
  - L1: kick(토끼), nibble(쥐), acorn_throw(다람쥐), peck(메추라기새), slime_lash(도롱뇽), venom_bite(뱀, acc 2), tongue_lash(개구리), pinch(게), kick_jump(메뚜기).
  - L2: tusk_charge(멧돼지, dmg 3), pounce_bite(공룡, dmg 2 acc 1), gore(사슴, dmg 3 acc 1), frenzy_claw(오소리, dmg 2), feint_strike(여우, dmg 2 acc 2), wing_slap(큰 새, dmg 2), iron_curl(아르마딜로, defense 3).

#### B. 사냥감 시트 turn 셀 종별 특수 패치

L1은 마지막 턴이 종별 특수공격, L2는 1~여러 턴에 분산.

#### C. `combatDeck.js`

- `findPreyAction(id)`: TTD_DATA.PREY_ACTIONS에서 id 매칭. 못 찾으면 id 자체를 type으로 보고 기본값(damage/accuracy/defense=0).
- `resolveHunt`: 턴별 `actionDef = findPreyAction(token)`. 다음 일반화 적용:
  - 공격 데미지: `actionDef.damage > 0 ? actionDef.damage : prey.attack` (폴백).
  - 방어 감쇄: `actionDef.defense > 0 ? actionDef.defense : prey.defense` (폴백).
  - prey 명중: `actionDef.accuracy > 0 ? actionDef.accuracy : prey.attack_accuracy` — `cardEvade > preyAttackAccuracy`이면 회피 성공. (feint_strike acc 2는 dodge evade 1 무력화.)
  - turns[] 라벨: `preyAction = actionDef.name`(예: "어금니 돌진"), 분기용으로 `preyActionType` 함께 반환.
- `parsePreyActions`: 토큰 화이트리스트 제거 — lowercase 그대로 통과(특수 id 허용).

#### D. `HuntCombatModal` (index.html)

- `slotActions[i] = findPreyAction(...)` — 슬롯 렌더에서 actionDef.name 직접 표시.
- type별 배지: attack에 🗡️+dmg / 🏹+acc, defend에 🛡️+def, evade에 EvadeBadge.
- **회피 1 이상일 때만** 회피 배지 노출 — `type === 'evade' && finalEvade > 0`.
- peek/attack/defend 슬롯에서 "회피 0%" 표시 제거.
- 턴 로그 분기: 한글 라벨 매칭(`log.preyAction === '공격'`) → `log.preyActionType === 'attack'`. 액션명은 `log.preyAction`을 그대로 표시.

### 의도

- 행동을 시트의 1차 데이터로 격상해 디자인 변동 비용 최소화 — 기획자가 셀만 수정.
- 종별 특수공격으로 사냥 단조로움 해소: 멧돼지 첫 턴 어금니 돌진(dmg 3), 여우 첫 턴 기만 일격(dmg 2 acc 2 — dodge 무력화).
- HuntModal UX: 어색한 "회피 0%" 제거, 행동명을 슬롯에 직접 보여 대응 결정 직관화.

### 검증

- `make data` → `data/prey_actions.json` 20행, prey.json `actions_per_turn`이 종별 특수 id 포함.
- Node 스모크: tusk_charge dmg=3, iron_curl defense=3, feint_strike(acc 2) dodge(evade 1) 관통, wing_slap(acc 0) dodge 차단 — 모두 PASS.
- 브라우저 검증은 후속(요한): HuntModal에서 어금니 돌진 슬롯 🗡️+3 / 🏹+1, peek 슬롯 라벨만, evade 슬롯에서 회피 배지.

---

## D-102. L1 사냥감 evade 수치 1로 통일 (2026-04-26, 14th 세션, `data/prey.json`)

요한 원문: "이미지에 제시된 사냥감 모두 회피, 회피, 회피야. 거기다가 수치도 너무높아. 규칙대로해야지"

### 배경

- D-98 규칙: peek≤2 / evade≤1 / defend≤1 (3턴). actions_per_turn 패턴은 이미 반영.
- 그러나 evade_per_turn 수치는 옛 차등 그대로(메뚜기 "3,3,2" / 토끼·다람쥐·새·개구리 "2,2,1" 등). evade 턴의 회피값이 과대.
- D-96 결정론(명중 ≥ 회피 → 명중)에서 새총 명중 1 < 메뚜기 회피 3 → 잡을 수 없음.

### 변경 (`prey.json`)

L1 9종 모두 `evade_per_turn = "1,1,1"`, `evade_rate = 1`로 통일.

| ID | before evade_per_turn | after |
|---|---|---|
| rabbit | 2,2,1 | 1,1,1 |
| mouse | 1,1,1 | 1,1,1 (변경 없음) |
| squirrel | 2,2,1 | 1,1,1 |
| bird | 2,2,1 | 1,1,1 |
| salamander | 1,1,1 | 1,1,1 (변경 없음) |
| snake | 1,1,1 | 1,1,1 (변경 없음) |
| frog | 2,2,1 | 1,1,1 |
| crab | 1,1,1 | 1,1,1 (변경 없음) |
| grasshopper | 3,3,2 | 1,1,1 |

### 의도

- evade≤1 규칙을 횟수 + 수치 두 측면에서 모두 적용.
- L1 사냥감 차등은 actions_per_turn 행동 패턴(예: peek,peek,evade vs peek,defend,evade)과 hp/meat로 표현. 회피값 자체의 수치 차등 폐기.
- D-96 정수 결정론에서 acc 0(주먹/뗀석기 치기)는 evade 1 못 뚫음, acc 1(돌·새총·뗀석기 던지기·창 찌르기)는 evade 1 정확 명중. 깔끔한 진입 장벽.

---

## D-101. 유저 회피 시스템 — dodge 카드 evade=1 (2026-04-26, 14th 세션, `data/combat_cards.json` / `combatDeck.js` / `index.html`)

요한 원문: "내 회피하기가 75%야, 나의 회피는 1로 지정해줘"

### 배경

- 기존 `dodge` 카드: damage 0, success_rate 75, accuracy 0, defense ""(없음). 실제 회피 로직 없어 사실상 빈 카드(prey attack 그대로 받음).
- D-96 정수 결정론(명중≥회피→명중)을 유저 회피 측에도 대칭 적용 — 카드 evade 정수 vs prey attack_accuracy 정수.

### 변경

- `combat_cards.json` `dodge`:
  - `success_rate: 75 → 100` (D-96 결정론).
  - `evade: 1` 신규 필드.
- `combatDeck.js::resolveHunt::takeDamageThisTurn`:
  - `cardEvade = Number(card.evade) || 0`, `preyAttackAccuracy = Number(prey.attack_accuracy) || 0`.
  - prey가 attack 행동일 때 `cardEvade > preyAttackAccuracy`면 0 데미지(회피 성공).
- `index.html` `StatBadges`: `evade` 필드 표시(💨+N, #d4b84a). 손패/슬롯 카드에 회피 1 배지 노출.
- `STAT_ICONS.evade = '💨'`, `STAT_COLORS.evade = '#d4b84a'` 신설.

### 동작

- 모든 L2 prey의 attack_accuracy 미정의(=0). dodge 카드(evade 1)가 attack 턴에 배치되면 1 > 0 → 100% 회피. 향후 prey에 `attack_accuracy: 1` 추가 시 dodge 무력화 가능 — 확장 여지 유지.
- success_rate 100으로 카드 자체 발동은 결정론.

### 시트 SSOT

- 다음 로컬 세션: `전투카드.회피하기.success_rate=100` + `evade=1` 컬럼 동기화.

---

## D-100. 새총 데미지 3 → 2 (2026-04-26, 14th 세션, `data/combat_cards.json`)

요한 원문: "새총 대미지 2로 수정해줘"

### 변경

- `slingshot_shot` damage 3 → **2** (accuracy 1, success_rate 100 유지).

### 의도 (추정)

- D-99에서 뗀석기 던지기(damage 3, accuracy 1, 100% 분실)가 도입되며 새총(이전 damage 3, acc 1, 돌맹이 별도 소비)과 동급이 됨. 새총 너프로 무기 위계 분리:
  - 뗀석기 던지기 dmg 3 (1회용·전부 분실)
  - 새총 dmg 2 (돌맹이 1개 소비, acc 1, 반복 사용)
  - 뗀석기로 치기 dmg 2 (acc 0, 1차감)
- L1 사냥감 hp 분포(메뚜기 1, 게/쥐 2, 다람쥐/도롱뇽/뱀/새/개구리 3, 토끼 4)에서 새총 dmg 2 + acc 1은 여전히 hp 2~3 사냥감 1발 처리 가능.

### 시트 SSOT

- 다음 로컬 세션에서 `전투카드.새총 쏘기.공격력 = 2` 동기화 필요(D-97/D-99 미반영분과 합쳐서).

---

## D-99. 새 무기 뗀석기 + 치기·던지기 카드 (2026-04-25, 13th 세션, `data/combos.json` / `data/weapons.json` / `data/items.json` / `inventory.js` / `data/combat_cards.json`)

요한 원문: "새로운 아이템 돌맹이 3개로 뗀석기 만들수 있게 해줘, 내구도 3로 해줘 무기로 등록하고 공격키드 생성하는데 공격력 2, 명중은 없음, 뗀석기 던지기 카드도 생성하고 공격력 3, 명중1. 사용 시 뗀석기 잃어버림."

### 데이터

- **합성**: `combos.json` `["stone","stone","stone"] → "chipped_stone"`. (combos는 같은 재료 다중 허용 — `["berry","berry"]` 패턴.)
- **무기 메타** (`weapons.json`):
  - id `chipped_stone`, name `뗀석기`, 카테고리 무기, 1단계, 내구도 3, 공격력 0, accuracy 0.
  - 가방칸수 2x1, 무게 1 (요한 후속 지시 — 1x1 → 2x1로 변경. 나무창과 동일 폭).
- **아이템 메타** (`items.json`): slingshot과 동일 패턴(카테고리=무기, mergeable=false, effect.usable=false), 가방칸수 2x1.
- **static ITEMS** (`inventory.js`): `chipped_stone: { shape: [[1, 1]], grade: 1, mergeable: false, category: '무기' }`. shape는 weapons.json에 없으니 여기서만 정의(SSOT 분리는 D-47 이후 관례).

### 카드 (`combat_cards.json`)

- `chipped_stone_strike` (뗀석기로 치기): damage 2, success_rate 100, requirement "뗀석기", accuracy 0, full_loss "N".
- `chipped_stone_throw` (뗀석기 던지기): damage 3, success_rate 100, requirement "뗀석기", accuracy 1, full_loss "Y". → 1회 사용에 무기 분실(D-50 fullLoss 시 내구도 전부 차감).

### 디자인 의도

- **뗀석기 정체성**: stone×3로 만들어지는 가장 원시적인 무기. 내구도 3 = 치기 3회 또는 던지기 1회.
  - 치기: 안정적 근접 공격 (acc 0 → evade 0 사냥감만 명중. peek/defend 턴에 유효).
  - 던지기: 강력한 일격 (acc 1로 evade 1까지 뚫음, dmg 3) 대신 전부 잃음.
- **무기 격차 채우기**: 새총(돌맹이 별도 소비, dmg 3 acc 1)과 나무창(stab dmg 4 acc 1, throw dmg 6 acc 2 / 50% 분실) 사이의 초기 무기.
  - stone만 있으면 만들 수 있어 진입 장벽 낮음.
  - throw_spear(50% 분실)와 달리 chipped_stone_throw는 100% 분실 — 명중 1로 격차 보존.

### 검증 (Node 스모크)

- 토끼+치기/치기/던지기 → T1 dmg 2 / T2 dmg 1(def-1) / T3 dmg 3, weaponUsage `used:3 broken:true fullLossCount:1 durability:0` ✓.
- 메뚜기+던지기 단독 → T1 dmg 3 즉살, weaponUsage `used:3 broken:true fullLoss:1` ✓.
- 토끼+치기 단독(슬롯 1개) → weaponUsage `used:1 broken:false durability:2` ✓.

---

## D-98. L1 사냥감 행동 패턴 도입 (2026-04-25, 13th 세션, `data/prey.json` / `combatDeck.js` / `index.html`)

요한 원문: "1단계 사냥감들 패턴을 눈치보기는 최대2회, 회피는 최대 1회, 방어는 최대1회로 제한하여 3턴을 구성하는데. 사냥감들에 따라 너의 판단으로 적절히 구성해면 좋겠어. 예를들어 토끼는 회피 회피 회피 였는데 이렇게가 아니라. 토끼는 좀 재빠르니까 눈치보기, 방어, 회피 이런식으로 구성해봐"

### 배경

- D-75에서 L2에 도입한 `actions_per_turn` DSL(attack/defend/evade/peek)이 L1에는 미적용 — L1은 모든 턴 'evade' 고정.
- 결과: L1 사냥감별 개성이 evade_per_turn 수치로만 표현 → 모든 사냥감이 "회피만 하는" 단조 행동.
- 요한 의도: L1도 행동을 **3턴** 구성으로 다채롭게. 단 규칙 — peek≤2 / evade≤1 / defend≤1.

### 가능한 multiset 조합 (3턴)

- (peek=2, evade=1) — 잠잠 → 도망형
- (peek=2, defend=1) — 잠잠 → 방어형
- (peek=1, evade=1, defend=1) — 살핌 → 방어 → 도망 (가장 풍성)

### 사냥감별 패턴 — 컨셉

| ID | 이름 | evade_rate | actions_per_turn | 컨셉 |
|---|---|---|---|---|
| rabbit | 토끼 | 2 | peek,defend,evade | 두리번 → 웅크림 → 도약 (요한 예시) |
| mouse | 쥐 | 1 | peek,peek,evade | 잰걸음 살피다 도망 |
| squirrel | 다람쥐 | 2 | peek,evade,peek | 살핌 → 휙 점프 → 다시 살핌 |
| bird | 메추라기새 | 2 | peek,peek,evade | 경계 → 경계 → 날아오름 |
| salamander | 도롱뇽 | 1 | peek,evade,defend | 살핌 → 슬그머니 → 잎새로 숨음 |
| snake | 작은 뱀 | 1 | peek,defend,evade | 노려봄 → 똬리 → 미끄러짐 |
| frog | 개구리 | 2 | peek,evade,peek | 가만히 → 점프 → 가만히 |
| crab | 게 | 1 | peek,defend,evade | 살핌 → 집게 방어 → 옆걸음 |
| grasshopper | 메뚜기 | 3 | peek,peek,evade | 가만히 → 폭발적 점프 |

### defense=1 일괄

- L1 9종 모두 `defense: 1`. 작은 사냥감이라 1로 통일 — 데미지 1짜리 카드(주먹)는 0 차감, 데미지 2짜리(돌)는 1만 통과, 데미지 3+(새총·창)는 의미 있게 통과.
- 요한이 게 등껍질 등 종별 차등을 명시하지 않아 일관성 우선. 추후 피드백 시 조정.

### 코드 변경

- `combatDeck.js::parsePreyActions`: fallback을 `lvl === 2 ? ['attack','evade','attack','peek'] : ['peek','evade','peek']`로 분기.
- `combatDeck.js::resolveHunt`:
  - `const preyActions = isLevel2 ? parsePreyActions(...) : null` → `parsePreyActions(...)` (무조건 호출).
  - `const preyActionRaw = isLevel2 ? preyActions[t] : 'evade'` → `preyActions[t]`.
  - `if (isLevel2 && (peek/attack/defend))` → `if (preyActionRaw !== 'evade')` (회피 0 가드 일반화).
  - `defenseReduction = (isLevel2 && preyActionRaw === 'defend') ? preyDefense : 0` → `(preyActionRaw === 'defend') ? preyDefense : 0`.
- `index.html::HuntCombatModal::preyActions`: `if (SLOT_COUNT !== 4) return null` 가드 제거 + 동일한 lvl 기반 fallback. 적 행동 슬롯의 peek/defend/evade 라벨·수치 배지 L1에도 자동 노출.

### 검증 (Node 스모크)

- 토끼+주먹×3 (peek/defend/evade) → T1 hit 1 / T2 hit 0(def-1) / T3 회피 → finalHP 3.
- 토끼+주먹/주먹/새총 → T3 새총 acc 1 ≥ evade 1 → hit 3 → hp 0 victory.
- 메뚜기(hp 1)+주먹×3 → T1 peek hit 1 → 즉살.
- 작은 뱀+돌×3 → T2 defend 2-1=1 → hp 0 victory.

### 정수 시스템 정합성

- D-96의 결정론(명중 ≥ 회피 → 명중) + D-98 peek=무방비(evade 0)는 자연스럽게 결합 — peek 턴은 acc 0 카드(주먹)도 100% 명중.
- evade 턴에서 acc 0 카드가 무력해지므로(주먹은 메뚜기·다람쥐 evade 못 뚫음) 무기·새총의 가치가 부각됨.

### SUPERSEDES

- 코드 주석/메모리에서 "L1: 모든 턴 'evade' 고정" 표현은 D-98 이후 무효.

---

## D-97. 무기 카드 명중·데미지 재조정 + 창던지기 확률 분실 (2026-04-25, 13th 세션, `data/combat_cards.json` / `combatDeck.js` / `index.html`)

요한 원문: "새총의 명중을 1로 조정해줘, 창찌르기도 1로, 창 던지기는 2인데 특수규칙으로 창던지기는 50%확률로 창을 잃어버릴수 있다고 적어줘, 창던지기시 대미지는 6"

### 카드 수치 변경

- `slingshot_shot` (새총 쏘기): accuracy 3 → **1**.
- `stab_weapon` (창으로 찌르기): accuracy 3 → **1**.
- `throw_spear` (창던지기): accuracy 3 → **2**, damage 4 → **6**, full_loss "Y" → "N", **loss_chance: 50** (신규).

### 신규 필드: `loss_chance`

이전 `full_loss="Y"`는 100% 무기 손실. 요한이 "50% 확률로 잃어버릴수 있다"로 수정 → 확률 손실을 일급 표현으로 신설.

- `combat_cards.json` 카드 객체에 `loss_chance: 0~100` 필드.
- 0/없음 = 비손실, 100 = 항상 손실, 그 외 = 매 사용 시 그 % 확률.
- `full_loss="Y"`와 공존 (Y가 우선, 100%로 강제).
- 시트 SSOT 동기화는 다음 로컬 세션 작업 — 시트 `전투카드` 탭에 `loss_chance` 컬럼 추가 필요.

### 판정 (combatDeck.js::resolveHunt)

```js
const fullLoss = String(card.full_loss || '').toUpperCase() === 'Y';
const lossChance = clamp(0, 100, Number(card.loss_chance) || 0);
const probLoss = !fullLoss && lossChance > 0 && (Math.random() * 100 < lossChance);
recordWeaponUse(card.weaponId, fullLoss || probLoss);
```

`recordWeaponUse(wid, true)`는 기존 동작 그대로 — `durabilityLeft = 0` + `fullLossCount += 1` + `broken=true`. `consumeWeaponUse` (인벤 측)가 사후 정리.

확률 부분만 결정론에서 예외 — 무기 분실은 본질적으로 random이고 D-96 결정론(회피·명중 판정)과 직교.

### UI 표기

- 손패/슬롯 카드 카드에 `⚠ 100% 분실` 또는 `⚠ N% 분실` 작은 라인 (#ff9999, fontSize 10).
- StatBadges/EvadeBadge와 별도 행. 내구도 라인 아래.
- 요한 원문 "분실할수 있다고 적어줘" 응답.

### Node 스모크

- throw_spear 1000회 시뮬 → 분실 513회 (~51%, 기대 50% ±). ✓
- 시트 동기화 시 `loss_chance` 컬럼이 비어있으면 0으로 처리 (default).

### 영향 범위

- `data/combat_cards.json` 3카드 + `data/data.js` 재생성.
- `combatDeck.js::resolveHunt` weapon use 블록.
- `index.html` HuntCombatModal 손패 카드 + 슬롯 카드 분실 안내 라인.
- inventory.js / fetch_data.py 무변경 (다음 시트 동기화 시 fetch_data에 loss_chance 캐스팅 추가 필요 — 현재 sheet에 컬럼 없음).

---

## D-96. 회피율/명중률 % → 회피/명중 정수 시스템 통일 (2026-04-25, 13th 세션, `combatDeck.js` / `data/prey.json` / `data/combat_cards.json` / `index.html`)

요한 원문: "회피율이라는게 넘 어렵고 계산도 복잡해지능거 같아. 회피율은 모두 회피라는수치로 통일하자. 그에 대응하는 명중률도 명중이라고 통일하자 어떤 개념이냐면 회피2는 명중2가 붙은 공격으로 상쇄할수 있다. 만약 회피가 명중보다 높르면 무조건 회피하고 명중은 값이 같거나 높으면 무조건 명중한다. … 가장 높은 회피율을 100%로 봤을때 회피로 전환하면 가장 높은 수치가 3이다. … 정수로 떨어지게 하되 반올림한다."

### 변환 규칙

- **공식**: `정수 = round(percent / max * 3)` (half-up).
- **회피 max** = 60% (fox / deer L2의 이전 값) → 3.
- **명중 max** = 20% (창/새총/찌르기의 이전 accuracy) → 3.
- 별도 max 정규화로 회피와 명중이 각각 0~3 범위.

### 변환 결과

**Prey evade_rate** (data/prey.json):
- 토끼/다람쥐/새/개구리: 30~40% → **2**
- 메뚜기/사슴/여우: 50~60% → **3**
- 그 외 (boar/dinosaur/badger/turkey/armadillo 등): 10~20% → **1**

**evade_per_turn** CSV도 같은 공식으로 일괄 변환 (T1,T2,T3).

**Card accuracy** (data/combat_cards.json):
- stab_weapon / throw_spear / slingshot_shot: 20% → **3**
- 나머지 카드: 0 → 0.

### 판정 로직 (combatDeck.js::resolveHunt)

이전 (확률식):
```
effectiveEvade = max(0, base - card.accuracy)
preyEvaded = Math.random() * 100 < effectiveEvade
```

변경 (결정론):
```
baseEvadeT = max(0, evadesByTurn[t] - fleeCount)   // 도주 누적은 -1/회
preyEvaded = baseEvadeT > cardAccuracy             // 회피 > 명중 → 회피
                                                    // 회피 ≤ 명중 → 명중
```

- 도주 누적 패널티(D-60): 이전 fleeCount × 10%p → 정수 -1/회.
- 확률 굴림 제거 → 동일 입력에 동일 결과(디버그/체감 일관).
- L2 turn-action(peek/attack/defend) 처리는 그대로 — evade 턴만 회피 판정.

### UI 변경

- `EvadeBadge`: `회피 N%` → `회피 N` (% 제거).
- 적 행동 슬롯 peek 라벨: `회피 0%` → `회피 0`.
- 턴 로그 (D-91) 회피당함 주석: `(N%)` → `(회피 N)`.
- StatBadges accuracy 표기 (`🏹+N`)는 이미 `%` 없음 — 그대로 유지(데이터만 정수로 변환됨).
- HuntCombatModal `computedEvades`: `final = (acc >= base) ? 0 : base` (UI에서도 결정론 표시).

### 디자인 의사결정

- **별도 max 정규화 (회피·명중 각각)**: 같은 변환 비율을 강제하면 명중률 max=20%가 회피 max=60%와 같은 척도로 보여 의미 흐려짐. 요한 의도는 "각 시스템 안에서 가장 높은 값=3" — 분리.
- **half-up vs banker's**: Python `round`는 banker's라 1.5→2 정상이지만 2.5→2가 됨. 모든 변환은 `floor(x + 0.5)`로 강제 half-up. 결과 일관.
- **fleeCount × 10 → -1/회**: 정수 시스템에서 ×10이 너무 강함. -1/회가 자연 단위.

### Node 스모크 (5 케이스, 전부 PASS)

- `acc=2, evade=2 → hit` ✓ (명중 ≥ 회피)
- `acc=2, evade=3 → evade` ✓ (회피 > 명중)
- `acc=0, evade=0 → hit` ✓
- `acc=0, evade=1 → evade` ✓
- `acc=3, evade=1 → hit` ✓

### 영향 범위

- `combatDeck.js`: `parseEvadesByTurn` fallback 20→1, `resolveHunt` 판정식 결정론.
- `data/prey.json`: evade_rate / evade_per_turn 정수 변환.
- `data/combat_cards.json`: accuracy 정수 변환.
- `data/data.js`: 재생성.
- `index.html`: EvadeBadge / 슬롯 peek 라벨 / 턴 로그 회피당함 주석 / computedEvades.
- 시트 SSOT 동기화는 다음 로컬 세션 작업.

---

## D-95. L2 사냥감 meat -1 일괄 차감 + 적 행동 슬롯 수치 배지 (2026-04-25, 13th 세션, `data/prey.json` / `index.html`)

요한 원문: "레벨2짜리 사냥감들의 드로우되는 고기 개수가 아직 많아 일괄적으로 -1개 차감해줘. 사냥감의 공격수치를 모르겠어 유저처럼 각 행동마다 수치가 나오도록해줘"

### A. L2 prey meat -1 일괄

D-90에서 절반(floor) 차감 후에도 큰생고기 개수가 많아 추가 -1.
- boar: 2 → 1, dinosaur: 2 → 1, deer: 3 → 2, badger: 3 → 2, fox: 2 → 1, turkey: 2 → 1, armadillo: 2 → 1.
- meat<=0 방어: `max(0, meat-1)`. 현재 모든 L2가 ≥2라 0으로 떨어지는 case 없음.
- prey.json + data.js 재생성. 시트 SSOT 동기화는 다음 로컬 세션.

### B. 적 행동 슬롯 행동별 수치 배지

이전 상태: T 슬롯에 `행동 라벨` + `회피` 액션에서만 회피율 노출. 공격/방어/눈치 액션의 수치는 상단 prey 정보 라인(D-91)에서만 알 수 있어 어느 턴에 어떤 위협 강도인지 직관 부족.

**수정**:
- `attack` → 🗡️ N (#ff9999, prey.attack > 0).
- `defend` → 🛡️ N (#4db8ff, prey.defense > 0).
- `evade`  → `EvadeBadge` (base/final + 도망 누적 패널티 반영, D-60).
- `peek`   → `회피 0%` (#d4b84a, 명중 보장 표지).

레이아웃 정돈: T번호 + 행동 라벨 + 수치 3행으로 분리. 유저 슬롯의 `StatBadges` 컨벤션과 색상·아이콘 통일(D-58).

**대안(검토)**:
- 회피 표시 그대로 두고 attack/defend 라벨만 색 강조: 정보량 부족, 요한 명시 의도와 어긋남. 패스.
- prey 정보 라인을 슬롯 안으로 이동: 슬롯 빡빡, 행동 차이가 안 보임. 패스.

**영향 범위**: HuntCombatModal 적 슬롯 렌더 한 블록. resolveHunt/SSOT 무영향. data 변경은 prey.json만.

---

## D-94. 거대한 먹이 + 보스 유인 시스템 (2026-04-25, 13th 세션, `boss.js`/`index.html`/`inventory.js`/`scripts/fetch_data.py`/`data/*.json`)

요한 원문: "큰생고기 4개를 조합해서 2x2짜리의 '거대한 먹이' 를 만들수 있게 해줘. 기존처럼 사용하기 하면 생명력 패널티 크게 주면서 배고픔 채워주게 하고(기존 큰생고기 수치를 적절히 반영), 이거 요리도 가능하게 해줘. 근데 사용하기 버튼 말고도 특수한 버튼 하나 더 나오게 만들어줘. (먹이로 유인하기) 해당 기능은 타일에 먹이를 놔두어서 보스가 해당 타일로 오게끔 유도한다 (2등급 사냥감과 처리 동일) 유저가 타일에 먹이를 올려놨다는걸 이해하도록 타일에 고기 아이콘 표시해주고, 알림메시지로 (이곳에 먹이를 놔두었다, 멀리서부터 발소리가 가까워지는 기분이 든다) 라고 해줘"

### 신규 아이템 2종

- **giant_bait** (거대한 먹이) — 2단계, **shape 2x2** (4칸), is_bait=true.
  - 효과: hunger+8 / health-8. 큰생고기(hunger+2/health-2) ×4의 단순 누적 — "큰덩어리 = 큰만족 + 큰페널티" 톤 유지.
- **grilled_giant_bait** (거대한 먹이 구이) — 3단계, 2x2, is_bait=true.
  - 효과: hunger+16 / health+8. 큰고기꼬치구이(hunger+4/health+2) ×4. 익히면 페널티 → 회복으로 전환.

### 신규 조합 2건

- `big_meat × 4 → giant_bait` (4재료 동일 종류, 큰생고기 4개 모아 거대한 먹이 1개).
- `giant_bait → grilled_giant_bait` (1재료 요리 — 휴식 카드 요리 모달 자동 노출).

### [먹이로 유인하기] 버튼 (ItemInfoModal)

- `is_bait` 플래그가 있는 아이템은 정보 팝업창에 [사용하기] 외 [먹이로 유인하기] 버튼이 추가 노출.
- 클릭 시 `handleLureBait(item)`:
  - 인벤에서 1개 차감 (`removeItem(item)` + `items.filter`).
  - `setBaitTiles`에 currentTile 추가.
  - 가방 모달 닫기, 메시지 "이곳에 먹이를 놔두었다. 멀리서부터 발소리가 가까워지는 기분이 든다…" + 토스트.

### 보스 유인 메커니즘 (synthetic prey)

- `boss.js`는 **무변경**. 대신 index.html에서 baitTiles를 가짜 prey 객체로 변환해 onPlayerMove에 전달:
  ```
  baitAsPreys = Array.from(baitTiles).map(tid => ({
    id: 'bait:'+tid, tileId: tid, level: 2, preyType: '__bait__', isBait: true
  }));
  boss.onPlayerMove(targetId, detection, [...l2Preys, ...baitAsPreys]);
  ```
- 보스의 기존 predation 로직(거리 ≤ 2 후보 선택, BFS 1홉 추격, 도달 시 stay=3 시작)이 prey와 bait를 구분 없이 처리.
- **콜백 분기** (index.html):
  - `onPredationStart(id, tile, prey)`: `prey.isBait`면 `setBaitTiles.delete(tile)`, 아니면 `setPreys.filter`.
  - `onPredationComplete(tile, id, preyType)`: preyType='__bait__'면 사체 메시지 분기.

### 시각 / 알림 분기

- **HexTile**: `computeTileIcons`에 `hasBait` ctx 추가. bait 타일에는 🍖 아이콘 (carcass와 mutually exclusive — 보스 식사 후 carcass로 전환). trace 표시도 bait 있으면 생략.
- **사체 도착 메시지** (D-90 분기 확장): bait면 "놓아둔 먹이가 깨끗이 사라졌다. 거대한 짐승의 식사 흔적이다. 조심하자.", 일반 prey면 기존 톤.
- **listen 인접 + 포식중 모달** (D-90 PredationListenModal): bait면 prey name='거대한 먹이', emoji='🍖'.

### 디자인 의사결정

- **수치 ×4 그대로**: "적절히 반영" 해석을 단순 누적으로. 페널티 -8은 큰편이지만 4칸 인벤 차지하므로 균형. 요리(grilled)는 +16/+8로 큰 보상 — 4칸 비용 정당화.
- **synthetic prey 패턴**: boss.js 회귀 위험 제거 + bait를 prey와 동일 메커니즘으로 통일. 두 시스템 분리하지 않음.
- **carcass 시각**: bait 포식 후도 일반 사체와 동일 🦴 (구분 없음). 내러티브상 "짐승이 다 먹어치웠다"는 결과가 같음. 메시지로만 분기.
- **giant_bait emoji**: 1단계 한정 ITEM_EMOJI 규칙의 예외(2단계+이지만 직관성 우선). 🍖 (큰생고기와 같음 — 시각적 크기 차이로 구분).

### 인프라 동기화

- `data/items.json` +2, `data/combos.json` +2, `data/data.js` 재생성.
- `inventory.js` ITEMS 폴백 +2 (shape `[[1,1],[1,1]]` 2x2).
- `scripts/fetch_data.py` ITEM_NAME_TO_ID +2.
- 시트 SSOT 동기화는 다음 로컬 세션 작업 (pending 명시).

### Node 스모크 (4타일 선형 맵)

- 보스 0, bait at 2: T1 0→1, T2 1→2, predationStay=3 + onPredationStart(id='bait:2', isBait=true). T3-T5 stay 3→2→1→0. T5에서 onPredationComplete(tile=2, preyType='__bait__'). ✓

### 영향 범위

- 신규 state: `baitTiles` Set. initializeGame reset 포함.
- 신규 함수: `handleLureBait`.
- 컴포넌트 prop 확장: HexTile/GameMap에 `baitTiles`, ItemInfoModal/InventoryModal에 `onLureBait`.
- boss.js / 다른 컴포넌트 무변경.

---

## D-93. 포식 중 보스 타일 진입 안전 + hunt_start 동기화 (2026-04-25, 13th 세션, `index.html`)

**요한 원문**: "매추라기가 평원 타일로 도망갔고, 내가 쫒아서 해당 타일로 들어갔는데 거기에 보스가 있었어, 내가 먼저 이동하고 보스가 이동하는 순서다보니 포식이 일어나기전에 내가 먼저 도착해버려서 조우 순간 죽은것 같은데, 이런 경우라면 포식이 먼저 발생했음 좋겠어. 혹시 일괄적으로 터니 순서를 보스가 먼저 타일이동, 그다음 유저 이동으로 통일하는게 좋을까?"

### 시나리오 분석

1. T-1: L2 prey가 평원 타일 X로 도망(전투 후). 보스도 prey 추적 중 X에 1칸 인접.
2. T:    유저가 prey 추격해 X로 이동. moveTo 흐름:
   - `preyHere = preys.find(tileId===X)` → 발견 → hunt_start 카드 손패 push.
   - `boss.onPlayerMove(X, ...)` → 보스가 prey BFS 1홉 = X로 이동 → predation 시작 (`predationStay=3`, `prey 제거`).
   - `encounter = newBossPos === X = true` → 즉시 게임 오버 + "보스 몬스터와 조우…".
3. 결과: 동시 도착으로 즉사. prey도 잃고 손패엔 무용지물 hunt_start.

### 디렉터 의견 (요한 질문 답변)

**일괄 턴 순서 통일(보스 먼저 → 유저)은 추천 안 함**.
- 현재 모델(유저 행동 → 보스 반응)은 체스 turn 모델로 직관적. 통일하면 첫 턴부터 보스가 움직여 유저가 행동하기 전 위험을 만들 수 있음 → "예측 가능한 추격" → "예고 없는 위협"으로 톤이 바뀜.
- 회귀 범위가 큼(initializeGame, 손패 사이클, listen 인접 검출 등 모두 영향).
- 이번 케이스는 "포식 중 같은 타일은 안전" 좁은 분기로 깔끔히 해결됨. D-90 모달 ("정신없이 무언가를 뜯어먹고 있다…몰래 통과해서 지나갈 수 있는 좋은 기회다") 톤과도 일관.

### 결정

**A. 포식 중 같은 타일은 게임 오버 회피**.
- `inPredationSafe = encounter && boss.predationStay > 0`.
- safe면 점프스케어/setGameOver 대신 토스트 "거대한 짐승이 식사에 정신이 팔려있다. 들키기 전에 빠져나가자!".
- bossVisible=true (자연히 같은 타일이라 시각화).
- 식사 끝나는 턴(predationStay 0으로 감소 후 같은 타일에 머물러 있으면) → 다음 onPlayerMove에서 다시 일반 경로 → 게임 오버 위험. 즉 "1~2턴 내 빠져나가야 한다"는 제한 시간이 자연스럽게 발생.

**B. hunt_start 카드 동기화**.
- 동일 턴 prey 포식 시작 시 prey 즉시 사라짐 → `hunt_start` 카드는 무용지물.
- 기존 코드: `setHand(newHand)`가 `boss.onPlayerMove` 이전에 호출 → 손패에 stale 카드 push.
- 수정: hunt_start push와 `setHand`만 보스 이동 후로 이관. `setDeck/setGraveyard/setGraveyardFlashKey`는 기존 위치 유지(손패에서 떠난 카드들이라 predation에 의존 안 함). `inPredationSafe`이면 hunt_start push 생략.

**Node 스모크** (4타일 선형 맵, 보스가 prey 인접에서 시작):
- T 시작: 유저가 prey 타일(2)로 이동.
- `boss.onPlayerMove(2, …)` → boss 1→2, predationStay=3, predationPreyType='boar', onPredationStart 콜백.
- `encounter = (boss.position===2) = true` / `inPredationSafe = (stay>0) = true` → 안전.
- ✓ 게임 오버 회피 검증.

**대안(거부)**:
- 턴 순서 통일: 위 의견 참조.
- 보스가 player tile로 이동 시 한 칸 양보(BFS 첫 홉을 다른 타일로): 포식 동선이 부자연스러움.
- predation safe를 보스가 식사 끝낸 후 1턴 추가 안전 grace까지 확장: 도주 여유가 생기지만 긴장감 약화.

**영향 범위**: `index.html` moveTo 두 블록(hunt_start push 이관 + encounter safe 분기). `boss.js` 무변경. 다른 컴포넌트/저장 자료구조 무영향.

---

## D-92. 1단계 재료 아이콘 통일 + 정보창 아이콘+이름 (2026-04-25, 13th 세션, `index.html`)

요한 원문: "1단계 재료들이 여러곳에서 텍스트로 표현되고 있는데, 이것들 전부 아이콘으로 표시해줘. 가방뿐아니라 조합법, 요리 레시피같은 곳도 전부 동일하게 아이콘으로 표시되게 해줘. 일단 1단계 재료들만." + 추가: "아이템 설명 팝업창엔 해당 아이콘과 이름 함께 표시해줘"

**대상**: 1단계 재료 11종 (slingshot 무기 제외) — `stone/branch/stem/mushroom/berry/meat/big_meat/water/fish/crab_whole/grasshopper_whole`.

**ITEM_EMOJI 매핑** (모듈 레벨):
- 🪨 stone, 🪵 branch (작은가지 — wood가 2단계라 충돌 없음), 🌿 stem
- 🍄 mushroom, 🍓 berry, 🥩 meat, 🍖 big_meat, 💧 water
- 🐟 fish, 🦀 crab_whole, 🦗 grasshopper_whole
- 헬퍼: `itemEmoji(typeOrId)` — 1단계면 emoji, 그 외 null.

**적용 위치 5곳**:
1. **가방 그리드 셀** — `{item.name}` 텍스트 → 1단계면 26px emoji 중앙 단독, 2단계 이상은 기존 이름 폴백.
2. **CraftPanel** — 재료 + 결과 양쪽. 1단계면 18px emoji + `has/count` 잔여 표기 유지.
3. **CookingModal** — `재료 → 결과` 행에 양쪽 emoji 적용. 결과(`grilled_*`)는 2단계+이라 텍스트 유지.
4. **CardItemConsumeModal** — 음식 후보 카드. 이름 prefix로 emoji + 이름 병기 (효과 라인은 기존).
5. **ItemInfoModal (요한 추가 지시)** — H3 타이틀에 24px emoji prefix + 이름. "아이콘과 이름 함께".

**디자인 원칙**:
- 1단계만 자동 변환. 2단계/3단계는 emoji 매핑이 없어 자동 텍스트 폴백 — 데이터 SSOT 확장 시 매핑 추가만 하면 됨.
- 가방 셀처럼 공간 빡빡한 곳은 emoji 단독, 정보가 필요한 곳(InfoModal/ConsumeModal)은 emoji + 이름.
- 메시지/토스트/LootToast는 변경 안 함 (요한 명시 범위 외 + 텍스트 가독성).

**대안(검토)**:
- emoji + 작은 이름 항상 병기: 셀 빡빡함, 시각적 노이즈. 거부.
- branch에 다른 emoji 시도 (🥢 chopsticks): 너무 인공적. 🪵(log)이 시각적으로 가장 가까움.

**영향 범위**: `index.html` 1곳 매핑 + 5곳 렌더 분기. 데이터/inventory.js/combatDeck.js 무변경. 새 1단계 아이템 추가 시 `ITEM_EMOJI`에 한 줄 추가.

---

## D-91. 사냥 전투 UI 가독성 개선 + 음식 효과 정렬 (2026-04-25, 13th 세션, `index.html`)

요한 원문: "2등급 사냥감과 전투할때 상대가 몇의 공격력으로 공격하는지, 방어수치는 몇인지 같은 수치들이 잘 나오게 해주고, 턴결과 로그가 사용자에게 직관적이지 않아서 알아보기 어려워, 내가 때린게 결국 맞았다는건지 회피했다는건지 내가 방어에 성공했는지 어쩐지 모르게어 직관적으로 제안해줘. 휴식카드에서 사용할 음식 선택할때 효과의 수치가 높은것부터 맨 위에서 보여지도록 조정해줘"

### A. Prey 공격력/방어력 배지 노출 (HuntCombatModal 상단)

**이전 상태**: 상단 prey 라인 = `사냥: {name} 🥩×{meat}` + HP 막대 + `HP cur/max`. attack/defense는 적 슬롯 영역에서만 간접 노출(턴별 행동 라벨 + 회피율). L2 사냥감은 attack=2 + defense=다양인데 수치를 한눈에 가늠 어려움.

**수정**: HP 라인을 `flex` 행으로 확장해 동급 정보 인라인.
- `🗡️ 공격력 N` (#ff9999) — `prey.attack > 0`일 때만.
- `🛡️ 방어력 N` (#4db8ff) — `prey.defense > 0`일 때만.

색상은 D-58 StatBadges 컨벤션 재사용(공격=붉은 톤, 방어=푸른 톤).

### B. 턴 결과 로그 2층 카드 재설계

**이전 형식 (한 줄, 모호)**:
```
T1: punch → 데미지 2 (HP 3)
T2: throw → 빗나감
T3: dodge → prey 공격
```
문제: 적 행동(공격/방어/회피) 결과가 라벨 한 단어로 압축돼 "내가 맞은 건지/막은 건지/회피한 건지" 불명. 색 구분도 없음.

**개선 형식 (2줄/턴 카드, 색상 분기)**:
```
T1 ┃ 👤 펀치 → 명중! -2 HP        (초록)
   ┃ 🦌 회피 자세                  (회색)
T2 ┃ 👤 새총 → 회피당함 〰️ (20%)   (노랑)
   ┃ 🦌 회피 성공 〰️               (노랑)
T3 ┃ 👤 웅크리기 → 방어 자세 🛡️ +1  (파랑)
   ┃ 🦌 공격 💥 → 내 HP -2          (빨강)
```

**색상 SSOT**:
- `#3dd68c` 초록 — 명중/회피 실패(내 입장 성공).
- `#d4b84a` 노랑 — 회피당함/회피 성공.
- `#9bd6ff` 파랑 — 방어 자세/감쇄.
- `#ff6666` 빨강 — 받은 피해.
- `#aaa` 회색 — 빗나감/대기/중립.
- `#ff9999` 분홍 — 무산(autoFail/무기 부재).

**플레이어 분기 로직** (10가지 케이스):
1. `outcome='flee_signal'` → 사냥감 도망 표기.
2. `outcome='player_flee'` → 도망 성공 ✓.
3. `userCard=null` → 빈 슬롯 표기.
4. `autoFail` → 무기 부재 또는 행동 무산.
5. `damage>0 && !hit` → 빗나감.
6. `damage>0 && hit && preyEvaded` → 회피당함 + (회피율%).
7. `damage>0 && hit && preyDefended>0` → 명중하지만 방어 감쇄.
8. `damage>0 && hit && !preyEvaded && !preyDefended` → 명중! -N HP.
9. `id='run_away'` → 도망 시도 실패.
10. `defense>0` → 방어 자세 🛡️ +N.

**적 분기 로직** (preyAction 4종):
- `공격` → `playerDamage>0 ? 받음 -N : (cardDefense>0 ? 막아냄 : 빗나감)`.
- `방어` → `preyDefended>0 ? 감쇄 N : 자세`.
- `회피` → `preyEvaded ? 성공 : (hit ? 실패 : 자세)`.
- `눈치` → 회피 못 함.

UI: 각 턴이 좌측 색 보더(`borderLeft: 3px solid {playerColor}`) + 두 줄. maxHeight 110→180으로 확장.

### C. 휴식 카드 음식 후보 효과 높은 순 정렬

**이전 상태**: `CardItemConsumeModal::candidates`가 `inventory.items` 배치 순서 그대로. 큰고기꼬치구이가 가방 아래쪽에 있으면 산딸기보다 아래 노출 → 회복 컨텍스트에서 효과 큰 음식을 일일이 찾아야 함.

**수정**: filter 결과를 `scoreItem(notionItem)` 내림차순 sort.
- `score = sum(scaledDelta + bonus)` for stat actions. 양수 페널티는 그대로 합산(페널티 음식 자동 후순위).
- `recoverScale=2` 휴식 컨텍스트에서: grilled_big_meat_skewer(12) > grilled_meat_skewer(6) > mushroom/berry(2) > meat/big_meat(0).
- 동점 → 이름순 가나다.

**대안(검토)**: `max(0, ...)` 양수만 누적 — 큰생고기·생고기가 산딸기와 같은 점수가 됨. 안전한 선택을 위로 올리는 의도와 어긋남. 패스.

**영향 범위**: HuntCombatModal 상단 prey 라인 + 턴 로그 블록 + CardItemConsumeModal의 candidates sort 1곳. 기존 컴포넌트 시그니처/State 변경 없음.

---

## D-90. 제자리 시간 보내기 + 포식 3턴 + 사체 알림 + 포식 listen 모달 + 큰생고기 (2026-04-25, 13th 세션, `index.html` / `boss.js` / `inventory.js` / `scripts/fetch_data.py` / `data/*.json`)

요한 4건 + 1건 묶음. 핵심은 보스 포식 시스템의 컨텐츠 표면화 — 보스가 "사라지는 동안 무엇을 하는지"를 플레이어에게 정보·알림·기회로 노출.

### A. 제자리 [시간 보내기] 모달 + moveTo self-target 허용

- 요한 원문: "유저가 현재 자신이 위치한 타일을 터치하면 그또한 이동으로 간주하는 처리를 해줬음 좋겠어, 마치 다른 타일로 이동한것처럼 동일한 규칙을 갖도록 하되, 확인 팝업창으로 '제자리에서 시간을 보내도 될까…?' [시간 보내기] 버튼이 있게 만들어줘."
- `moveTo(targetId)` 1행 가드를 `isWaitInPlace = (targetId === currentTile)` 분기로 확장 — connections 체크에서 self 허용. 이후 모든 부수 효과(시간/배고픔/발각률+5/보스 이동/손패 사이클/사냥감 hunt_start 카드 push)가 그대로 흐름.
- HexTile onClick: gameOver/victory/pathUnvisited/showPathView 차단 후 `isCurrent`면 `requestWait()` 콜, 아니면 기존 canMove → moveTo. requestWait는 GameMap 경유로 Game의 `setWaitConfirmOpen(true)` 트리거.
- `WaitConfirmModal` 신규 — "제자리에서 시간을 보내도 될까…? 한 턴이 지나가고 보스도 함께 움직인다." [취소] [시간 보내기]. 확정 시 `moveTo(currentTile)`.
- 부수: wait-in-place에서는 사냥감 발견 토스트 생략(`isWaitInPlace ? skip toast : show`). 카드 hunt_start는 그대로 push.

### B. 보스 포식 stay 2 → 3턴

- `boss.js::predationStay = 3` (이전 2). 3턴 정지 동안 player가 인접에 들러 listen할 창이 1턴 더.

### C. 사체 타일 도착 경고

- 요한 원문: "보스가 사냥감을 포식했던 흔적의 타일에 유저가 도착했다면 '거대한 짐승이 무자비하게 (사냥당한 사냥감의 이름) 을 뜯어먹은 흔적이다, 조심하자' 라고 알림 메시지가 뜨게 해줘."
- **자료구조 변경**: `carcassTiles` Set → Map<tileId, {preyType}>. `.has(tileId)` 호출 호환 — 기존 사용처 무회귀.
- **boss.js 콜백 시그니처 확장**:
  - `onPredationStart(preyId, tileId, prey)` — prey 객체 자체 전달.
  - `onPredationComplete(tileId, preyId, preyType)` — 종(preyType) 전달. 보스 인스턴스에 `predationPreyType` 필드 추가해 stay 동안 보존.
- **moveTo 분기**: 첫 도착(`!isWaitInPlace && carcassTiles.has(targetId) && !carcassVisitedTiles.has(targetId)`)에 토스트 발사 + `setCarcassVisitedTiles`에 add. 메시지: "거대한 짐승이 무자비하게 OOO을(를) 뜯어먹은 흔적이다. 조심하자." 색 #a83232.

### D. 포식중 보스 인접 + 귀기울이기 → 점프스케어 + 정보 모달

- 요한 원문: "포식중인 보스칸에 인접한 1칸에 도착했고, 그때 귀기울이기를 한다면 점프스케어 이후에 팝업창을 하나 띄워준다 / 타이틀: 포식중인 짐승 / 보스 아이콘, 사냥감 아이콘, 피 아이콘 / '거대한 그림자가 정신없이 무언가를 뜯어먹고 있다…몰래 통과해서 지나갈 수 있는 좋은 기회다' / [확인]"
- `useCard('listen')` bossDist===1 분기 안에 `boss.predationStay > 0` 체크. 일반 토스트 대신 점프스케어 트리거 + `setTimeout(800ms)`로 `setPredationListenInfo({preyType, preyName, preyEmoji})`. 모달은 점프스케어가 사라진 뒤 자연스럽게 노출.
- `PredationListenModal` 신규 — 진홍 테두리, 🦖 + prey emoji + 🩸 가로 정렬. 상단 라벨 "포식중인 짐승" #ff8a8a. 본문 메시지 + [확인] 버튼.

### E. 큰생고기 신규 + L2 사냥감 meat 절반 + 파생 조합

- 요한 원문: "레벨2의 사냥감들이 주는 고기가 너무 많아. 대신 큰생고기 아이템을 추가하여 기본 수치가 생고기보다 2배 좋도록 해줘. 그리고 사냥감을 사냥할때의 개수를 수치만큼 줄여줘. … 이에따라 파생되는 조합법이나 요리도 알아서 만들어줘"
- **신규 아이템 3종** (items.json): big_meat (1단계, hunger+2/health-2) / big_meat_skewer (2단계, hunger+2/health-2) / grilled_big_meat_skewer (3단계, hunger+4/health+2). 각 효과는 `meat → meat_skewer → grilled_meat_skewer` 체인의 정확한 ×2.
- **수치 해석**: "기본 수치가 생고기보다 2배" → 생고기 hunger+1/health-1 × 2 = hunger+2/health-2. 영양도 페널티도 둘 다 ×2 — "큰덩어리는 만족도 크지만 위장 부담도 크다" 해석. net effect는 동일하지만 인벤토리 1칸으로 2배 효과를 압축 — 공간 효율 보상.
- **파생 조합 2건**: `big_meat + branch → big_meat_skewer` / `big_meat_skewer → grilled_big_meat_skewer`. 기존 meat 체인 패턴 그대로.
- **L2 7종 prey.json** drop_item="big_meat" + meat 수량 절반(floor): boar 5→2, dinosaur 4→2, deer 7→3, badger 6→3, fox 5→2, turkey 4→2, armadillo 5→2.
- **인프라 동기화**:
  - `inventory.js::ITEMS` 정적 폴백 +3 (TTD_DATA 미로드 시 안전망).
  - `scripts/fetch_data.py::ITEM_NAME_TO_ID` 매핑 +3 (다음 로컬 시트 동기화 시 자동 처리).
  - `data/data.js`는 `export_data_js()` 호출로 재생성. 시트 SSOT 동기화는 다음 로컬 세션 작업 (pending.md 명시).

**Node 스모크 (boss 포식 시퀀스)** — 4타일 선형 맵에서:
- T1: 보스 0→1 (predationStay=0).
- T2: 보스 1→2(target prey 위치) → predationStay=3, predationPreyType='boar' 캡처, onPredationStart 콜백 호출.
- T3/T4/T5: stay 3→2→1→0. T5에서 onPredationComplete(tile=2, preyId='p1', preyType='boar') 호출. ✓

**대안(검토)**:
- 큰생고기 효과 hunger+2/health-1 (페널티 그대로 = 진짜 2배 좋음): 조작 압박 약화. 패스. 기획 톤상 "큰덩어리=큰리스크" 해석이 더 자연스러움.
- 제자리 클릭 즉시 wait (확인 모달 없이): 의도치 않은 자가 클릭으로 시간 손실 위험. 거부.
- 포식 4턴 이상: 너무 길어 보스 비활성 구간이 게임 밸런스를 흔듦. 3턴이 적정.
- 사체 메시지를 모달로: 일회성 알림이라 토스트가 톤상 적합.

**영향 범위**: `boss.js` (콜백 시그니처/필드/3턴) / `index.html` (carcassTiles Map 전환, moveTo self 허용, 4 분기 추가, 2 모달 신규) / `inventory.js` (ITEMS 폴백 +3) / `scripts/fetch_data.py` (이름 매핑 +3) / `data/items.json` `data/combos.json` `data/prey.json` `data/data.js` (재생성).

---

## D-89. 타일 아이콘 통합 중앙 스택 레이아웃 + 트레이스 자동 생략 (2026-04-25, 13th 세션, `index.html`)

**요한 원문**: "흔적은 정체가 밝혀지면 흔적아이콘이 없어지고 해당 자리에 사냥감 아이콘으로 대체해도 되잖아, 아니 애초에 사냥감 아이콘이나 흔적도 타일의 정 중앙 쪽에 놓아도 되지, 풍족한 땅이나 유저 아이콘, 보스 아이콘도 전부 중앙쪽에 표시되잖아, 동일한 타일에 모두 표시되어야 한다해도 좌우로, 중앙 정렬로 스택되게해서 두개일땐 ㅇㅇ, 세개부터는 ㅇㅇ/ㅇ, 네개일땐 ㅇㅇ/ㅇㅇ"

**이전 상태 (분산 배치)**:
- 사냥감/사체/풍족/함정/탈출구 라벨 → 타일 중앙 (D-50/D-78/getTileLabel)
- 흔적 👣/사체trace 🦴 → 우상단(x+20, y-18) (D-46/D-78)
- 플레이어 ♟ + 보스 🦖 → 타일 중앙(별도 SVG text 오버레이, fontSize 32/30) (D-50)
- D-88 임시 처치: 플레이어가 사냥감 위에 올라오면 좌상단(x-20, y-18) prey 배지

**문제**: 위치가 분산되어 동일 타일 다중 정보가 비대칭(코너 ↔ 중앙) → 스캔 비용. 또한 trace는 사냥감 위치 단서인데, 같은 타일의 prey가 가시화되어도 trace가 따로 그려져 정보 중복.

**결정**: 한 타일의 모든 아이콘을 "타일 중앙 영역의 정사각 슬롯 스택"으로 통합. 슬롯 수에 따라 자동 정렬:
- n=1 → 중앙 단독
- n=2 → 가로 ㅇㅇ
- n=3 → 위 ㅇㅇ / 아래 ㅇ (가운데 정렬)
- n=4 → 2×2 ㅇㅇ / ㅇㅇ
- n>4 → 우선순위 낮은 트레이스/지형부터 잘림(player/boss 보존)

**규칙**:
1. **trace 자동 생략** — 같은 타일에 prey나 carcass가 visible이면 흔적은 push 안 함. 정체가 밝혀진 자리에는 흔적 표시 안 함.
2. **player/boss는 GameMap이 단일 SVG text로 그려 transition 슬라이드 보존** — HexTile은 같은 list에서 그 두 슬롯만 skip. 양쪽이 `computeTileIcons` 순수 함수로 동일 입력→동일 결과 → 슬롯 인덱스 자동 일치.
3. **폰트 22로 통일** + `dominantBaseline=middle` + `paintOrder=stroke` (이전 ♟ 32/🦖 30 → 22로 축소). 어두운 배경 대비 위해 emoji에도 stroke #0a1020 strokeWidth 3.
4. **슬롯 좌표(타일 중심 대비)**: layout dx ±16, dy 1행=-7~+8/2행 23. 영역 라벨(top y-32~-44)·trace 옛 좌표와 분리.
5. **dimmed(silhouette/path-unvisited) 타일은 스택 비표시** — 기존 동작과 동일.

**구현 디테일** (`index.html`):
- 모듈 레벨에 `TILE_STACK_LAYOUTS` 상수 + `computeTileIcons(tile, ctx)` 순수 함수.
- 입력 ctx: `isCurrent / isBoss / showPrey / preyEmoji / hasCarcass / hasTrace / hasCarcassTrace`.
- 출력: `[{ kind, emoji|text, isPlayer?, isBoss? }, …]`.
- Push 순서 (priority 낮음 → 높음): 지형 → carcass → prey → trace(조건부) → player → boss. 4 초과 시 `slice(len-4)` — 앞쪽(낮은 priority)부터 잘려 player/boss 살아남음.
- HexTile 렌더: 미공개 타일은 '?' 단독, 그 외엔 `visibleIcons.map`으로 슬롯 위치에 text. `isPlayer/isBoss`는 skip.
- GameMap 렌더: `computeStackOffset(tile, isPlayerTile, isBossTile)` 헬퍼로 player/boss 슬롯 위치 계산. 단일 SVG text로 슬라이드.

**Node 스모크 (12 케이스, 전부 PASS)**:
- 미공개=빈 list / 탈출구 단독 / 탈출구+player(2) / 풍족+player(2) / 함정 단독 / 흔적 단독
- **흔적+prey → 흔적 생략** ✓ / **사체 trace+carcass → trace 생략** ✓
- 사체+prey+player(3) / 함정+사체+prey+player+boss(5→4 slice, player/boss 보존)
- 보스만 / player+boss

**대안(검토)**:
- HexTile에서 player/boss까지 다 그리고 transition 포기: ♟의 매끄러운 슬라이드 손실. 거부.
- player/boss는 항상 슬롯 0 고정: 다른 아이콘과 겹침. 거부.
- 슬롯 위치를 ref로 외부 노출: 타이밍 복잡. `computeTileIcons` 순수 함수로 양쪽 호출이 더 단순.

**영향 범위**: `index.html` HexTile 렌더 블록 + GameMap player/boss text 좌표. CSS·다른 컴포넌트 무영향. D-88의 좌상단 prey 배지는 폐기(스택에 자연 흡수). D-46 trace 우상단도 폐기.

---

## D-88. 핀치줌 중심점 드리프트 수정 + 같은 타일 사냥감 식별 보강 (2026-04-25, 13th 세션, `index.html`)

**요한 원문**: "핀치줌을 할때 중심점이 이상해 버그인가 확인해줘. 그리고 사냥감과 같은타일에 있게 되었을때 누굴 만난건지 확실히 알수가 없어."

### A. 핀치줌 중심점 드리프트 (D-82 회귀 보강)

**증상**: 두 손가락으로 핀치 줌 할수록 손가락 사이 중점이 점점 화면 가운데/모서리로 어긋남.

**원인**: D-82에서 zoom 적용 시 SVG width/height만 키우고 `requestAnimationFrame`으로 `el.scrollLeft`을 보정하는 구조. 이 때 매 프레임 `cx = midX - rect.left + el.scrollLeft` 로 콘텐츠 좌표를 계산하는데, touchmove는 ~120Hz 까지 빠르게 발생할 수 있어 이전 프레임의 rAF가 아직 실행되기 전에 다음 touchmove가 들어옴. 결과적으로 한 프레임 안에서 `zoomRef.current`는 새 값(next_N)이지만 `el.scrollLeft`는 이전 프레임 보정 전(scrollL_(N-1))이라 "새 zoom + 옛 scroll"을 섞어 cx가 어긋남. 매 프레임 누적되어 손가락 중점에서 멀어지는 드리프트가 발생.

**수정**: `useEffect` 내부 클로저에 `scrollRef = { x, y }` 평범한 객체 도입. 줌 계산은 전부 이 ref를 보고, rAF 직전에 동기로 갱신. 즉:
1. `applyZoomAt`/pinch onTouchMove에서 `scrollRef.x/y`로 `(focusOffset + scroll) * factor - focusOffset` 계산.
2. 즉시 `scrollRef.x = newScrollL; scrollRef.y = newScrollT`.
3. rAF는 여전히 DOM `el.scrollLeft = newScrollL` 적용을 담당(SVG 리사이즈 후 paint).
4. `beginPan`에서 `syncScrollFromDOM()`으로 ref ↔ DOM 재동기(스크롤바 사용 케이스).
5. `continuePan`에서도 매 프레임 `syncScrollFromDOM()`.

이로써 touchmove가 rAF보다 빨리 와도 다음 프레임의 cx 계산이 "의도된 다음 scroll"을 일관되게 사용 → 드리프트 0.

**대안(검토)**: CSS `transform: scale()` + `transform-origin` 으로 통일 → SVG width/height 변경 회피. 채택 안 함: 스크롤 가능 영역도 transform으로 변하지 않아 별도 wrapper 필요, 변경 폭 큼. scrollRef 트래킹이 D-82 구조에 최소 침습.

### B. 같은 타일 사냥감 식별 (D-46 보강)

**증상**: 플레이어가 사냥감 타일에 진입하면 1) `TileEventToast`가 사냥감 이름·이모지를 잠깐 띄움, 2) `hunt_start` 카드가 손패에 overflow로 추가됨. 그러나 토스트가 사라지면 타일 위에는 ♟ 만 남아 어떤 종을 만났는지 시각적으로 확인 불가.

**근본 원인**: `HexTile::getTileLabel`이 `if (isCurrent || isBoss) return '';` — 플레이어/보스가 올라온 타일은 라벨 자리를 SVG text 말(piece) 에게 양보. 그래서 `showPrey`(=visited && preyOnTile && !isBoss)가 true라도 prey emoji가 그려지지 않음.

**수정**: trace(👣) 마커가 우상단(x+20, y-18)을 쓰는 패턴을 그대로 차용해, 좌상단(x-20, y-18)에 prey emoji 배지를 추가. 조건: `!dimmed && isCurrent && showPrey`. 폰트 22px, stroke #0a1020, paintOrder=stroke로 어두운 타일에서도 대비 확보. ♟ (중앙, fontSize 32) 와 겹치지 않음. 영역 라벨(top-center, y-32)·trace(top-right, x+20)와 위치도 분리되어 동시 표시 가능.

**대안**: 1) ♟ 와 prey를 좌·우로 나란히 배치 → 위치가 흔들려 시선 분산. 2) prey emoji를 ♟ 위 작게 겹침 → 가독성 저하. 3) info 패널에 표기 → 시야 분리 비용. 코너 배지가 가장 단순.

**영향 범위**: `index.html` HexTile JSX 한 블록. 다른 마커/오버레이 무영향. dimmed/showPathView 모드에선 표시 생략(맵 보기 시 스포일러 방지 일관).

---

## D-87. 맵 크기 8x8 (D-61 11x11 축소) (2026-04-24, 13th 세션, `index.html`)

**요한 원문**: "맵크기좀 줄이자 지금보다 75% 작게 만들고 싶어" → "64타일 좋아"로 확정.

**이전 상태**: D-61에서 7x7→11x11(1.5배, 121타일)로 확장. D-86에서 보스 이동 템포가 1턴=1칸으로 동기화되며 "보스가 너무 멀다"는 체감이 사라졌으나, 그 대신 맵이 너무 넓어 탐험이 늘어지는 부작용 — 보스 위협보다 맵 횡단 자체가 콘텐츠의 중심이 되는 분배 깨짐.

**결정**: `MAP_SIZE = 11 → 8` (64타일, 변 길이 ×0.73, 면적 ~47% 감소).

**자동 스케일** (mapGenerator.js 변경 없음 — D-61에서 이미 gridSize 비율 기반으로 리팩토링됨):
- 빈 슬롯: `totalTiles * (0.20~0.31)` → 64×0.20~0.31 = 12~19. (D-61 11x11=25~38, D-46 7x7=10~15.)
- 특수 타일: `scale = 64/49 ≈ 1.31` → good=`max(4, round(5.22))`=5, trap=`max(2, round(2.61))`=3.
- 보스 최소 거리: `max(5, floor(8*0.7))` = 5칸. (D-61 11x11=8칸, 7x7=5칸.)
- 코너 후보(playerStart/exitPos 풀): 6개 (TL/TR/BL/BR + TC/BC) — `getCornerCandidates()` 동적 산출.

**Node 스모크(20회 재생성)**: 모든 시도에서 `_isValidMap` 통과 — playerStart 연결 ≥1, exitPos/bossPos 도달 가능, non-empty 전체 reachable, 보스 거리 ≥5. spawnPrey({level1:5, level2:5})도 10마리 전부 배치 성공.

**대안(검토했으나 채택 안 함)**:
- 7x7로 완전 회귀: D-61 이전 상태와 동일. 그러나 D-72~D-78에서 추가된 L2 prey 5마리 + 사체 타일 + 풍족한 땅·함정 5+3은 49타일에 비해 빡빡 — "탐험 여백" 부족.
- 9x9 (81타일): 변 ×0.82로 변화 폭이 작아 요한이 지목한 "75% 사이즈" 의도와 가장 가까운 8x8보다 유의미한 축소 효과가 떨어짐.

**영향 범위**:
- `index.html` 단 한 줄 (`MAP_SIZE` 상수). 모든 `MapGenerator(MAP_SIZE)` 호출부(3곳: line 531, 3146, 3840)가 자동으로 새 값 사용.
- `mapGenerator.js`, `boss.js`, `inventory.js` 무변경. PADDING_HEXES(D-54)도 그대로 — 캔버스 여백은 충분히 큼.
- D-86 보스 1턴=1칸과 결합: 8x8 짧은 맵 + 보스 동기화 이동 → 추격 압박이 정상 분포로 복원됨.

---

## D-86. 보스 이동 템포 1턴=1칸 고정 (2026-04-24, 13th 세션, `boss.js` + `index.html`)

**요한 원문**: "보스가 이동 하는 방식을 유저가 타일을 이동한 후에 한칸씩 이동하도록 변경해줘."

**이전 상태**:
- 일반 모드: `index.html::moveTo`의 caller 게이트 `if (boss.chaseMode || newMoveCount % 2 === 0)` + `boss.js` 내부의 `playerMoveCount % 2 === 0` 이중 게이트 → 실제로는 caller쪽 게이트가 먼저 작동(2턴에 1번 호출). 평균 0.5칸/턴.
- 추격 모드(`detection ≥ 80`): caller 게이트 통과(매 턴 호출) + `boss.js` `bossMovePhase` 0/1 교대 → 1, 2, 1, 2… (평균 1.5칸/턴).
- 포식(D-77): BFS 첫 홉 1칸(이미 1턴=1칸).

**문제**:
1. 첫 시도(boss.js만 수정)에서 caller쪽 `newMoveCount % 2 === 0` 게이트를 빠뜨려 일반 모드 동작이 그대로였음 — **호출 빈도 자체가 게이트되면 클래스 내부 수정만으로는 부족**.
2. 모드별로 이동 규칙이 달라 결과 화면(D-53 bossMoveHistory) 해석 곤란.

**결정**: 모든 모드에서 **플레이어 1이동 = 보스 1이동(1칸)**.
- `index.html::moveTo`의 caller 게이트 제거 → `boss.onPlayerMove(...)` 매 호출 무조건 실행.
- 일반 모드: `moveRandom()` — 순찰 waypoint 기반(D-70) 1홉.
- 추격 모드: `moveTowards()` — 플레이어 방향 1홉.
- 포식: 무변경(1홉). `predationStay>0`은 정지 턴으로 남김(D-77의 포식 연출 그대로).

**제거된 인스턴스 필드** (boss.js 내부 전용 확인 완료):
- `this.playerMoveCount`: 일반 모드의 `% 2` 스킵 판정용이었음. 제거.
- `this.bossMovePhase`: 추격 모드 1/2 교대 용. 제거. (코드상 `phase = (phase+1)%3` 다음 `if (phase===2) phase=0`이 있어 실제로는 0↔1만 교대 — 의도 불명확한 데드 분기였으며 함께 정리됨.)
- `index.html`의 동명 React state `playerMoveCount`는 별개 — 플레이어 측 카운터로 전혀 관련 없음. 그대로 유지.

**밸런스 영향**:
- 일반 모드: 보스 순찰 속도 **×2**. 중앙↔코너 왕복 턴이 반으로 줄어 "맵 어디서든 보스가 언젠가 온다"의 '언젠가'가 현실화.
- 추격 모드: 평균 1.5 → 1.0칸/턴. 잡히기 직전 유저의 반격/도주 여유 소폭 ↑.
- "보스 = 공포" 원칙(README)과 상충 가능 → 요한 QA 피드백 후 재튜닝 여지 열어둠. 순찰을 2턴에 1번으로 되돌릴지, 추격만 2칸 돌진 복원할지는 플레이 감각 기반 결정.

**대안(검토했으나 채택 안 함)**:
- "플레이어 이동에만 반응, 카드 사용 턴엔 정지" — 현재 `moveTo`가 이미 이동 시에만 `onPlayerMove`를 호출하므로 사실상 동일. 단 `useCard` 중 일부가 턴을 소모하는 루트가 있다면 별도 검토 필요 — 이번 이터레이션 범위 외.

---

## D-85. canMove 녹색 테두리가 dim 우선순위에 덮이는 버그 수정 (2026-04-24, 13th 세션, `index.html`)

**요한 제보(스크린샷)**: 평원(현재 위치) 인접 타일이 "못 가는 타일처럼 초록 테두리가 없음". 실제로는 터치하면 이동 가능.

**원인**: 이전 턴의 `listen`이 타일에 `silhouette=true` 플래그를 박음 → 플레이어 이동 후 `discovered=true`로 승격돼도 `silhouette` 잔존 → `silhouetteOnly=true` → `dimmed=true` → 기존 `tileStroke = dimmed ? '#555' : (canMove ? '#4CAF50' : '#0f3460')` 순서라 dim이 canMove를 덮음.

**결정**: 테두리 우선순위 역전.
```
tileStroke       = showCanMove ? '#4CAF50' : (dimmed ? '#555'   : '#0f3460')
tileStrokeWidth  = showCanMove ? '3'       : (dimmed ? '1'      : '2')
tileStrokeOpacity= (dimmed && !showCanMove) ? 0.4 : 1
```
- `showCanMove = canMove && !pathUnvisited` — [맵 보기] 모드에서 실제 클릭이 막히는 타일은 녹색 승격을 생략해 "녹색인데 안 눌림" 모순 방지.
- 내부 fill/fillOpacity는 그대로 두어 "가본 곳 vs 안 가본 곳" 색상 구분 유지.

**효과**: silhouette/dim 상태와 무관하게 `currentTile.connections`에 포함된 타일은 항상 선명한 녹색 굵은 테두리. 길찾기 난이도 추가 하향.

---

## D-71. 사냥감 확장 1단계 — 게·메뚜기 보상 다양화 + 조합·요리 체인 (2026-04-24, 12th 세션)

**요한 원문(디렉터 요약)**: "모든 사냥감 드롭이 생고기 뿐이라 게·메뚜기도 구분이 안 된다. 게는 껍질 부수는 조합이 있어야 하고 구워도 먹을 수 있어야 한다. 메뚜기는 날것으로도 허기를 달래 준다. 2·3단계(2등급 전투/방어, 보스 포식)는 다음 이터레이션."

**결정**:

1) **prey 전용 드롭** — 시트 `사냥감` 탭 + 신규 `drop_item` 컬럼. `crab → crab_whole`, `grasshopper → grasshopper_whole`. 나머지 1등급 7종·2등급 7종은 공란 = `'meat'` 폴백. SSOT는 시트.

2) **아이템 5종 신설(시트 `아이템마스터`)**:
   - `crab_whole` (재료, 1단계, disposable=N): 단독 섭취 불가. 조합 재료 전용.
   - `crab_meat` (음식, 2단계, hunger+1): 발라낸 게살. 단독 섭취 또는 꼬치 재료.
   - `crab_skewer` (음식, 2단계, hunger+1): 게살꼬치. 요리 가능.
   - `grilled_crab_skewer` (음식, 3단계, hunger+2;health+1): 구운게살꼬치.
   - `grasshopper_whole` (음식, 1단계, hunger+1): 메뚜기 단독 섭취.

3) **조합 체인 3건(시트 `조합레시피`)**:
   - `stone + crab_whole → crab_meat × 2` — 껍질 부수기, 2개 산출(신규 `result_count=2`).
   - `crab_meat + branch → crab_skewer × 1` — 꼬치 꿰기.
   - `crab_skewer → grilled_crab_skewer` — 1재료 "요리" 경로(D-57과 동일 규칙).

4) **신규 스키마 — `result_count` 컬럼** (조합레시피 탭):
   - 빈칸/1=기본, >1=N개 산출. `fetch_data.py::build_combos_from_sheet`가 `combo.count`(>1일 때만)로 방출.
   - `inventory.js::craftRecipe`가 `recipe.count` 만큼 결과물 반복 배치. 첫 개는 preferredPos, 나머지는 `addItem` 빈 칸 탐색. 가방 포화 시 들어간 만큼만 생성 + `{produced, overflow}` 반환. 재료 소비는 1회 고정(count와 무관).
   - 반환 스키마 확장은 비파괴적(기존 count 없는 레시피는 produced=1/overflow=0).

5) **런타임 폴백** — `inventory.js::ITEMS`에 5종 하드코딩 엔트리. 오프라인/시트 장애 시 테스트 가능. TTD_DATA 로드 후 `resolveDef`가 mergeable/merge_result·내구/공격 등을 시트값으로 덮어씀(기존 merge 규약 그대로).

6) **사냥 승리 드롭 분기** — `handleHuntResolve` victory에서 `prey.drop_item`이 있으면 그 id를 `inventory.addItem`, 없으면 `'meat'` 폴백. 메시지/LootToast의 이름·등급도 `InventorySystem.resolveDef(dropId)`로 동적 조회.

**근거**:
- prey 보상 폴리모프(`drop_item`)는 D-46 `meat` 단일 드롭 모델을 깨지 않고 확장. 빈값 = `meat` 폴백으로 하위 호환.
- `result_count` 스키마는 D-33 weights CSV와 같은 철학("시트 SSOT 수치 파라미터를 DSL 없이 컬럼으로"). 2~4재료 레시피의 `ingredient_c/d`가 이미 옵션 컬럼이라 같은 패턴을 따름.
- 게 드롭을 바로 음식으로 주지 않고 "돌로 깨서 게살 x2"로 만든 이유: (a) 게 2마리 = 생고기 4개 수준의 빈약 드롭을 바꾸되, (b) 돌맹이 자원 소비를 강제해 1단계 재료 순환을 생성. hunger+1 × 2 = meat × 2와 대등하지만 "돌이 필요" 조건이 추가됨.
- 메뚜기는 조합 단계 없이 바로 섭취 가능 — "작은 곤충은 그냥 먹는다"는 선사 리얼리즘. hunger+1로 베리와 동일 티어.
- `CookingModal`이 `ingredients.length===1 && result.startsWith('grilled_')` 필터라 `grilled_crab_skewer`도 자동 노출 — 별도 수정 불필요(D-57 네이밍 규약의 이점).

**관련 파일**:
- `scripts/fetch_data.py::ITEM_NAME_TO_ID` (신규 5종), `::build_combos_from_sheet` (`result_count` → `combo.count`).
- `inventory.js::ITEMS` (신규 5종), `::craftRecipe` (count 반복 + produced/overflow 반환).
- `index.html::useCard('hunt_start')` (activeHunt.prey에 drop_item), `::handleHuntResolve` victory (drop_item 우선), `::handleCraft` (produced/overflow 메시지).
- 시트 `아이템마스터` +5 row / `조합레시피` +신규 컬럼 `result_count` + 3 row / `사냥감` +신규 컬럼 `drop_item` + 2 row 값 세팅.
- `data/items.json`(25 items), `data/combos.json`(16 recipes), `data/prey.json`(drop_item 필드), `data/data.js` 재생성.

**비파괴적**:
- `'meat'` 폴백·기존 12종 prey drop 체인 변화 없음.
- `craftRecipe` 반환 스키마 확장(produced/overflow 추가)만, 기존 호출부(`handleCraft` 한 곳)는 명시적으로 업데이트. D-57 요리 호출부는 1재료 = produced=1 자연 호환.
- CookingModal 렌더 로직 그대로 — grilled_ 접두어 규약이 D-57 이후 스키마 확장을 자연스럽게 흡수.

**후속(2·3단계, pending.md 등재)**:
- 2단계 2등급 전투/방어 시스템 (공격+1, 방어+1 신규 defend 카드, 100% 성공, 공통 카드풀).
- 3단계 보스 포식(waypoint 이탈 2회 정지 + 생고기 확정 무한 드롭).

---

## D-58. HuntCombatModal 수치 배지 통일 + 적 슬롯 실시간 회피율 (2026-04-24, 12th 세션)

**요한 원문**: "사냥 모달의 수치 표기가 들쭉날쭉이다. `공4`, `명중 +20%`, `회피 30%`가 서로 라벨 스타일이 달라 읽기 어렵다. 아이콘 + 숫자로 통일해라. 그리고 창을 슬롯에 놓으면 적의 회피율이 실제로 줄어든 값으로 바로 보여야 한다. 숫자 다이얼 연출은 다음 이터레이션."

**결정**:

1) **카드 수치 배지 3종 통일** — `HuntCombatModal` 내부에 `StatBadges({ card })` 지역 컴포넌트 도입.
   - `🗡️+N` (빨강 `#e06666`) — damage>0 일 때만.
   - `N%` (기본 `#aaa`, 아이콘 없음) — success_rate 항상.
   - `🏹+N` (초록 `#8bd17c`) — damage>0 AND accuracy>0 일 때만.
   - 순서 고정: 🗡️ → % → 🏹. `inline-flex` + `whiteSpace: nowrap`로 줄바꿈 금지.
   - 기존 텍스트 라벨(`공N`, `명중 +N%`) 전부 제거. 내 슬롯·내 손패 두 곳 동일 규칙.
   - 내구 배지(`내구 N/M`)는 D-51 분기 그대로 유지 — 별도 줄, 별도 색(노랑).

2) **적 슬롯 최종 회피율 실시간 반영** — `computedEvades = React.useMemo(...)` 슬롯별 계산.
   - **공식 불변식(SSOT)**: `finalEvade = max(0, prey.evade_rate - card.accuracy)` — `combatDeck.js::resolveHunt` L232 `effectiveEvade`와 **글자 단위 동일**. useMemo 위 주석에 SSOT 위치 명시.
   - damage=0 카드(dodge/run_away) 또는 빈 슬롯 → base 그대로 (기본색).
   - damage>0 & finalEvade < baseEvade → 초록 `#8bd17c` + bold.
   - `EvadeBadge({ baseEvade, finalEvade, consumed })` 지역 컴포넌트로 추출. `consumed` 는 턴 로그 소진 여부(투명도).

3) **이중 합산 방지** — `card.accuracy` 는 `buildHuntDeck`(D-50)에서 이미 카드+무기 합산된 값. 렌더 레이어는 읽기 전용.

4) **숫자 다이얼 연출 제외** — 이터레이션 범위 축소. 단순 fadeIn(color/opacity 0.2s transition)만. 이유: (a) 카운트업 연출은 색 변화와 동시 재생 시 시선 분산, (b) 400ms 이상 지연은 카드 배치 UX를 둔하게 만듦, (c) 다음 회차에서 별도 스펙으로 다룰 것.

**근거**:
- D-50 `buildHuntDeck` 개편으로 `card.accuracy` 가 카드+무기 통합값이 되면서, 유저가 "창을 놓으면 회피가 얼마나 떨어지는지" 실시간으로 볼 수 없는 것이 반쯤 버그였다. 결과(resolveHunt) 로그에는 나오지만 배치 단계에서 안 보였다.
- 라벨 다양성은 D-46/D-47 증분 추가 과정에서 파편화됐다. `공`/`명중 +`/`회피` 가 공존하는 상태를 아이콘으로 수렴.
- SSOT 주석은 공식 분기가 발생하는 순간(예: 명중률 소프트캡 도입) 렌더 레이어만 업데이트되는 사고를 방지하기 위함.

**관련 파일**:
- `index.html::StatBadges` (신규, 모듈 상단 지역 컴포넌트).
- `index.html::EvadeBadge` (신규).
- `index.html::HuntCombatModal` — `computedEvades` useMemo, 내 슬롯/손패/적 슬롯 렌더 3곳 교체.
- `gameStyles.css::.evade-changed` — color/opacity 0.2s 트랜지션.
- `combatDeck.js::resolveHunt` L232 — SSOT 공식 (**변경 없음**, 주석 참조용).

**비파괴적**:
- `resolveHunt` 로직 불변. `buildHuntDeck` 불변. 배지는 렌더 전용.
- 내구 배지·∞/×N 뱃지 등 기존 분기 영향 없음.

**후속**:
- 숫자 다이얼 연출은 별도 이터레이션.
- 다른 배지 컨벤션(전투 HUD, 보스 체력 등) 일괄 통일은 D-58 범위 외.

---

## D-37. HUD 2줄 압축 — 3개 한 줄 + 보스/발각 한 줄 (2026-04-22, 7th 세션)

**요한 원문**: "생명력과 배고픔, 시간을 한줄로 표현해줘. 시간은 좀 짧아져도 되니까 세개를 한줄로. 보스 순찰표시와 발각률도 한줄로. 모바일에서 맵이 좀 더 많은 영역으로 잘 보이게"

**결정**: 상단 HUD를 2줄로 압축한다.
- **1줄**: [생명력 게이지][배고픔 게이지][시간 시계]  (3박스 한 줄)
- **2줄**: [보스 순찰/추격][발각률 바]                (2박스 한 줄; 발각 바가 남은 폭 flex-grow)
- 기존 3행(생명+배고픔 / 시간+보스 / 발각) 구조를 2행으로.
- "타임투다이노" 제목 라인 제거(공간 절약, 탭 타이틀로 대체).
- 라벨("생명력"/"배고픔") 제거, 아이콘만. 숫자는 14→11px, 시계는 16→14px, 게이지 높이 12→10, 발각 바 20→14px.
- `.stat-box` padding 8px → 5~7px 인라인 오버라이드(`compactBox`).
- 모바일 `@media (max-width: 480px)`: `.ui-panel` padding 8→6px, `.stat-box` padding 5px 6px로 추가 축소.

**근거**:
- D-27 HUD 리뉴얼로 게이지·시계 도입은 유지. 하지만 3행 구조가 모바일 세로 공간을 과하게 먹어 "맵이 보이지 않는다"는 요한 지시.
- 시계 아이콘 3개는 시각 단서로 충분 — 라벨 "시간" 제거해도 의미 전달됨(D-12 1인칭 톤 원칙 외의 시스템 UI).
- 생명력·배고픔도 아이콘(❤️/🍖)으로 구분되어 라벨 불필요.
- 보스 순찰/추격은 한 단어이므로 박스 하나로 축약, 발각 바에 flex-grow를 주면 모든 폭에서 꽉 차게 표시됨.

**검증 (2026-04-22, vw=375 시뮬)**:
- row1 높이 24px / row2 26px / 메시지 29px → HUD 합계 ~86px (이전 ~150px 대비 -40%).
- row1: 생명 130 / 배고 130 / 시계 82px — 1행 맞음, overflow 없음.
- row2: 보스 50 / 발각 298px — 1행 맞음, 발각 바 시각적 충분.
- 게이지 색상(체력 #b24656 100% / 배고픔 #c08a3e 100% / 발각 #4CAF50 0%) 정상.
- 콘솔 에러 0.

**관련 파일**:
- `index.html::StatPanel` — 2줄 레이아웃(flex), compactBox 스타일, 제목 제거.
- `index.html::StatGauge` — 라벨 제거, `flex` prop으로 외부 폭 배분 제어.
- `gameStyles.css::.ui-panel` + `@media (max-width: 480px)` — 모바일 padding 축소.

**비파괴적**:
- `StatPanel` prop 시그니처 그대로. `StatGauge`만 `label` prop 제거 + `flex` 추가 — StatGauge는 StatPanel 내부 호출만 있어 회귀 영향 없음.

---

## D-36. 휴식 모달 — 증폭 UI "+1 +1" 강조 (2026-04-22, 6th 세션)

**요한 지시**: 휴식 카드 소비 모달에서 "회복 x2"가 단순 숫자로만 표시돼 "왜 이 아이템을 써야 하는지" 감각이 약함. 파밍 중 회복의 가치를 체감시키기 위해 증분을 노란 굵은 강조로 시각화.

**결정**: `CardItemConsumeModal` 후보 리스트 각 아이템에,
- 원래 효과 텍스트("배고픔 +1") + 스케일 적용 후 델타 증분("+1")을 노란(#d4b84a) bold 병기.
- 모달 상단에 "휴식: 음식 1개를 소비해 회복 효과를 두 배로" 힌트 문구(D-12 1인칭 톤 약하게 적용).

**근거**:
- D-23 프레임워크로 `scale:recover=2` DSL이 동작 중이지만, UI 피드백이 "+2"로만 마감되면 유저가 "원래 +1이 두 배가 돼서 +2"라는 인지 경로를 거치지 못함.
- 노란색(#d4b84a)은 배고픔 경고 색과 동일 팔레트 → 다크톤 일관.

**구현**: `index.html::CardItemConsumeModal` 내 후보 행 템플릿에 `scaleDelta` 계산 + 강조 span 추가. 힌트 텍스트는 모달 prop `titleText` 바로 아래.

**관련 파일**: `index.html::CardItemConsumeModal`.

---

## D-35. 타일 반복 뒤져보기 페널티 — `0.5 × 0.5^searched` (2026-04-22, 6th 세션)

**요한 지시**: 같은 타일을 반복 뒤져보면 드롭 확률이 떨어져야 파밍 루프가 "새 지역 탐색" 쪽으로 기울어진다.

**결정**: 타일별 `searchedCount` 상태를 두고, 파밍 성공 확률에 곱연산 페널티를 건다.
- 떠났다가 돌아온 타일: `× 0.5` (hasBeenLeft 플래그)
- 연속 뒤져보기 N회: `× 0.5^searchedCount`
- 최종 계수: `(hasBeenLeft ? 0.5 : 1) * 0.5^searchedCount`

**근거**:
- "같은 타일에서 연타하면 이득"이 되면 D-11(보스=공포, 이동 리스크) 원칙과 정합하지 않음.
- 곱연산 2단은 유저가 "돌아와서 다시 뒤지면 반" → "그 상태에서 또 하면 또 반" 같이 감각적으로 이해 가능(선형 차감보다 직관적).
- `0.5^n`은 3회째면 12.5% — "이 타일은 쥐어짰다"는 감각 줄 수 있음.

**구현**: `index.html::useCard` 뒤져보기 분기에서 `tiles[currentTile].searchedCount`·`hasBeenLeft` 참조 후 `rollTileDrop` 성공 판정에 계수 곱. 이동 시 `hasBeenLeft=true` 세팅, `searchedCount`는 뒤져보기 성공/실패 무관 +1.

**관련 파일**: `index.html::useCard`, `mapGenerator.js` 타일 초기 상태.

---

## D-34. '좋은곳' 타일 슬롯 상향 — 100/80/80 (2026-04-22, 6th 세션)

**요한 지시**: 좋은곳 타일(`good`)에서 획득 아이템이 2~3개로 단순해 "명시적 보상"의 체감이 약함. 슬롯 3개 모두 채워지도록 확률을 올려라.

**결정**: `good` 타일 파밍 시 3개 슬롯 각각을 `[100%, 80%, 80%]` 확률로 굴린다.
- 1번째 슬롯 확정(기획상 "좋은곳은 무조건 뭔가 나온다").
- 2·3번째는 20%씩만 공(空) → 평균 ~2.6개 드롭.

**근거**:
- 드롭테이블(일반 타일)이 지역 카테고리 × 균등 추첨이라 확률이 낮아, 좋은곳이 그보다 명확히 후하게 느껴져야 타일 속성이 유의미.
- 100/80/80은 D-11 원칙(보스 = 공포)과 충돌 없음 — 좋은곳은 탐험 보상, 조우 빈도에 영향 없음.
- 시트 SSOT 승격은 **보류**: `good` 타일은 수치가 적고(3슬롯 × 3확률), 기획자가 조정할 빈도가 낮다고 판단. 지금은 `index.html` 내 상수로 직접 정의. 향후 밸런싱 회의 빈도가 높아지면 시트 `상수` 탭 후보로 이동.

**구현**: `index.html::useCard` 뒤져보기 분기에서 `tile.type === 'good'`이면 `GOOD_TILE_SLOT_PROBS = [100, 80, 80]` 루프, 각 슬롯마다 독립 `rollTileDrop`.

**관련 파일**: `index.html::useCard` (good 분기), `mapGenerator.js` (좋은곳 타일 생성).

---

## D-33. 신규 아이템 water/fish + 가중치 DSL 컬럼 신설 (2026-04-22, 6th 세션)

**요한 지시**: 시냇물 지역의 음식 카테고리에 "물"과 "물고기" 추가. 파밍 결과가 지역 환경에 맞게 달라지는 경험 확장.

**결정**:
1. **신규 아이템 2종**:
   - `water` (물): 카테고리=음식, 재료 타입=음식재료, 사용 효과=`hunger+1` (버섯/산딸기 동일 스케일), 나오는 지역=`시냇물`.
   - `fish` (물고기): 카테고리=음식, 재료 타입=음식재료, 사용 효과=`hunger+2` (더 든든), 나오는 지역=`시냇물`. 일회용=✓.
2. **가중치 DSL 컬럼 신설**: 드롭풀 시트에 기존 "균등 추첨" 대신 아이템별 가중치를 기입할 수 있는 문자열 DSL.
   - 예: `water:3,fish:1` → water 3 : fish 1 확률로 추첨.
   - 비워두면 기존 균등 추첨으로 폴백(기존 동작 호환).
   - 파싱은 `scripts/fetch_data.py`가 담당, 런타임은 `dropTable.js::rollTileDrop`에서 가중치 리스트로 조회.
3. **시트 컬럼**: `드롭풀` 탭에 `weights` 컬럼 CSV 추가. 기존 `items` CSV와 병행.

**근거**:
- 시냇물이 "왜 시냇물인가"를 아이템 다양성으로 보여주는 최소 묶음 2종. 물=기본 음식, 물고기=귀한 음식(hunger+2).
- D-03(문자열 DSL) 원칙 연장 — 컬럼 쪼개지 않고 한 줄에 의도 표현.
- 가중치는 "특정 아이템을 더 희귀하게"를 균등 풀 + 중복 엔트리 우회보다 명시적으로 편집 가능.
- `effect`·`category`·`weights` 3컬럼 신설 근거: 각각 아이템 행동/드롭 축/밸런싱 축에 직접 대응, 파생 불가.

**구현**:
- Notion 아이템 DB에 water/fish 페이지 추가 (ITM-10, ITM-11). `items.raw.json` MCP로 갱신.
- `scripts/fetch_data.py::parse_drop_weights(raw) → dict[str,int]` 신규 파서.
- `data/drop_table.json` pool 엔트리에 `weights` 필드 추가(없으면 `null`).
- `dropTable.js::rollTileDrop` — pool entry에 `weights` 있으면 `weightedPick(items, weights)`, 없으면 기존 균등 경로.
- 시냇물 드롭풀에 water/fish 등록, 가중치 `water:3,fish:1`.

**관련 파일**: `data/items.json`, `data/drop_table.json`, `dropTable.js`, `scripts/fetch_data.py`.

---

## D-32. 머지 UX 간소화 — 롱프레스 + 짧은 탭 한 번에 확정 (2026-04-22, 6th 세션)

**요한 원문**: "롱프레스 하면 머지, 이동모드가 되는데. 선택된 아이템과 두번째로 터치한 아이템이 동일한 경우 머지가 되어 2단계 아이템이 된다. 산딸기+산딸기=딸기모둠."

**결정**: 롱프레스로 선택 모드 진입 후, **다른 아이템을 짧은 탭**하면 즉시 머지/조합/swap을 확정한다. 드래그·셀 클릭·확정 버튼 경로를 걷어내고 "탭 두 번이면 끝"으로 축약.

분기 순서(`InventoryModal::openInfo`):
1. 선택 상태에서 **같은 아이템** 탭 → 선택 해제(토글)
2. `canMerge(sel, target)` → `confirmPlacement(target.x, target.y)` → 즉시 머지 메시지
3. `canCombine(sel, target)` → `confirmPlacement(...)` → 즉시 조합 메시지
4. 그 외 → 기존 `activateSelect(target)` 경로(선택 전환)

**근거**:
- D-08(롱프레스 400ms)로 "길게=선택"은 이미 고정. 드래그·확정 버튼은 산딸기×2→딸기모둠 같은 단순 플로우에 노이즈.
- 머지/조합 결과 메시지(D-24에서 구현)는 `handleConfirm`에만 있었음 → 새 경로에서도 동일 포맷 재사용(중복 제거 위해 `confirmPlacement` 직접 호출).
- 빈 칸으로 옮기기·회전은 기존 드래그/셀 클릭/회전 버튼 경로 **그대로 유지**. 이번 변경은 **"선택 상태에서 다른 아이템 탭"** 하나의 분기만 재정의.

**비파괴적**:
- `InventorySystem` API 전부 무변경. `confirmPlacement`/`canMerge`/`canCombine` 시그니처 유지.
- 확정 버튼 UI는 그대로(드래그→셀 지정 플로우에서 여전히 사용). 두 경로 병존.

**E2E 검증 (2026-04-22)**:
- 산딸기+산딸기: 롱프레스 → 짧은 탭 → 딸기모둠 생성 + "두 재료를 합쳐 딸기모둠을(를) 얻었다." 메시지. PASS.
- 식물섬유+질긴줄기(조합): 롱프레스 → 짧은 탭 → 깨끗한 천 + "재료를 조합해 깨끗한 천을(를) 만들었다." 메시지. PASS.
- 콘솔 에러 0.

**관련 파일**:
- `index.html::InventoryModal::openInfo` — 분기 로직.

---

## D-31. 귀 기울이기 카드 — 거리별 오감 내레이션 (2026-04-22, 6th 세션)

**요한 원문 (밸런스/분위기 지시)**:
- **1칸**: 현재 동작 유지 (보스 위치 표시)
- **2칸**: "숨쉬는 소리가 꽤 가까이 들리는 듯 하여 소름이 돋는다"
- **3칸**: "발걸음 소리가 가까워진듯 하다"
- **4칸 이상**: "발걸음 소리가 아주 멀리서 들린다, 당분간은 안심해도 될 것 같다"

**결정**: `listen` 카드는 플레이어 타일과 보스 타일의 **BFS 거리**에 따라 4가지 분기 메시지를 낸다.
- 인접 타일 `revealed` 처리는 **거리와 무관하게 항상 실행** — listen 카드의 기본 효과. 거리별 청각 메시지는 그 위에 중첩된다. (2026-04-22 보강 참조)
- 1칸 메시지는 "가쁜 숨소리가 바로 곁에서 들려온다. 보스는 타일 #N에 있다."로 갱신(D-12 톤).

**근거**:
- D-11(보스=공포)·D-12(1인칭 오감). 기존 "보스는 타일 #N에 있다"는 **시야 탐지 수준의 정보**를 늘 제공 → 카드 1장으로 전 맵 보스 위치가 드러나 공포감 감소.
- 거리 분기는 "소리는 가까우면 구체적, 멀면 모호"의 직관과 일치. 카드가 **정보 카드**에서 **감각 카드**로 무게중심 이동.
- BFS 거리 계산은 `BossMonster.calculateDistance(from, to)`에 이미 존재 — 재사용.

**관련 파일**:
- `index.html::useCard` — `listen` 분기.
- `boss.js::BossMonster.calculateDistance` — BFS 헬퍼(무변경).

**E2E 검증 (2026-04-22)**:
- 거리 1→"가쁜 숨소리가 바로 곁에서 들려온다. 보스는 타일 #13에 있다." PASS.
- 거리 2→"숨쉬는 소리가 꽤 가까이…" PASS.
- 거리 3→"발걸음 소리가 가까워진듯…" PASS.
- 거리 4/5→"발걸음 소리가 아주 멀리서…" PASS.
- 콘솔 에러 0.

**SSOT 일관성 보류**:
- 시트 `베이스탐험카드`의 `listen` row effect 컬럼은 여전히 "몬스터 감지" — 카드 한 줄 UI 설명이라 거리별 내레이션 요약으로도 이어서 정확. 시트 편집은 요한 수동 작업(Chrome MCP tab-foreground 제약 D-17).

**2026-04-22 보강 (요한 QA 회귀)**:
- **문제**: 초기 구현에서 `revealed` 갱신을 `bossDist === 1` 분기 안에만 두어, 2칸 이상 거리에서는 인접 타일 정보가 전혀 공개되지 않음. 요한 QA에서 "귀기울이기의 인접 타일 정보 기능이 없어졌다"고 회귀 지적.
- **원인**: D-11(보스=공포) 원칙을 과도 적용. `revealed`는 listen의 **기본 효과**이고 거리별 메시지는 그 위에 얹히는 **보너스 레이어**인데, 둘을 하나의 trade-off로 묶어버렸음.
- **수정**: `revealed` 갱신을 거리 분기 바깥으로 분리, 거리 무관 항상 실행. 거리별 청각 메시지만 분기에서 선택. 위 결정 항목은 SUPERSEDED가 아니라 **재정의**(인접 revealed는 기본, 거리 메시지는 중첩).
- **관련 코드**: `index.html:1438-1470` (listen 분기, 2026-04-22 보강 주석).

---

## D-24. 머지·조합 통합 시스템 (2026-04-22 5차 세션)

**결정**: 같은 재료 N개 겹치기(머지)와 서로 다른 재료 결합(조합)을 **하나의 통합 시스템**으로 구현.
같은 type 2개 겹치면 "머지", 다른 type 2개 겹치면 "조합 레시피 조회". 실패하면 기존 swap 폴백.

**요한 결정 원문**:
1. "머지를 통해 단계가 높은 아이템을 생성하고 결과적으로 중복되는 아이템들을 줄여서 인벤토리 공간을 확장시키는 역할도 있음"
   → 머지 = **파생(상위 단계) + 공간 압축**.
2. "Notion `머지 가능` 체크박스를 SSOT로 확정".
3. "머지와 조합은 같은 기능. 같은 재료끼리 합치면 머지, 서로 다른 재료끼리 조합법 매칭되면 새 아이템"
   → 통합 UX / 하나의 `confirmPlacement` 분기.

**데이터 모델**:
- **아이템 SSOT**: Notion `🎒 아이템`.
  - `머지 가능` (checkbox) — 이 아이템이 "같은 재료 2개 머지"의 입력이 될 수 있는가.
  - `결과물` (self-relation) — 머지 결과물(2단계). 1단계 재료가 이 필드로 자기 상위 단계를 가리킨다.
  - `조합법` (text) — "A + B → C" DSL. slash(`/`)로 여러 레시피 구분 가능.
- **파생 데이터**:
  - `data/combos.json` — 파이프라인이 `조합법` DSL을 파싱해 전역 레시피 리스트로 평탄화(`[{ingredients, result}]`).
  - `data/items.json` — 아이템별 `merge_enabled`/`merge_result`/`id` 필드를 추가로 내보냄.
  - `data/data.js` — 브라우저 번들에 `COMBOS` 키로 노출(`window.TTD_DATA.COMBOS`).
- **한글↔영문 id 매핑**: `scripts/fetch_data.py::ITEM_NAME_TO_ID`가 SSOT. 신규 아이템은 여기·`inventory.js::ITEMS` 둘 다 등록 필요.

**런타임**:
- `InventorySystem.resolveDef(type)` — Notion 값(`merge_enabled`/`merge_result`)을 우선 반영하고 static 정의는 폴백.
- `canMerge(a, b)` — 같은 type + `mergeable:true` + `merge_result` 존재.
- `canCombine(a, b)` — 다른 type + `lookupCombo(a.type, b.type)`가 일치.
- `confirmPlacement(x, y)` 분기 순서: **머지 → 조합 → 교체(swap)**.
- 결과: `{ ok, action: 'place'|'merge'|'combine'|'swap', resultType? }`.

**N개 머지 수량**:
- 현재는 "2개 겹치기"만 지원(`InventorySystem.MERGE_COUNT = 2` 상수 도입, UI·로직 모두 2를 가정).
- `결과물` relation도 N=2 전제로 1:1. 3개 이상 머지/3재료 조합은 후속 확장.

**조합 맵 확정안** (2026-04-22 디렉터 기본값, 요한 검토 대상):
| 재료 A | 재료 B | → 결과물 |
|---|---|---|
| 나뭇가지 | 나뭇가지 | 목재 |
| 질긴줄기 | 질긴줄기 | 식물 섬유(끈) |
| 식물 섬유(끈) | 질긴줄기 | 깨끗한 천 |
| 깨끗한 천 | 식물 섬유(끈) | 붕대 |

- 돌맹이·버섯·산딸기: 상위 아이템 없음 → `머지 가능=NO` (2026-04-22 디렉터 세팅).
- 기존 Notion `조합법`에 있던 "억센 풀 x3 → 끈 x1" / "천 조각 x3 + 깨끗한 물 → 깨끗한 천" / "약초" 등
  미등록 재료는 현재 아이템 9종에 존재하지 않으므로 **디렉터 기본값으로 덮어씀**(요한 지시:
  "초안이면 한 번만 묻고 답 기다리지 말고 합리적 기본값으로 진행 후 보고").
- 기존 "목재 + 목재 → 튼튼한 목재(고급)" 후순위: 3단계 아이템(ITM-10~) 등록 전엔 파싱 대상이 아니라 **삭제**.

**왜 `결과물` relation과 `조합법` 텍스트를 동시에 유지하는가**:
- `결과물`은 "같은 재료 N개 머지" 단일 경로 전용 — 1단계 재료 하나가 상위 2단계로 승급할 때의 1:1 매핑.
- `조합법`은 "서로 다른 재료" 및 수량 많은 레시피까지 담는 자연어 — 확장성·기획자 편집성.
- 파이프라인은 둘 다 소비. 같은 정보가 두 번 들어가도 무결성은 파서가 보장.

**파괴적 변경 회피**:
- `canMerge`/`mergeItems`/`confirmPlacement` 시그니처 유지 → 기존 UI 호출부 회귀 없음.
- `grade` 기반 `material_low→mid→high` 3단계 승급 로직은 레거시 영역으로 이동(`material_*` 아이템은 `mergeable:false`로 마킹해 사실상 비활성). 시스템이 안정되면 삭제 예정.

**관련 파일**:
- `scripts/fetch_data.py` — `ITEM_NAME_TO_ID`, `parse_combo_recipe`, `build_combos_from_items`, `transform_notion_items`의 `merge_result`/`merge_enabled` 필드 주입.
- `inventory.js` — `resolveDef`, `lookupCombo`, `canCombine`/`getCombineResult`, `_placeDerivedItem`, `confirmPlacement`의 머지·조합 분기.
- `index.html::InventoryModal` — `previewInfo.kind === 'combine'` UI, 결과 메시지(`onFlashMessage`).
- `gameStyles.css` — `.inventory-preview.ok.combine` (보라 점선).

---

## D-01. 지역(region) 5종으로 압축

**결정**: 타일 지형은 `숲 / 덤불 / 평원 / 시냇물 / 동굴` 5종.
**근거**: Notion 문서엔 16종 남짓의 지형 제안이 있으나, 드롭 테이블·타일 가중치·플레이버 텍스트를
모두 5종 이상으로 늘리면 밸런싱 비용이 기하급수적. 카드 더미 크기·뒤져보기 확률을 "기억 가능한 수"로
유지하기 위해 5종을 기본. 필요 시 여기서 파생 이벤트로 확장.
**영향**: `mapGenerator.REGIONS`, Notion 아이템 DB `나오는 지역` multi_select, 시트 `드롭테이블`·`드롭풀` 탭의 region 열.

## D-02. 2단계 드롭 구조

**결정**: 뒤져보기 1회 = (region → 카테고리 추첨) → (카테고리 내 아이템 균등 추첨).
**근거**:
- 1단계만 두면 아이템이 늘수록 확률 재조정이 지옥.
- 카테고리(`env`/`food`/`none`)로 1차 층을 만들면 "이 지역은 음식이 잘 안 나온다" 같은 지역 정체성을
  아이템 수와 독립적으로 조절 가능.
- 카테고리 내부는 균등. "특정 아이템이 더 희귀" 같은 미세 조정은 나중에 같은 풀에 엔트리를 중복 등록하는 식으로 우회.
**구현**: `dropTable.js`의 `DROP_TABLE` + `REGION_ITEM_POOL`. 이후 시트의 2탭으로 이관 예정(D-06).

## D-03. 문자열 필드 + 런타임 파서

**결정**: `cost`(빌딩), `attack_pattern`(몬스터), `사용 효과`(아이템) 등 구조가 있는 데이터를 컬럼 분해하지 않고
자연어/DSL 문자열로 두고 파이썬·JS 파서가 구조화.
**근거**:
- 시트·Notion에 컬럼을 계속 늘리면 기획자(요한)가 편집하기 힘들다.
- DSL은 한 줄에 의도 전부 표현 가능. `hunger+1;health+1` 같은 체인도 자연스러움.
- 파싱 실패에 대비해 원문을 `_raw` 필드로 병행 저장 (런타임 폴백).
**예시 문법**:
- 빌딩 cost: `목재 x10, 끈 x5`
- 몬스터 attack_pattern: `으르렁(0) → 물기(2) → 발톱(3)`
- 아이템 사용 효과: `spawn_card:throw` · `hunger+1` · `hunger+1;health+1`
- 무효 토큰: `미정` / `효과 없음` / `TBD` / `-` / 빈 문자열 → `usable: false`

## D-04. Python 빌드타임 export (Node·CORS 회피)

**결정**: 시트 xlsx를 다운로드해 JSON으로 덤프하는 파이프라인을 Python(openpyxl)로. 브라우저는 `data/data.js`가
심어주는 `window.TTD_DATA`만 읽음.
**근거**:
- `file://`나 단순 static 서버에서 fetch + CORS 회피가 가장 간단한 방법이 `<script>` 주입.
- Node 빌드 체인(webpack/vite)을 도입하면 이 프로젝트 규모 대비 오버킬. HMR 없어도 `make data` + 새로고침으로 충분히 빠름.
- Python은 요한/내가 둘 다 읽을 수 있고, xlsx 파싱이 쉽다.
**제약**: 네트워크 없으면 `make data-offline`으로 마지막 캐시(`data/.sheet_cache.xlsx`) 사용.

## D-05. 페치 타이밍은 수동 (훅·CI 없음)

**결정**: 시트/Notion 변경 후 `make data`를 요한이 직접 실행.
**근거**: 자동화는 좋지만 (a) Notion MCP는 로컬 파이프라인에서 쓸 수 없음 (`items.raw.json`은 사용자가 MCP로 채움),
(b) 시트는 공개 xlsx export라 cron은 쉬우나 실제 게임 빌드 주기가 낮음. 의식적으로 "지금 데이터 갈았다"는 맥락이
중요한 워크플로라 수동이 오히려 명확.

## D-06. 드롭 테이블 SSOT는 시트로 이관

**결정**: 지역×카테고리 확률, 지역×카테고리×아이템 풀 모두 시트의 2개 탭 `드롭테이블` / `드롭풀`로.
**이전 결정 (SUPERSEDED)**: Notion `🎲 타일 드롭 테이블` DB(`8b7e1f19c624484c9f3f30685943cc53`)에 두려 했으나
시트가 수치 밸런싱의 원래 SSOT이고, 풀(지역×카테고리→아이템 CSV)은 Notion DB보다 시트 2열 편집이 빠름.
**후속**: Notion의 드롭 테이블 DB는 **레거시** 처리 후보. 내가 자율로 삭제하지 않음. 요한 확인 필요.
**구현 상태**: `scripts/fetch_data.py::export_drop_table()` + `BROWSER_BUNDLE_KEYS`에 `drop_table.json → DROP_TABLE`
선반영됨. 시트에 탭만 생기면 자동 작동. `dropTable.js`의 하드코딩은 TTD_DATA.DROP_TABLE 우선 참조로 교체 예정.

## D-07. 아이템 SSOT는 Notion

**결정**: 아이템 DB는 Notion `🎒 아이템`에 유지 (시트 이관하지 않음).
**근거**:
- multi_select(나오는 지역·능력치·태그), relation(재료·결과물), auto_increment 같은 리치 메타가 시트보다 Notion이
  관리 편리.
- 아이템은 "조합으로 파생"되는 계층 구조가 있어 relation이 필수.
- 시트와 이중 관리 안 하기로.
**한계**: Notion은 로컬 파이썬에서 직접 당길 수 없음 → `items.raw.json`을 MCP(리사/나)가 갱신해서 커밋하는 2단계 흐름.

## D-08. 롱프레스 임계값 400ms

**결정**: 인벤토리 짧은 탭=정보창, 400ms 이상 길게=선택/이동/머지/회전.
**근거**: Android 표준 롱프레스(500ms)보다 살짝 빠르고, iOS 기본(~300ms)보다는 여유. 게임은 연타·드래그가 잦아
짧은 의도를 놓치면 답답하고, 너무 짧으면 스와이프가 오탐. `index.html::LONG_PRESS_MS` 상수.

## D-09. 던지기 카드는 영구 편입 아님 (전투 종료 시 소멸)

**결정**: 돌맹이 `사용 효과: spawn_card:throw` → 임시 풀 `combatExtraCards`에 쌓임 → 전투 시작 시 `buildCombatDeck`로
기본 덱에 병합 → 사용하면 `consumeExtraCard`로 풀에서 1장 차감. 전투가 끝나도 풀에 남아있는 미사용분은 자동 소멸하도록 설계.
**근거**:
- 영구 편입이면 돌을 몇 번 주워둔 유저가 영원히 던지기를 보유 → 밸런스 붕괴.
- "아이템을 써서 덱에 넣는다"는 기획 의도는 리소스 소비의 감각. 소비 타이밍을 전투 시작이 아니라 "아이템 사용" 시점에 둔 이유는,
  전투 전 준비 행동(탐험 중 사용)이 의미 있어지기 때문.
**참고**: 현재 구현은 `addThrowCard`에서 풀에 누적만 함. "전투 종료 시 소멸"의 실제 정리 로직은 전투 UI와 함께 붙여야 함 (미완).

## D-10. 동적 카드 스펙은 시트가 아니라 combatDeck.js

**결정**: `throw`(명중 100, 공격력 +1) 같은 동적 생성 카드는 시트 `전투카드` 탭에 넣지 않고 `combatDeck.RUNTIME_CARDS`에.
**근거**: 시트에 넣으면 아이템 없이도 덱에 기본 포함될 위험. "아이템을 써야만 등장"이라는 기획 의도를 코드 레벨에서 강제.

## D-11. 보스 = 공포. 전투 빈도를 낮게 유지

**결정**: 밸런싱 판단에서 "전투가 자주 일어나면 보스의 공포가 휘발된다"가 제1 원칙.
**근거**: 기획 문서의 "몬스터는 두려운 존재" · "한 사이클 종료 후 유저 1칸 후퇴 + 3턴 대기" 등 모든 구조가 조우를 희소 사건으로 만들도록 설계됨. 드롭·카드 효율·발각 확률 등 수치 튜닝 시 이 원칙이 우선.

## D-12. 텍스트 톤: 1인칭 완료형 내레이션

**결정**: 시스템 메시지는 "~했다 / ~했지만 ~" 형태. 감각적 묘사 가능한 곳은 최대한 감각 단어 (공기, 냄새, 소리).
**근거**: 기획의 핵심이 "텍스트로 1인칭 오감 전달". 건조한 "아이템 획득" 대신 "[숲] 나뭇가지를 발견했다" 같은 형태. `index.html::useCard`의 메시지 포맷이 이 컨벤션을 따르고 있으며, 새 메시지 추가 시 여기를 기준으로.

## D-13. 디렉터 권한 경계

**결정**: 디렉터(나)는 다음을 **자율로 하지 않는다**:
- git 커밋/푸시 (요한이 명시적으로 요청할 때만)
- Notion DB/페이지 삭제
- 시트 편집
- 파괴적 데이터 변경 (items.raw.json 대량 수정 등)
**이유**: Auto 모드에서도 데이터 레이어 변경은 복구 비용이 크다. 기획·구조 판단은 자율, 데이터 반영은 사용자 확인.

## D-14. 아이템 등급 = 파생 단계로 통합

**결정**: Notion 아이템 DB의 `아이템 등급` select를 "일반/희귀/전설"의 희소도 개념에서 "1단계/2단계/3단계"의 **파생 깊이(조합 깊이)** 개념으로 재정의.
- **1단계**: 파밍(뒤져보기)으로 직접 획득. 현재 ITM-5~9(돌맹이/나뭇가지/질긴줄기/버섯/산딸기).
- **2단계**: 조합으로 1단계 재료에서 파생. 현재 ITM-1~4(목재/식물섬유/깨끗한천/붕대).
- **3단계**: 미래 확장용. 2단계 조합으로 파생(예: 도구·장비).

**근거**:
- 요한이 "일반 등급 → 1단계로 수정" + "ITM-1~4를 2단계로 지정"을 같이 지시. 맥락상 등급 축이 단계 축과 같은 것을 표현하던 혼선.
- 희소도는 이 게임에서 별도 축이 아니라 단계의 함수(상위 단계일수록 희소). 축 분리는 편집·필터링 비용만 증가.
- 드롭 풀 연결 여부(1단계=드롭 가능, 2단계 이상=조합 전용)가 단계와 1:1 매핑 → 시스템 로직도 단계 기준으로 전개하는 게 자연스럽다.

**구현**:
- Notion 스키마: `ALTER COLUMN "아이템 등급" SET SELECT('1단계', '2단계', '3단계', '일반'(legacy), '희귀'(legacy), '전설'(legacy))`. 파괴적이지 않도록 기존 옵션 보존, 사용 안 함.
- Notion 페이지 9개 모두 단계 값으로 재배정 완료 (ITM-1~4=2단계, ITM-5~9=1단계).
- `items.raw.json`도 수동 동기화. `make data`로 `items.json`·`data.js` 재생성됨.
- 레거시 옵션 "일반/희귀/전설" 제거는 **요한 확인 대기** (D-13, 옵션 제거는 파괴적).

**한계**:
- "등급"이라는 컬럼 이름은 아직 단계 축을 담기엔 의미가 모호. 향후 `RENAME COLUMN "아이템 등급" TO "단계"`도 후보지만, 조합법/UI 등에서 "등급"을 쓰는 텍스트가 있을 수 있어 컬럼 이름은 당분간 유지.

## D-15. 드롭 테이블: 시트 없이 JSON 수동 스냅샷 임시 운영 (RESOLVED 2026-04-22)

**결정**: 시트 `드롭테이블`·`드롭풀` 탭이 아직 생성되지 않은 상태에서, `data/drop_table.json`을 `dropTable.js`의 하드코딩 값으로 수동 추출하여 먼저 커밋. 시트 탭이 생기면 `make data`가 자동으로 덮어씀.
**이유**:
- D-06에서 시트 SSOT로 이전하기로 했으나 시트 탭 추가는 요한 수동 작업이고 타이밍이 늦어짐.
- `dropTable.js`의 하드코딩을 TTD_DATA 참조로 치환하는 작업을 진행하려면 TTD_DATA.DROP_TABLE이 먼저 존재해야 런타임 회귀 없이 검증 가능.
- 수동 스냅샷은 하드코딩 값과 **완전히 동일**한 수치만 담으므로 런타임 동작 변화 0.
**RESOLVED (2026-04-22)**: 디렉터가 Chrome MCP로 시트에 `드롭테이블`·`드롭풀` 탭 생성 후 `make data` 실행. `data/drop_table.json`은 시트 SSOT 기반으로 자동 재생성되며 값은 수동 스냅샷과 완전 일치. 이 시점부터 **D-06의 완전 완료**이며 수동 스냅샷 라벨은 해제. 관리 주체는 시트 단일.

## D-16. Notion 아이템 DB 보드뷰 2개 유지

**결정**: `카테고리별`·`등급별` board view를 삭제하지 않고 유지.
**근거**:
- 요한 선호 (명시적 결정).
- D-14로 등급 옵션이 단계(1/2/3단계)로 정리돼 `등급별` view가 단계 기준으로 그룹핑되는 형태로 재사용 가능. 레거시 옵션 삭제도 완료(pending.md 참고)되어 view에 빈 그룹이 남지 않음.
- `카테고리` 속성도 DB에 살아있음 (재료/소모품/무기/도구/장비/음식/기타) — 스키마 재조회(2026-04-22)로 검증. 해당 view의 그룹핑 축이 깨지지 않음.
**이전 상태 (SUPERSEDED)**: pending.md에 "view 2개 수동 삭제" 항목이 있었으나 요한 결정으로 철회.
**후속**: 요한이 실제 view 표시 상태(특히 `카테고리별`이 현재 속성으로 그룹핑 되는지)를 Notion에서 한 번 확인해주면 좋음 — 그룹 누락이 있으면 그때 다시 판단.

## D-17. Chrome MCP로 Google Sheets 편집하는 표준 레시피

**결정**: 향후 디렉터가 시트를 직접 편집해야 하면 다음 절차를 기본으로 삼는다.
1. `tabs_context_mcp`로 기존 시트 탭 확인. 없으면 `navigate`로 시트 URL 열기.
2. 좌하단 `+` 버튼 클릭 → 새 시트 생성 (gid 바뀌는 것으로 성공 확인).
3. 새 시트 탭을 `double_click`하여 이름 편집 모드 진입 → `type`으로 탭 이름 타이핑 → `Return`.
4. 데이터 입력:
   - 단일 셀 단위의 `type` + `Tab`/`Return`은 **한글에서 IME 조합이 확정되지 않아 다음 키로 유실될 수 있음**. 특히 Tab 직후 한글 셀은 비는 경우가 실측됨.
   - **안정 경로**: `javascript_tool`로 `navigator.clipboard.writeText(TSV)` → A1 좌클릭 → `cmd+v`. Sheets가 TSV를 여러 셀로 자동 분할. 한글 포함 100% 정확.
5. 붙여넣기 후 스크린샷으로 `A1:X?` 범위 확인 (Name Box). 합계 셀(우하단)로 수치 빠른 검증.
**이유**:
- Chrome MCP는 브라우저를 read-tier로 취급하지 않고 자체 도구로 조작 가능. computer-use보다 좁은 권한, 정확도는 동등 이상.
- 한글 IME 이슈는 재현성이 있어서 "안 되더라"가 아닌 "하면 안 된다"로 명문화.
**후속**: 시트 경로가 일주일 이상 안정되면 향후 이터레이션은 이 레시피를 재사용. 장기적으로는 Google Sheets API/서비스 계정 설정(D-06의 궁극 형태)도 검토.

**추가 제약 (2026-04-22 2차 세션)**: `navigator.clipboard.writeText`는 **탭이 foreground·focused일 때만** 성공한다. Chrome MCP로만 브라우저를 다룰 때는 디렉터 세션이 탭을 띄우기만 하고 실제 focus는 요한 데스크탑에 있음 → `document.hasFocus()===false`, `visibilityState==='hidden'` → `DOMException: Document is not focused`.
- 대안 1: 요한이 해당 탭을 전경에 둔 동안에만 clipboard 경로 사용.
- 대안 2: 비파괴적 수정이면 요한 수동 작업으로 이관(이번에 채택).
- 대안 3: row 삭제처럼 원자적 동작은 Google Sheets API + 서비스 계정으로 전환(중장기 과제).

## D-18. 런타임 카드 필터는 시트 편집이 밀릴 때의 가드용이다

**결정**: 시트 `베이스탐험카드` SSOT에서 카드가 아직 제거되지 않았더라도, `index.html`의 BASE_CARDS 로드 경로에 `EXCLUDED_CARD_IDS` Set을 두고 해당 id는 손패에서 필터링한다. 시트에서 실제로 row가 삭제되면 이 Set은 매칭되는 row가 없어 무해.
**근거**:
- SSOT는 시트지만 시트 편집에 MCP 경로가 항상 있는 건 아니다(D-17 후속 제약 참고).
- "카드가 사라지는 기획 결정"을 유저에게 즉시 반영해야 UI/밸런스 일관. 시트 편집 타이밍과 게임 빌드 타이밍 사이에 며칠 간격이 생길 수 있음.
- 폐기 카드가 손패에 한 번이라도 뽑히면 '무기 장비 찾기'처럼 아무 효과 없는 카드가 유저에게 노출됨 → 원칙적으로 금지.
- 필터는 id 단위의 명시적 상수라 추후 삭제/확장이 쉬움. "왜 이 카드가 손패에 안 나오지?"에 대한 질문이 오면 이 상수부터 확인.
**범위**: 임시 가드. 시트 row가 제거되고 `make data` 재생성되면 이 상수는 해당 id를 비워도 된다(다만 안전망으로 남겨도 무해).

## D-19. 이동마다 발각률 +5%는 보스 = 공포 원칙의 강화

**결정**: 플레이어가 타일을 1칸 이동할 때마다 발각률이 +5% 증가(상한 100).
**근거**:
- 기획서의 "한 사이클 종료 후 유저 1칸 후퇴 + 3턴 대기"·"몬스터는 두려운 존재" 맥락. 자유로운 이동 자체에 페널티가 없으면 유저는 보스 위치에 상관없이 최단 경로로만 달려도 되고, 긴장감이 소실된다.
- +5% 수치 선택: 이동 16칸 만에 추격 임계(80) 도달. 7x7 맵의 대각선 거리가 6~8칸 수준인 것을 고려하면, "상시 추격 없이 최단 경로로만 달려도 결국 임계"라는 밸런스가 나온다. 중간에 `숨기`(-15)·`귀 기울이기`(-5) 같은 감소 카드가 있어 플레이어가 의도적으로 관리해야 한다.
- chase 전환 판정도 같은 턴 기준 `movedDetection`으로 체크해 즉시 전환 가능하게 함. 유저가 "한 턴 더 이동해서 벗어난다"가 안 먹히도록.
**범위**: 시트 SSOT에 아직 편입되지 않은 상수. 밸런싱 수치 조정 필요성이 자주 생기면 시트 `상수` 탭 신설 후보.

## D-21. "음식" 카테고리 = 회복 효과 보유 아이템 전용

**결정**: Notion 아이템 DB `카테고리` select의 `음식` 옵션은 **유지**하며, "음식" 카테고리에 속한 아이템은 **반드시 회복 효과(배고픔/체력 회복)를 갖는다**는 게임 디자인 규칙을 명문화한다.
- 신규 "음식" 카테고리 아이템 추가 시 `사용 효과` 컬럼 DSL에 `hunger+N` 또는 `health+N` 등 회복 액션을 기입하는 것을 체크리스트화.
- 카테고리와 효과 스펙을 암묵적으로 묶어서 밸런스 파악·인벤토리 UI 라벨링(예: "식량" 필터)을 일관되게 한다.

**근거**:
- 요한 2026-04-22 지시 원문: "4번의 음식 옵션은 유지해야지. 실재 회복효과도 있어야 하니까."
- 현 구현과 정합: ITM-8 버섯·ITM-9 산딸기 모두 `재료 타입: 음식재료` + `사용 효과: hunger+1`로 규칙 충족(단, 이들은 `카테고리`가 "재료"로 묶여있을 수 있으니 실제 카테고리 값은 Notion 검증 필요 — 현재는 `재료 타입` 축으로 구분 중). `카테고리=음식` 레코드를 신규 추가하면 회복 효과가 의무화되는 형태.
- 드롭 풀에서 `food` 카테고리 추첨으로 나오는 아이템이 "먹어서 의미 있는" 것만 담기도록 보장 → 탐험→파밍→배고픔 관리 루프가 명확.

**구현**:
- 현재 코드 변경은 없음(규칙 선언). 다음에 새 음식 카테고리 아이템이 추가될 때 체크 대상.
- 향후 확장: `카테고리=음식`인데 `사용 효과`가 빈/미정인 경우 `fetch_data.py` 단계에서 경고 로그를 띄우는 린트 추가 후보.

**후속**:
- 기존 아이템(버섯/산딸기)의 Notion `카테고리` 값이 실제로 "음식"인지 "재료"인지는 별도 확인 필요 — 현재 items.raw.json에는 카테고리 필드가 스키마에 있으나 값이 비었을 가능성. 디렉터가 자율로 고치지 않음(D-13). 요한 차기 세션에서 확인 후 보정.

## D-22. 손패 상한 3장 → 5장

**결정**: 탐험 중 유저가 보유할 수 있는 카드 상한을 3장에서 5장으로 올린다.
- `index.html::HAND_SIZE = 5` 상수 도입. 초기 드로우·이동 시 보충 로직·UI 손패 카운터가 모두 이 상수 참조.
- `HandCards` 그리드 `repeat(3, 1fr)` → `repeat(5, 1fr)`. 1000px 폭 기준 각 카드 ≈194px로 여전히 안정.

**근거**:
- 요한 밸런스 감(2026-04-22): 손패 3장은 "뒤져보기·이동·이동" 같은 단순 루프에 너무 쉽게 갇힘. 휴식/음식 찾기처럼 조건부 카드가 손에 동시에 있어야 의미 있는 선택이 나온다.
- D-19(이동마다 발각 +5%)로 이동 페널티가 있으니, 손패가 더 다양해져야 "발각률 관리 vs 파밍"의 교환이 매 턴마다 유의미해짐.
- 시트 `베이스탐험카드` 총 count는 현재 10 (rest 폴백 포함, find_weapon 제외) — 5장 손패라도 덱/무덤 순환이 충분.

**구현 메모**:
- 5장 레이아웃은 한 줄 유지(`uniqueTops: 1` 검증 완료). 만약 모바일 세로화면에서 194px 카드폭이 너무 좁아지면 2행 배치로 분리 후보.
- `initializeDeck` 자체는 변경 없음 — 초기 드로우만 `slice(HAND_SIZE)`로 상한 반영.

## D-23. "카드로 아이템 사용" 프레임워크

**배경**: 요한 지시(2026-04-22) — "가방을 열어서 아이템을 소모시키는 방법"을 카드 효과의 하나로 일반화. 앞으로 여러 카드가 같은 패턴으로 아이템을 소비할 것이므로, 재사용 가능한 공통 경로로 추출한다. 첫 구현체는 **휴식 카드**(음식 1개 소비 → 회복 x2 + 발각 -10%).

**핵심 설계**: 카드 스펙에 두 개의 문자열 DSL 필드를 추가한다.

| 필드 | 용도 | 예시 |
|---|---|---|
| `consume` | 소비 대상 필터 + 효과 스케일링 규칙 | `category:음식;scale:recover=2` |
| `extra_effect` | 카드 자체가 부여하는 부가 효과 (DSL 재활용 가능) | `detection-10` (현재는 미사용, 카드 컬럼 `detection`이 기존 필드로 이미 처리됨) |

`consume` DSL 토큰:
- **필터**: `category:X` / `material_type:X` / `id:X` — 세미콜론으로 AND. (`id:stone` 같은 지정 소비도 가능)
- **스케일**: `scale:recover=N` — stat action 중 delta>0(= 회복)만 delta *= N.
- 미래 확장: `scale:damage=N`, `scale:defense=N` 등 action 타입 확장 시 추가.

**실행 흐름**:
1. 유저가 카드 클릭 → `useCard(card)` 진입
2. `card.consume` 존재 여부로 분기
3. consume 있으면 `openConsumeForCard(card)` → `EffectParser.parseCardConsume(raw)` → 필터 통과 아이템 0개면 "쓸 수 있는 아이템이 없다"로 조용히 종료(카드 미소모)
4. 통과 아이템 ≥1이면 `pendingConsume` state로 `CardItemConsumeModal` 오픈
5. 유저가 후보 하나 선택 → `resolveConsumeChoice(invItem)`
6. 아이템의 파싱된 `effect`를 `EffectParser.scaleEffect(effect, consume.scales)`로 변형
7. `applyItemEffect`로 디스패치 (기존 아이템 사용 경로 재활용 — 스탯/spawn_card 등 모두 지원)
8. 인벤에서 아이템 1개 제거 + `finalizeCardUse(card, msg)`로 카드 본체 소모(시간/발각/hand→graveyard)

**왜 이 구조인가**:
- **DSL 일관성 (D-03 유지)**: 컬럼을 늘리지 않고 문자열 파서로 처리. 시트에서 기획자가 한 줄로 의도 표현 가능.
- **관심사 분리**: 필터(parseCardConsume)·스케일(scaleEffect)·적용(applyItemEffect)이 각각 순수 함수. 단위 테스트 쉽고, 새 카드는 스펙만 추가하면 됨.
- **기존 경로 재사용**: `applyItemEffect`는 인벤에서 직접 사용할 때도, 카드로 사용할 때도 같은 파이프라인. 효과 추가(예: 신규 action 타입)가 양쪽에 자동 반영.
- **카드 미소모 원칙**: consume 필터 통과 아이템이 0개면 카드가 소모되지 않는다. 유저가 실수로 음식 없이 휴식 카드를 눌러 한 장 날리는 일이 없음.

**신규 파일 없음**. 구현은 기존 `effectParser.js` + `index.html` 내 컴포넌트 추가로 끝.

**핵심 API** (`effectParser.js`에 추가):
- `parseCardConsume(raw) → { filters, scales, raw } | null`
- `scaleEffect(parsed, scales) → parsed'` (pure; 원본 불변)
- `matchesConsumeFilter(consume, inventoryItem, notionItem) → bool`

**UI 컴포넌트** (`index.html`):
- `CardItemConsumeModal({ inventory, filter, titleText, emptyText, onSelect, onClose })`
  - 경량 리스트. 인벤 본 UI(테트리스·머지 등)를 재사용하지 않는 이유: 카드 사용 맥락은 "필터 통과 후보 목록에서 하나 고르기"만 필요 → 의사결정 비용 최소화.
  - 향후 후보가 많아지면 grid/scroll 확장 가능.

**휴식 카드 폴백 처리**:
- 시트 `베이스탐험카드`에 `rest` row가 아직 없음(Chrome MCP tab hidden 제약, D-17 후속). 런타임에서 `sheetBaseCards`에 rest id가 없으면 `REST_FALLBACK` 상수를 push로 보강.
- 시트 row가 추가되면 이 보강은 조건 `!cards.some(c=>c.id==='rest')` 때문에 자동 스킵 → SSOT 복귀.
- 휴식 스펙: `consume='category:음식;scale:recover=2'`, `detection=-10`, `time=1`, `count=1`.

**테스트 결과(2026-04-22)**:
- 5장 손패 중 휴식 카드 뽑힘 → 클릭 → 모달에 "버섯 (배고픔 +1)" 후보 1개 노출 → 선택 → 배고픔 11 → 12 (+2 적용) → 카드 무덤으로.
- 메시지: "휴식을(를) 사용했다. (시간 +1) 버섯을(를) 소모하고 배고픔 +2."
- 콘솔 에러 0.

**향후 적용 후보 카드**:
- 돌던지기(탐험 버전): `consume='id:stone'` + 전투 카드 대신 탐험 효과 디스패치(향후 action 타입 확장).
- 불 피우기: `consume='id:branch;id:stem'` (AND 복수 재료 — 스펙 확장 필요).
- 이것들이 나올 때마다 parser에 토큰만 추가하면 됨.

## D-24. 머지·조합 통합 시스템

**배경**: 요한 결정(2026-04-22, 5차 세션) — 머지/조합은 같은 기능의 두 분기다.
1. **머지(공간 압축 + 파생)**: 같은 재료 N개 → 상위 단계 1개. 중복 슬롯 압축 + 2단계 파생.
2. **조합(새 아이템)**: 서로 다른 재료 + 조합법 매칭 → 새 아이템 1개.
3. **SSOT**: Notion 아이템 DB의 `머지 가능` 체크박스 + `재료`/`결과물` relation + `조합법` 텍스트.

### 확정 규칙 (디렉터 판단)

| 항목 | 값 | 근거 |
|---|---|---|
| 머지 수량 N | **2** | 1단계 5종 × 손에 들어오는 수량 1~3개 페이스에 N=3이면 머지가 거의 발동 안 함 → "공간 압축" 효과 무력화. N=2는 자주 발동되되 merge_result가 null이면 머지 비활성이라 과도한 파생도 억제. |
| 조합 재료 수 | **2 이상** | 붕대(천+끈+약초) 같은 3종 조합이 기획에 존재. 2종 매칭 우선 지원, 3종 이상도 combos 스펙상 허용(`ingredients:[id,id,id]`). |
| 머지 결과 null | 조용히 머지 비활성 (swap 분기로 fallthrough) | 유저가 "왜 안 돼"로 막히지 않도록. UI는 교체로 처리. |
| 조합 실패 | 조용히 교체(swap) | 동일 원칙. |

### 데이터 모델

각 아이템 JSON에 런타임 접근용 필드 추가(`fetch_data.py::transform_notion_items`가 파생):
```json
{
  "id": "stone",                       // 새 id 키 (Notion의 name→id 매핑 테이블로 도출)
  "merge_enabled": true,               // Notion 체크박스 그대로
  "merge_result": null,                // 결과물 없으면 null → 머지 불가
  "merge_count": 2                     // 전역 상수. 향후 아이템별로 다르게 하면 number 컬럼 추가
}
```

조합 풀은 **전역 리스트**로 별도 파일 `data/combos.json` 생성. 아이템 간 교차 참조라 아이템 레코드에 종속시키지 않음:
```json
[
  { "ingredients": ["stem", "stem"],        "result": "plant_fiber" },
  { "ingredients": ["branch", "branch"],     "result": "wood" },
  { "ingredients": ["plant_fiber", "stem"],  "result": "clean_cloth" },
  { "ingredients": ["clean_cloth", "plant_fiber"], "result": "bandage" }
]
```
- `ingredients` 순서 무관(런타임에서 sort). 같은 id N개면 머지 분기로 먼저 시도 후 실패 시 조합 시도.
- 합치기 규칙 통일: "두 아이템 겹침" = 머지(같은 id) OR 조합(다른 id).

### id 매핑 (Notion ↔ 런타임)

Notion은 한글 이름(`돌맹이`, `나뭇가지` …)을 title로 쓰고, `inventory.js::ITEMS`는 영문 key(`stone`, `branch` …) 사용. `fetch_data.py`에 **name→id 매핑 테이블** 추가:

```python
ITEM_NAME_TO_ID = {
  "돌맹이": "stone", "나뭇가지": "branch", "질긴줄기": "stem",
  "버섯": "mushroom", "산딸기": "berry",
  "목재": "wood", "식물 섬유(끈)": "plant_fiber",
  "깨끗한 천": "clean_cloth", "붕대": "bandage",
}
```
- 이 테이블은 `inventory.js::ITEMS` 키와 정확히 1:1. 신규 아이템은 양쪽에 동시에 추가.
- Notion 결과물 relation은 URL 배열 → URL→이름→id로 해석.

### SSOT 분담

| 정보 | 위치 | 편집자 | 코드 참조 |
|---|---|---|---|
| `머지 가능` (체크박스) | Notion DB `머지 가능` | 요한 | `items.json::머지 가능`(bool) |
| 머지 결과물 | Notion DB `결과물` relation (자기참조) | 요한 | `items.json::merge_result`(id 문자열) |
| 조합 레시피 | Notion DB `조합법` 텍스트 (DSL) | 요한 | `combos.json` — `fetch_data.py`가 파싱 |
| 머지 수량 N | 전역 상수 (`MERGE_COUNT=2`) | 디렉터 | `inventory.js` 상수 |

### 조합법 DSL (Notion `조합법` 칼럼)

기존 서술형("나뭇가지 + 나뭇가지 → 목재 / 목재 + 목재 → ...")을 유지·확장. 파서는 각 slash-분절 안의 `재료 + 재료 [+ 재료…] → 결과물` 패턴만 추출하고 "고급" 등 주석은 버린다:

```
나뭇가지 + 나뭇가지 → 목재
질긴줄기 + 질긴줄기 → 식물 섬유(끈)
식물 섬유(끈) + 질긴줄기 → 깨끗한 천
깨끗한 천 + 식물 섬유(끈) → 붕대
```
- 왼쪽이 모두 같은 이름이면 머지 경로(추가 `머지 가능`=✓ + `결과물` relation 설정 필요). 파서는 중복 없이 둘 다 지원.
- 파싱 실패는 경고만 하고 스킵.

### 런타임 흐름 (inventory.js)

기존 `canMerge`/`mergeItems`/`confirmPlacement` **시그니처 유지**. 내부 로직만 교체:

```
canMerge(a,b)
  → a.type===b.type && a.mergeable && a.mergeResult (id) != null
getMergeResult(a) → 아이템 정의의 merge_result id
canCombine(a,b) → COMBOS에서 [a.type, b.type] 매칭 찾으면 true
getCombineResult(a,b) → 매칭된 result id

confirmPlacement:
  overlapped 1개일 때
    1) canMerge 시도 → merge 분기
    2) canCombine 시도 → combine 분기(새)
    3) swap
```

기존 `material_low/mid/high` 승급 경로는 폐기. 코드에서 `material_*` 참조는 남아있으면 제거(요한 QA에서 돌맹이 등 실 아이템으로 교체됐으므로 레거시 경로는 무해하지만 코드 정리 차원).

### UX 텍스트 (D-12 톤 유지)

- 머지 성공: "돌맹이 둘을 맞대어 짓이겼다. (머지 결과명)이(가) 됐다." — 생략 가능
- 조합 성공: "식물 섬유를 질긴 줄기로 감았다. 깨끗한 천이 완성됐다."
- 현재는 최소 구현: 메시지 없이 결과 아이템만 가방에 배치. UX 텍스트는 별도 이터레이션.

### 파괴적 변경 없음

- `canMerge`/`mergeItems`/`confirmPlacement` 시그니처 유지 → index.html 호출부(미리보기/확정 버튼) 회귀 없음.
- 미리보기 버튼 라벨은 `action:'merge'`/`action:'combine'`/`action:'swap'` 분기로 추가만 됨.

### 한계 / 미래 확장

- `merge_count`를 아이템별 다르게 두려면 Notion `머지 수량` number 컬럼 추가. 현재는 전역 N=2로 충분.
- 3종 조합(`clean_cloth + plant_fiber + herb → bandage`)은 스펙상 허용하되 UI는 "2개 겹침"만 지원 → 3종은 후속 이터레이션(예: 모루/제작대 UI).
- `combos.json`은 `data.js` 번들에 추가되어 `window.TTD_DATA.COMBOS`로 접근.

## D-20. 방문 타일에만 지역명 노출 (스포일러 방지)

**결정**: 지역 이름 오버레이는 `tile.visited && tile.region` 조건에서만 렌더.
**근거**:
- `revealed` 상태(`귀 기울이기` 등으로 정찰된 타일)까지 지역을 보여주면 "저기는 동굴이니까 돌맹이가 잘 나올 것" 같은 사전 정보가 드롭 전략에 직접 영향 → 탐험의 불확실성(= D-12 오감 텍스트 분위기의 핵심)이 붕괴.
- visited만 노출하면 "가보기 전에는 냄새·소리·그림자만 단서"라는 1인칭 관점이 유지된다.
**구현 메모**: `HexTile` 내에서 `<g class="hex-region-label">` 하위에 반투명 rect + 텍스트. 영어 코드(forest/thicket/plain/stream/cave) 대비 매핑 `REGION_LABEL` 상수 — 현재 region 값이 한글이지만 추후 i18n 여지.

## D-38. '좋은곳' 슬롯 게이트 = 획득 보장 (D-34 보강, 2026-04-22)

**결정**: `tile.type === 'good'` 타일에서 `rollSearchLoot`의 슬롯 게이트(100/80/80)를 통과하면 **반드시 아이템을 획득**한다. `rollTileDrop` 내부 카테고리 추첨에서 `none`을 제거하고 env/food만 비율대로 재분배.

**근거 / 버그**: D-34에서 '좋은곳' 슬롯 확률을 `[100, 80, 80]`으로 상향했으나, 게이트 통과 이후 `rollTileDrop`이 지역 테이블(`숲 none=25%`, `평원 none=45%` 등)로 2차 추첨 → 슬롯1이 100% 통과해도 지역 따라 25~45% 확률로 빈손. 요한 QA 보고: "좋은곳 타일에서 뒤져보기 첫 시도부터 아이템이 아예 안 얻어짐". 요한의 원문 정의("각기의 확률 100/80/80")는 게이트가 아니라 **획득률** — 게이트 통과 ≒ 획득 보장이어야 D-34 의도와 정합.

**구현**:
- `rollTileDrop(region, {forceAny: true})` 옵션 신설. `forceAny`면 `table.env`/`table.food`만으로 비율 재분배, `none` 없음.
- `rollSearchLoot`는 `tile.type === 'good'`일 때만 `forceAny: true`를 전달. 일반/함정 타일은 기존 동작 유지(회귀 없음).
- 시뮬레이션(10000회) 결과: good 숲 슬롯1 100%·슬롯2 80.2%·슬롯3 80.7% 획득, 평균 2.61개/회. normal 숲은 기존과 동일(슬롯1 75.4% 획득).
- D-35 반복 페널티와 직교: searchedCount·hasBeenLeft 곱수는 게이트 확률에만 곱해지므로 "좋은곳도 반복하면 줄어듦"은 그대로 작동.

**대안 기각**:
- (A) `rollTileDrop`에서 타일 플래그 직접 판정 → 레이어 혼재, dropTable이 tile 구조를 알아야 함.
- (B) '좋은곳'을 별도 region으로 등록 → 드롭풀 테이블을 지역×2로 늘려야 함. 침습적.
- 선택된 (C) `forceAny` 옵션: `rollSearchLoot`가 상위 판정 책임을 지고, `rollTileDrop`은 region-agnostic 유틸로 남음.

**파일**: `dropTable.js:110-160` (rollTileDrop forceAny), `dropTable.js:208-230` (rollSearchLoot 분기).

## D-39. LootToast 맵 컨테이너 내부 배치 + 불투명도 0.8 (2026-04-23, 8th 세션)

**결정**: 획득 토스트를 화면 전체 상단 14%에서 맵 컨테이너 내부 `top: 12px`로 이동. 배경 `rgba(22,33,62,0.8)` (이전 0.5).

**근거**: "맵에서 획득했다"는 공간 의미 강화 — HUD나 화면 최상단이 아니라 드롭이 일어난 장면(맵) 위에 얹히는 게 1인칭 감각에 맞다. 또한 투명도 0.5는 다른 UI와 배경이 비쳐 글자 가독성이 떨어짐. 0.8로 올려도 모달은 아니므로 답답하지 않다.

**구현**: `LootToast`의 position: absolute + 부모 `.map-container`가 position: relative. 스크롤과 무관하게 맵 컨테이너 상단 고정. z-index 1500으로 조우 모달(1000~1100) 위. 최상위에 있던 중복 마운트는 제거(GameMap 내부 단일 인스턴스).

## D-40. find_food 카드에도 LootToast 적용 (2026-04-23, 8th 세션)

**결정**: `useCard('find_food')` 분기에서 아이템 획득 성공 시 `showLootToast([{name, count:1, grade}])` 호출. search와 동일한 UX로 통일.

**근거**: find_food는 지역 food 풀에서 단일 아이템을 뽑는 카드인데, 지금까지는 메시지 바 텍스트로만 알림 → 드롭이 일어났다는 시각 인지가 약했다. 요한 QA: "search는 토스트 뜨는데 find_food는 왜 없냐, 같이 써야 일관적". 토스트 entries 구조 그대로 유지(count=1 단일 원소)라 Toast 컴포넌트 수정 불필요.

**구현**: `index.html` find_food 분기. 가방 포화(added=false)인 경우 토스트 생략(search와 동일 규칙 — 실제 가방에 들어간 것만 노출).

## D-41. 롱프레스 텍스트 선택·컨텍스트 메뉴 차단 (2026-04-23, 8th 세션)

**결정**: `#root` 컨테이너에 `user-select: none` + `-webkit-touch-callout: none` CSS. JS에서도 `contextmenu` 이벤트 preventDefault. input/textarea/contenteditable은 예외로 텍스트 선택 허용.

**근거**: 모바일 Safari에서 인벤토리 슬롯·카드·맵 타일을 길게 누르면 텍스트 선택 + "복사/공유" 팝오버가 떠서 게임 조작을 가로막는다. 롱프레스는 머지 UI(D-32)와 인벤토리 상세의 게임 조작이라 브라우저 기본 동작을 차단해야 함. CSS만으로는 일부 iOS 빌드에서 컨텍스트 메뉴가 뜨는 경우가 있어 JS 레벨 preventDefault 이중 방어.

**구현**: `gameStyles.css` `#root` 규칙 + `input/textarea/[contenteditable]` 복구 규칙. `index.html` 스크립트 끝에서 `document.getElementById('root').addEventListener('contextmenu', ...)` 등록. 향후 입력 폼 추가해도 자동 예외.

## D-42. 보스 가시성 분리 — 이동 시 재은닉 (공포 원칙 강화, 2026-04-23, 8th 세션)

**결정**: 보스 아이콘 노출 조건을 `tile.revealed`에서 별도 state `bossVisible`로 분리. `listen` 1칸 분기에서 `setBossVisible(true)`, `moveTo`에서 `setBossVisible(false)`. 지형 `revealed`는 그대로 유지.

**근거 / 공포 원칙**: 기존에는 listen 1칸으로 보스 타일이 revealed → 이후 플레이어가 이동해도 revealed가 유지되어 보스 위치가 계속 드러남. "한 번 본 위치는 계속 안다"는 설계는 보스 = 공포의 대상 (D-11) 원칙과 충돌. 이동 후에는 보스가 움직였을 수도 있으므로 **매 이동마다 귀 기울이기를 다시 소비해야 보스 위치 확인** 이 되도록. 지형 단서는 기억해도, 포식자의 위치는 기억할 수 없다.

**대안 기각**:
- (b) `tile.bossRevealed` per-tile 플래그 + moveTo에서 전 타일 리셋: 타일 데이터 오염, 매 moveTo마다 전 tiles map() 추가 비용.
- 선택된 (a) 단일 boolean state: 보스 위치는 원래 하나뿐이라 state 하나면 충분. 렌더에서 `tile.id === boss.position && bossVisible` 한 줄로 판정.

**구현**:
- `index.html` state 선언
- `HexTile` / `GameMap` props 추가 (bossVisible)
- `HexTile` getTileColor + getTileLabel 판정 분리
- `useCard('listen') bossDist===1` 분기: `setBossVisible(true)` 추가
- `moveTo` 진입 직후: `setBossVisible(false)` 추가

**파일**: `index.html` (HexTile, GameMap, state, listen, moveTo).

## D-50. 사냥 전투 명중률(accuracy) 축 분리 (2026-04-24, 11th 세션)

**결정**: 전투 카드에 기존 `success_rate`(카드 자체 성공률)와 별개의 축 `accuracy`(정수 %)를 신설. 무기는 자체 `accuracy`를 가지며, 카드 렌더 시 `card.accuracy + weapon.accuracy`로 합산. 판정 공식은 `effectiveEvade = max(0, prey.evade_rate - totalAccuracy)` → 이 값으로 prey 회피 롤.

**근거**: 기존엔 `success_rate`가 "카드 사용 자체의 성공(던지기가 대상 근처로 갔는지)"과 "회피 가능 여부"를 한 축에 섞어 놨다. 요한 피드백: "무기가 좋으면 맞히기 쉬워야 한다" — 무기 정확도라는 개념을 도입하면 이 두 축이 독립돼 카드 튜닝 여지가 커진다. 예: 새총은 'success_rate 100'이지만 새·작은 사냥감에 명중 +90%로 평원/시냇물 사냥에 특화.

**스펙**:
- 시트 `전투카드`에 `accuracy` 컬럼 신설(int). punch 0, throw_stone 20, stab_weapon 30, dodge/run_away 0, throw_spear 20, slingshot_shot 90.
- 시트 `무기`에 `accuracy` 컬럼 신설(int). weapon_basic 10, slingshot 90.
- `combatDeck.buildHuntDeck`: 각 카드에 대해 owning weapon(requirement의 무기 이름)을 찾아 accuracy 합산 + `weaponId` 주입(D-51 경로에서 재사용).
- `resolveHunt`: 공격 판정에서 `effectiveEvade = max(0, evadeRate - (card.accuracy || 0))`. 기존 `evadeRate` 직접 사용 줄 교체.
- UI(HuntCombatModal 손패·슬롯): damage>0 카드에 한해 "명중 +N%" 배지 노출. dodge/run_away는 accuracy=0이라 자동 미노출.

**회귀 안전망**: 기존 JSON에 accuracy 필드가 없는 경우 `(card.accuracy || 0)` 폴백으로 0 처리. 시트 업데이트가 선행되지 않아도 기존 동작 그대로 유지.

**파일**: `scripts/fetch_data.py`(rows_to_weapons), `combatDeck.js`(buildHuntDeck/resolveHunt), `index.html`(HuntCombatModal 배지).

## D-51. 무기 내구도 시스템 + 실시간 재고 반영 (2026-04-24, 11th 세션)

**결정**: 무기 아이템 인스턴스에 런타임 필드 `durabilityLeft:number`를 부여. 전투에서 무기 요구 카드를 사용하면 `durabilityLeft`를 1 차감, 0 이하가 되면 인벤에서 제거. 전투카드에 `full_loss`(Y/N) 컬럼이 있고, Y인 카드는 성공 시 무기 1자루를 즉시 소멸(인벤 제거). 핵심: **턴 진행 중 실시간 재고 추적** — 창던지기 카드를 슬롯에 3개 배치해도, 1턴에서 창 1자루를 잃으면 2·3턴은 `autoFail: reason='weapon_missing'` 로 처리.

**근거 (요한 원문)**: "창던지기 카드는 나무창이 있을 때만 생성되는 것. 근데 전투 순서상 (창던지기, 창던지기, 창던지기)인 경우 처음 던진 창이 그대로 소실될 수 있음. 실시간 반영해 첫번째 창던지기로 창을 잃은 경우 2·3번째가 자동 실패하도록 전투 시나리오를 짜야함." 즉 전투 결정 이후 일괄 차감으로는 이 시나리오를 못 만든다. resolveHunt가 턴 루프 내부에서 `weaponState`를 추적해야 옳다.

**스펙**:
- 시트 `전투카드`에 `full_loss`(Y/N) 컬럼 신설. throw_spear=Y, 나머지 N.
- 시트 `무기`: weapon_basic durability 10→5 (요한 밸런스 조정).
- `combatDeck.resolveHunt(prey, userSlots, { weaponState })`:
  - weaponState = { [weaponId]: { durabilityLeft } } — 런타임 재고 스냅샷.
  - 턴 시작 시 card.weaponId가 있으면 durabilityLeft 확인 → 0이면 autoFail.
  - 카드 success_rate hit 성공 + damage>0 경로에서만 무기 사용 카운트(명중/회피 무관).
  - full_loss=Y면 남은 durability 전부 날림; 아니면 -1.
  - 반환 객체에 `weaponUsage: { [weaponId]: { used, broken, fullLossCount, durabilityFinal } }` 포함.
- `inventory.consumeWeaponUse(item, n, fullLoss)`: durabilityLeft 차감 후 0이면 제거.
- `addItem` / `_placeDerivedItem`: `resolveDef(type).durability`가 있으면 `durabilityLeft` 필드 자동 초기화.
- UI: 무기 요구 카드에 "내구 N/M" 배지 + autoFail 턴 로그에 "무기가 없어 실패" 메시지. ItemInfoModal에도 내구도 노출.
- `handleHuntResolve`: 기존 requirement 기반 일괄 소비 경로를 재료/무기로 분기. 일반 재료는 `removeItem`, 무기는 `weaponUsage` 기반 `consumeWeaponUse`.

**디렉터 해석 — full_loss 컬럼 방식 채택**: 창던지기 손실을 "durability 전량 차감"으로 구현하는 대안도 있었으나, 명시적인 `full_loss=Y`가 카드 데이터로 읽히는 편이 설계 의도를 명확히 드러내며 미래 확장(예: 재사용 가능한 던지기 무기)도 대응하기 쉽다.

**파일**: `inventory.js`(consumeWeaponUse, durabilityLeft 초기화, slingshot entry), `combatDeck.js`(resolveHunt weaponState 루프), `index.html`(HuntCombatModal weaponState 구성, handleHuntResolve 분기, ItemInfoModal).

## D-52. 새총(slingshot) 아이템 + 복합 requirement DSL (2026-04-24, 11th 세션)

**결정**: 신규 1단계 무기 `slingshot` 추가. 조합법 `branch + plant_fiber → slingshot` (나뭇가지 + 끈). 새 전투카드 `slingshot_shot`는 복합 요구 `"새총 + 돌맹이"` — 즉 무기와 탄약을 모두 보유해야 활성. 이를 위해 requirement 파서를 `parseRequirement(req) → string[]`로 확장.

**근거**: 새총은 설계상 "돌맹이를 탄약으로 쓰는 원거리 무기"다. 탄약 소비 없이 공격할 수 있다면 무기 밸런스가 무너진다. 단일 requirement 문자열로는 이 조건을 표현할 수 없어 DSL 확장이 필수. 포맷은 `" + "`(공백 포함) 구분으로 단순화 — 기존 단일 재료 문자열과 완전 호환(split 결과가 [원문] 1개).

**스펙**:
- 시트 `아이템마스터`: slingshot row (1단계, 1x1, 무게 1, durability 3).
- 시트 `무기`: slingshot row (accuracy 90).
- 시트 `조합레시피`: `branch + plant_fiber → slingshot`.
- 시트 `전투카드`: slingshot_shot (damage 3, success_rate 100, accuracy 90, requirement "새총 + 돌맹이", full_loss N).
- `combatDeck.parseRequirement`: `" + "` 구분 파서. "없음" 계열은 [] 반환.
- `combatDeck.buildHuntDeck`: requirement 재료 각각의 보유 개수 확인 → `slotLimit = min(보유 개수들)`. 하나라도 0이면 카드 제외. 무기 요구 재료는 accuracy 합산에 반영.
- `handleHuntResolve`: 턴별로 requirement를 parse해 각 재료를 1개씩 차감. 무기 재료는 weaponUsage 경로로, 일반 재료는 기존 removeItem 경로로.
- `inventory.ITEMS`에 slingshot 폴백 정적 정의 추가(TTD_DATA 로드 실패 대비).

**Notion 등재는 skip**: D-30 이후 런타임 SSOT가 시트로 이관됐고, Notion 구 DB는 서사 참조용이다. 이번 세션에선 시트만 처리 — meat(D-46) 때와 동일 패턴.

**파일**: `inventory.js`(ITEMS.slingshot), `combatDeck.js`(parseRequirement, buildHuntDeck 복합 요구), `index.html`(handleHuntResolve 복합 요구 소비), 시트 4개 탭 + `data/*.json` 재생성.

## D-53. 결과 화면 보스 경로 + 전체 맵 윤곽 (2026-04-24, 11th 세션)

**결정**: 승리 후 [맵 보기] 모드에서 ① 보스가 지나간 타일에 빨간 동그라미 + 순서 라벨(B1, B2...) 오버레이, ② 방문하지 않은 타일도 반투명 회색으로 렌더해 맵 전체 크기·형태를 공개한다. D-48의 플레이어 노란 번호(방문 순서)는 그대로 유지.

**근거 (요한 지시)**: 승리 후 "회고" 맥락에서는 플레이어 동선만 보이는 게 부족하다. 보스가 실제로 어떻게 움직였는지, 얼마나 스치듯 지나갔는지 복기할 수 있어야 "아슬아슬했다"는 공포 감정이 보상으로 돌아온다. 미방문 타일까지 공개하는 이유는 "내가 실제 맵의 얼마만 본 거였나"를 확인시키는 것.

**D-42 예외 처리**: 인게임에서는 보스 위치 가시성을 "방금 listen 성공한 순간"으로 제한(D-42). 결과 화면은 게임 종료 후 공개 리뷰 맥락이라 이 원칙의 예외로 둔다. 플레이 중 공포의 긴장과 결과 회고의 정보 공개는 서로 다른 목적.

**스펙**:
- `Game`에 `bossMoveHistory: number[]` state 추가. `initializeGame`에서 `[bossPos]` 로 초기화(시작 위치가 B1).
- `moveTo`: 보스 이동 처리 직후, 새 위치가 이동 전과 다르고 history 끝값과도 다르면 push. 같은 자리 유지 턴과 A→B→B 중복은 skip(보스가 한 자리에 여러 턴 머물러도 라벨은 하나).
- `GameMap`: `showPathView` 모드일 때 `tiles.filter(!isEmpty)`로 전체 타일 공개. 평상시엔 기존 visited/discovered/revealed 필터 유지.
- `HexTile`:
  - `pathUnvisited = showPathView && !tile.visited` 플래그로 회색 반투명 폴리곤만 그리고 라벨/마커/흔적/지역명 숨김.
  - `bossMoveHistory.indexOf(tile.id)` ≥ 0 이면 우측에 빨간 원(#e94560) + `B{idx+1}` 라벨. 플레이어 노란 원은 좌측 그대로.
- `gameStyles.css`: `.hex-tile.path-unvisited`(cursor·hover 중화), `.boss-path-dot`(드롭셰도우).

**파일**: `index.html`(Game state, moveTo, GameMap 필터, HexTile 렌더), `gameStyles.css`.

## D-54. 원형 스크롤 패딩 — 완전 투명 (2026-04-24, 11th 세션)

**결정**: 7x7 플레이 그리드 주변에 `PADDING_HEXES = 7` 만큼 빈 hex 영역을 SVG 캔버스에 확보한다. 원형 테두리나 장식은 렌더하지 않는다(완전 투명). 유저는 스크롤 끝까지 밀어도 타일이 없는 빈 공간만 계속 이어져, "맵이 여기서 끝난다"는 경계감을 느끼지 못한다.

**근거 (요한 원문)**: "유저가 맵 한계지점을 느끼는 부분이 없게." 맵 경계가 드러나면 플레이어는 무의식적으로 "모서리 안에서만 돌면 된다"는 안도감을 얻고, 공포의 개방감이 깨진다. 원형 테두리를 실제로 그리는 대신 "스크롤해도 계속 빈공간"이라는 물리적 거리감으로 처리.

**스펙**:
- `mapGenerator.js`:
  - `PADDING_HEXES = 7`, `HEX_COL_STEP/ROW_STEP/HALF_*` 상수 추출.
  - `generateHexPositions`: `xOffset = PADDING_HEXES * HEX_COL_STEP + 100`, `yOffset = PADDING_HEXES * HEX_ROW_STEP + 100` 을 모든 좌표에 더함. 플레이 그리드가 캔버스 중앙으로 이동.
  - `getMapExtent(): { totalWidth, totalHeight }` 신설. GameMap의 svg width/height 산출용.
- `index.html::GameMap`:
  - 하드코딩 `width=1100 height=1000` → `new MapGenerator(7).getMapExtent()` (useMemo 1회).
  - `useLayoutEffect` 초기 중앙 정렬은 `tiles[currentTile].position` (패딩 오프셋 반영된 새 좌표) 기반이라 자동 동작.
- 타일은 기존 7x7만 렌더. 패딩 영역은 빈 공간.

**파일**: `mapGenerator.js`(상수·generateHexPositions·getMapExtent), `index.html::GameMap`.

## D-55. 스탯 경고 피드백 — 게이지 빨간 점멸 (2026-04-24, 12th 세션)

**결정**: 위험 임계에서 게이지 채움 부분이 빨갛게 점멸해 즉각 경고한다.
- `hunger ≤ 3`: 배고픔 게이지 점멸.
- `health ≤ 2`: 생명력 게이지 점멸.
- 라벨·숫자·아이콘은 정상 표시 유지. 채움(fill) div에만 애니메이션 적용.

**근거 (요한 지시)**: 기존 hungerColor/healthColor 색상 변화(D-37)만으로는 게임플레이 중 "위험 상태"가 직관적으로 인지되지 않는다. 점멸은 시각적 알람으로 플레이어 주의를 끌어 즉시 대응(식사·치료)을 유도.

**스펙**:
- `gameStyles.css::@keyframes gauge-warning-pulse`: 0.6s alternate, `opacity 1↔0.55` + `box-shadow inset` 빨간 글로우.
- `.gauge-warning` 클래스를 채움 div에 토글.
- `StatGauge({ ..., warning })` prop 추가. `StatPanel`에서 `warning={health<=2}` / `warning={hunger<=3}` 주입.
- 기존 `healthColor`/`hungerColor` 팔레트는 그대로 — 점멸은 위에 얹는 레이어.

**파일**: `gameStyles.css`, `index.html::StatGauge`, `index.html::StatPanel`.

## D-56. 보스 사망 연출 통합 — 점프스케어 + "삼켰습니다" + defeat 맵보기 (2026-04-24, 12th 세션)

**결정**: 보스 조우(같은 타일 진입)로 게임오버가 날 때 점프스케어를 먼저 보여주고 0.55s 뒤 GameEndModal을 띄운다. 문구는 "보스가 당신을 삼켰습니다"로 교체하고, victory뿐 아니라 defeat(보스·체력·배고픔)에서도 [🗺️ 맵 보기]를 노출해 보스 경로를 복기할 수 있게 한다.

**근거 (요한 지시)**: 보스에게 잡히는 순간이 "그냥 로그 한 줄 뒤 모달"로 끝나면 긴장감이 보상으로 전환되지 않는다. 점프스케어 → 모달 순서로 "먹혔다"는 감정이 확실히 전달되고, 모달 문구는 서사보다 사실적 1인칭 선고("삼켰습니다")로 마감. 사망 시에도 맵을 볼 수 있게 해야 "어디서 어떻게 따라잡혔는지" 분석·학습이 가능.

**스펙**:
- `DEATH_NARRATIVE.boss.subtitle`: "그림자가 덮치는 순간…" → `"보스가 당신을 삼켰습니다"`. `guide`는 유지.
- `moveTo` encounter 분기 (보스와 같은 타일):
  ```js
  setBossJumpscare(true);
  setTimeout(() => {
      setBossJumpscare(false);
      setGameOver(true);
      setDeathReason('boss');
  }, 550);
  ```
  기존 `listen` 거리 1의 점프스케어는 연출만(게임오버 없음) — 이 경로와 별개.
- `GameEndModal`: [🗺️ 맵 보기] 버튼에서 `victory &&` 조건 제거. defeat 전 사유(starvation/health/boss) 모두에서 경로 회고 가능.
- 플로팅 바 문구: `← 승리 화면` → `victory ? '← 승리 화면' : '← 결과 화면'`.

**파일**: `index.html`(DEATH_NARRATIVE, moveTo encounter, GameEndModal, showPathView 플로팅 바).

## D-57. 휴식 = 요리 시스템 — 꼬치·구이 + 바베큐 폐지 (2026-04-24, 12th 세션)

**결정**: 기존 "바베큐(생고기+나뭇가지/목재 → hunger+4 즉시 회복)" 가상 선택지를 완전히 제거하고, **꼬치 조합 + 꼬치구이 요리** 2단계 파이프라인으로 교체한다.

**아이템 4종 추가**:
| id | name | 효과 | 조합 |
|---|---|---|---|
| `meat_skewer` | 생고기꼬치 | hunger+1, health-1 (일회용, 2단계) | meat + branch |
| `fish_skewer` | 물고기꼬치 | hunger+1, health-1 (일회용, 2단계) | fish + branch |
| `grilled_meat_skewer` | 고기꼬치구이 | hunger+2, **health+1** (일회용, 3단계) | 요리(meat_skewer) |
| `grilled_fish_skewer` | 생선꼬치구이 | hunger+2, **health+1** (일회용, 3단계) | 요리(fish_skewer) |

**근거 (요한 확답)**: 바베큐는 재료 소비가 숨겨진 즉시 회복이라 인벤토리 시스템과 통합이 어설펐다. 꼬치(합성 패널)와 요리(휴식 카드 전용 모달)로 분리하면:
- 꼬치 = "날것을 쓸만한 휴대 식량으로" (여전히 health-1 리스크).
- 구이 = "불에 안전하게 익혀 든든하게" (health+1로 회복까지).
- 2단계 진행이 명시적 플로우로 드러나 플레이어가 "요리" 행위를 자원 관리 축으로 인식.
- 구이 효과 `hunger+2; health+1`은 요한 확답 (계획봇 초안 `health±0`에서 상향).

**파이프라인**:
- **꼬치**(2재료): `조합레시피` 시트 2행 추가 → `combos.json` 정상 반영. 합성 패널(인벤 드래그)에서 자동 지원 (`findRecipesContainingAny`).
- **구이**(1재료): `조합레시피` 시트에 `ingredient_a`만 채운 행 2개. `build_combos_from_sheet` 로직에서 1재료 레시피 허용하도록 조건 완화 (기존 `a and b and r` → `a and r`).
- 1재료 레시피는 `findRecipesContainingAny::uniq.size<=1` 필터로 합성 패널에서 자동 제외 — **휴식 카드 → 요리 모달** 경유로만 생성 가능.

**UI 변경**:
- `CardItemConsumeModal`: `extraOptions`/`onExtraSelect` prop 제거. `onCookClick`/`canCook` 추가. 휴식 카드에서만 주입되며 hintText 아래 [🔥 요리하기] 버튼 노출 (canCook=false면 회색 비활성).
- `CookingModal` 신규: `TTD_DATA.COMBOS.filter(r => r.ingredients.length===1 && r.result.startsWith('grilled_'))`. 레시피 카드에 재료명 → 결과물명 + 효과 요약 + [🔥 요리하기] 버튼. 클릭 시 `inventory.craftRecipe` 호출.
- `openConsumeForCard`의 `card.id==='rest'` 바베큐 블록 삭제. `handleExtraConsume`, `confirmBbq` 함수 삭제.

**데이터 흐름**:
1. 시트 `아이템마스터`·`조합레시피` 편집 (gspread API, 1회성 `scripts/_d57_append_rows.py` 후 삭제).
2. `ITEM_NAME_TO_ID` 4개 매핑 추가 (`fetch_data.py`).
3. `make data` → `items.json` 16→20, `combos.json` 9→13.
4. `inventory.js::ITEMS` 폴백 엔트리 4개 추가 (D-23 REST_FALLBACK 패턴).

**Notion 생략**: D-30 이후 런타임 SSOT가 시트로 이관됐고, Notion 아이템 DB는 레거시(서사 참조). 이번도 meat(D-46)·slingshot(D-52)과 동일 패턴으로 Notion 등재 스킵.

**파일**: `data/items.json`·`data/combos.json`·`data/data.js`(자동 재생성), `scripts/fetch_data.py`(ITEM_NAME_TO_ID + 1재료 레시피 허용), `inventory.js`(ITEMS 4종 폴백), `index.html`(CardItemConsumeModal prop 교체, CookingModal 신규, handleCookRecipe, cookingOpen state, BBQ 함수 3개 제거), 시트 `아이템마스터`·`조합레시피` 탭.

## D-60. 사냥감 턴별 회피율 + 도주 누적 패널티 (2026-04-24, 12th 세션)

**결정**: 단일 `evade_rate` 값을 3턴 공통으로 쓰던 기존 모델을 **턴별 회피율 + 도주 누적 패널티** 2축 시스템으로 확장한다.

**신규 SSOT 컬럼**: 시트 `사냥감` 탭에 `evade_per_turn` CSV 컬럼 추가. 형식 `"T1,T2,T3"`. 빈값이면 `evade_rate` 3턴 공통으로 폴백.

**Level 1 9종 T3 하향 수치 (요한 확정)**:
| 사냥감 | evade_rate | evade_per_turn |
|---|---|---|
| rabbit | 30 | 30,30,20 |
| mouse | 20 | 20,20,10 |
| squirrel | 40 | 40,40,25 |
| bird | 40 | 40,40,25 |
| salamander | 20 | 20,20,10 |
| snake | 20 | 20,20,10 |
| frog | 30 | 30,30,20 |
| crab | 20 | 20,20,10 |
| grasshopper | 50 | 50,50,30 |

Level 2 사냥감 7종은 빈값 — 기존 evade_rate 그대로 사용.

**도주 누적 패널티**: prey 개체가 도망칠 때마다 `fleeCount += 1`. 재조우 시 매 턴 base 회피율이 `fleeCount*10` 차감 (max 0). 토끼 1회 도망 → T1/T2 30→20%, T3 20→10%. 2회 도망 → T1/T2 10%, T3 0%.

**근거**: 계획봇 분석 — "회피형 중심 1단계 사냥감에서 3턴 막타 명중 안정성이 부족하고, 도망 시 동기부여(실패해도 다음 번 쉬워짐)가 없어 '도망 후 재사냥' 플로우가 루즈했음". T3 하향으로 마무리 일격 확률 확보 + fleeCount 패널티로 도망친 prey를 추적할 유인.

**구현**:
- `combatDeck.js`: `parseEvadesByTurn(prey)` 헬퍼 신설 (CSV 파싱, 길이 3 보장, 부분 CSV는 마지막 값 패딩). `resolveHunt`는 `evadeRate` 단일값 대신 `evadesByTurn[t] - fleeCount*10` 턴별 계산. `effectiveEvade = max(0, baseEvadeT - card.accuracy)`.
- `index.html::HuntCombatModal::computedEvades`: `CombatDeck.parseEvadesByTurn(prey)` + fleeCount 반영. 턴별 `base` 다르게 계산 → 적 행동 슬롯 UI가 T1/T2/T3 다른 값으로 노출.
- `index.html::useCard('hunt_start')`: activeHunt 세팅 시 `evade_per_turn`, `fleeCount` 전달.
- `index.html::handleHuntResolve` prey_fled 분기: `fleeCount: (p.fleeCount||0)+1` 로 누적. victory/player_fled는 건드리지 않음.

**SSOT 원칙**: `resolveHunt`와 `computedEvades`가 동일 공식을 공유 (D-58 교훈 — 렌더·판정 분기 금지). `parseEvadesByTurn`을 export해 양쪽이 같은 파서 사용.

**파일**: 시트 `사냥감` 탭(`evade_per_turn` 컬럼 + 9 rows), `data/prey.json`·`data/data.js`(자동 재생성), `combatDeck.js`(parseEvadesByTurn, resolveHunt 턴별), `index.html`(HuntCombatModal computedEvades, useCard hunt_start, handleHuntResolve prey_fled).

## D-61. 맵 크기 7x7 → 11x11 (2026-04-24, 12th 세션)

**결정**: 플레이 그리드를 1.5배(7→11, 정확히는 10.5 반올림) 상향. 타일 수 49→121 (2.47배). 탐험 여지와 보스와의 거리감 확보.

**구현**:
- `index.html`: 전역 상수 `MAP_SIZE = 11` 도입 (DRY — 모든 `new MapGenerator(N)` 호출부 한 곳에서 관리). 기존 3곳 `MapGenerator(7)` → `MapGenerator(MAP_SIZE)` 치환.
- `mapGenerator.js::_generateOnce`:
  - `cornerCandidates` 하드코딩 배열 → `getCornerCandidates()` 메서드. 4꼭짓점+상하 가운데를 gridSize 기반으로 계산 (7x7: [0,6,42,48,3,45], 11x11: [0,10,110,120,5,115]).
  - `emptySlotCount`: 고정 10~15 → `totalTiles * (0.20~0.31)` 비율. 11x11에선 24~37개. 기존 비율 유지.
  - `minBossDistance`: 고정 5 → `max(5, floor(gridSize * 0.7))`. 11x11에선 7.
  - `specialTiles`: 고정 good=4/trap=2 → `totalTiles/49` 스케일. 11x11에선 good≈10/trap≈5.
- `PADDING_HEXES = 7`은 그대로(D-54). 맵이 커져도 스크롤 여유 7 hex면 충분.

**검증**:
- Node 시드 1회: tiles 121, nonEmpty 90, good 10, trap 5, 보스 거리 12칸. mapExtent 2915x2475.
- `make data` 불필요(데이터 변경 없음).
- useLayoutEffect 중앙 정렬은 `cur.position` 기반이라 자동 동작.

**파일**: `index.html`(MAP_SIZE 상수, 3곳 MapGenerator 교체), `mapGenerator.js`(getCornerCandidates, _generateOnce 스케일 로직).

## D-62. 보스 미방문 타일 선호 배회 (2026-04-24, 12th 세션)

**결정**: 일반 모드(chase 아님) 보스가 인접 타일 중 아직 밟지 않은 곳을 우선 선택해 이동. 전맵 순회를 유도해 11x11 확대 맵에서 보스가 한 구역에 맴도는 문제 방지.

**구현**:
- `boss.js::BossMonster`:
  - 생성자에 `this.visitedTiles = new Set([this.position])` 신규 필드.
  - `setPosition(pos)` 헬퍼: 외부 override 시 visitedTiles도 동기화.
  - `moveRandom()`: 인접 중 미방문 타일 필터 → 있으면 거기서 랜덤 선택, 없으면 기존 인접 전체에서 랜덤. 이동 후 visitedTiles에 추가.
  - `moveTowards()` (chaseMode 용): 기존 최단 접근 로직 유지 + 이동 후 visitedTiles에 추가. chase는 플레이어 접근이 최우선이므로 미방문 필터 적용 안 함.
- `index.html::initializeGame`: `newBoss.position = bossPos` 직접 할당을 `newBoss.setPosition(bossPos)` 로 교체 — visitedTiles에 실제 스폰 위치 반영(findSpawnPosition 임시 자리 오염 방지).
- `index.html::moveTo` 일반 모드 블록: 인라인 랜덤 이동(`bossConnections[random]`) → `boss.moveRandom()` 위임. 최신 tiles 참조를 위해 `boss.tiles = newTiles` 주입.

**분리 원칙**:
- `bossMoveHistory`(UI) vs `visitedTiles`(내부 AI): 전자는 결과화면 경로 시각화용, 후자는 이동 결정용. 역할 분리.
- `visitedTiles`는 게임 내 지속, 리셋 없음.

**검증**:
- Node 시뮬 (valid 시드, 60 player moves = 30 movable turns):
  - `same after move = 0` — 이동 턴마다 반드시 실제 이동 발생.
  - `visitedTiles.size = 23`, 고유 시퀀스 22 — 기존 랜덤(평균 7~10 고유)보다 현저히 많음.

**파일**: `boss.js`(visitedTiles, setPosition, moveRandom/moveTowards), `index.html`(initializeGame setPosition, moveTo 일반 모드 moveRandom 위임).
