# project-state.md

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-99**).
D-99 새 무기 뗀석기 + 치기·던지기 카드:
- combos.json: stone×3 → chipped_stone.
- weapons.json: chipped_stone (내구도 3, 공격력 0, accuracy 0, 2x1 — 요한 후속 지시).
- items.json: chipped_stone (slingshot 패턴, 카테고리=무기, 2x1).
- inventory.js static ITEMS: chipped_stone (shape=[[1,1]], grade 1, category='무기').
- combat_cards.json:
  - chipped_stone_strike (뗀석기로 치기) damage 2 acc 0 full_loss N — 1차감.
  - chipped_stone_throw (뗀석기 던지기) damage 3 acc 1 full_loss Y — 1회에 분실.
- Node 스모크 3 케이스 PASS: 토끼+치기/치기/던지기 → 던지기 후 durability 0/broken/fullLoss=1 ✓; 메뚜기+던지기 즉살 + 무기 분실 ✓; 토끼+치기 단독 → durability 2 ✓.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-98**).
D-98 L1 사냥감 행동 패턴 도입 (peek≤2 / evade≤1 / defend≤1, 3턴):
- prey.json L1 9종 actions_per_turn + defense=1.
  - 토끼 peek,defend,evade · 쥐 peek,peek,evade · 다람쥐 peek,evade,peek · 메추라기새 peek,peek,evade
  - 도롱뇽 peek,evade,defend · 작은 뱀 peek,defend,evade · 개구리 peek,evade,peek
  - 게 peek,defend,evade · 메뚜기 peek,peek,evade.
- combatDeck.js: `parsePreyActions`에 lvl 분기 fallback(L1=peek,evade,peek / L2=기존). resolveHunt에서 `isLevel2 ?` 가드 제거 — L1도 actions DSL 사용. baseEvadeT=0/defenseReduction L1/L2 공통.
- index.html HuntCombatModal::preyActions: `if (SLOT_COUNT !== 4) return null` 제거, lvl 기반 fallback. L1 적 행동 슬롯에 peek/defend/evade 라벨 + 수치 배지 자동 노출.
- Node 스모크 4 케이스 PASS: 토끼+주먹×3→hp4→3 (T2 defend 차감), 토끼+주먹/주먹/새총→hp 0 (T3 evade 명중), 메뚜기 hp1→T1 peek 즉살, 작은뱀+돌×3→T2 hp 0.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-97**).
D-97 무기 카드 명중·데미지 재조정 + 창던지기 확률 분실:
- combat_cards.json: slingshot_shot acc 3→1, stab_weapon acc 3→1, throw_spear acc 3→2 dmg 4→6 full_loss "Y"→"N" + 신규 `loss_chance: 50`.
- combatDeck.js::resolveHunt: `probLoss = !fullLoss && lossChance>0 && Math.random()*100 < lossChance` → recordWeaponUse(wid, fullLoss||probLoss). 분실 부분은 결정론 예외(무기 손실은 본질적으로 random).
- UI: 손패/슬롯 카드에 ⚠ N% 분실 라인 (#ff9999, fontSize 10). full_loss=Y면 "100% 분실".
- Node 스모크: throw_spear 1000회 시뮬 분실 ~50% (loss_chance=50 기대치 일치) ✓.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-96**).
D-96 회피율/명중률 % → 회피/명중 정수 시스템 통일:
- 변환 round(% / max * 3) half-up. 회피 max=60→3, 명중 max=20→3 (별도 정규화).
- 데이터: prey evade_rate(L1 토끼/다람쥐/새/개구리 30~40%→2, 메뚜기/사슴/여우 50~60%→3, 그 외 →1), evade_per_turn CSV 동일 변환. card accuracy 20%→3.
- 판정: `preyEvaded = baseEvade > cardAccuracy` (결정론, Math.random 제거). 도주 누적 fleeCount×10 → -1/회.
- UI: EvadeBadge `회피 N` (% 제거). 적 슬롯 peek `회피 0`. 턴 로그 회피당함 `(회피 N)`. computedEvades final = acc>=base ? 0 : base.
- 변경: `combatDeck.js` (parseEvadesByTurn fallback 1, resolveHunt 결정론), `data/prey.json` `data/combat_cards.json` `data/data.js`, `index.html` (EvadeBadge/peek/턴 로그/computedEvades).
- Node 스모크 5 케이스 전부 PASS.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-95**).
D-95 L2 meat -1 일괄 + 적 행동 슬롯 수치 배지:
- prey.json L2 7종 meat -1 (boar/dinosaur/fox/turkey/armadillo 2→1, deer/badger 3→2). data.js 재생성.
- HuntCombatModal 적 슬롯: T번호 + 행동 라벨 + 수치 3행. attack→🗡️N, defend→🛡️N, evade→EvadeBadge, peek→`회피 0%`. 유저 StatBadges와 색상·아이콘 통일(#ff9999/#4db8ff/#d4b84a).
변경: `data/prey.json`, `data/data.js`, `index.html` HuntCombatModal 적 슬롯 한 블록.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-94**).
D-94 거대한 먹이 + 보스 유인 시스템:
- 아이템 +2: giant_bait(2x2, hunger+8/health-8, is_bait) + grilled_giant_bait(2x2, hunger+16/health+8). combos +2 (big_meat×4→giant_bait, giant_bait→grilled).
- ItemInfoModal에 is_bait 조건부 [먹이로 유인하기] 버튼 → handleLureBait 인벤 차감 + baitTiles 등록 + 토스트 "이곳에 먹이를 놔두었다…".
- 보스 유인은 synthetic prey 패턴 — baitTiles를 가짜 L2 prey({preyType:'__bait__', isBait:true})로 변환해 boss.onPlayerMove에 전달. boss.js 무변경. 콜백 isBait 분기.
- bait 시각 🍖 (HexTile 스택 통합). 사체 도착·listen 포식 모달 모두 bait 분기 (이름=거대한 먹이).
변경 파일: `index.html`, `inventory.js`, `scripts/fetch_data.py`, `data/items.json`/`combos.json`/`data.js`. boss.js 무변경.
Node 스모크: 보스 0, bait at 2 → T1 0→1, T2 도달 stay=3 isBait=true, T5 complete preyType='__bait__' ✓.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-93**).
D-93 보스 포식 동시 도착 시 즉사 회피 + hunt_start 동기화 (`index.html`):
- 시나리오: L2 prey가 도망친 타일 → 유저 추격 → 같은 턴에 보스도 BFS 1홉으로 같은 타일 도달해 predation 시작 → 즉시 게임 오버 ← 부자연스러움 (D-90 모달 톤과 모순).
- 수정 A: `inPredationSafe = encounter && boss.predationStay > 0`. 게임 오버 대신 토스트 "들키기 전에 빠져나가자!". 식사 끝나는 다음 턴부터는 일반 위협 복귀 → 1~2턴 내 빠져나가야 한다는 제한 시간이 자연 발생.
- 수정 B: hunt_start push + setHand를 보스 이동 후로 이관. inPredationSafe면 push 생략(prey 즉시 사라진 상태 반영). setDeck/setGraveyard는 기존 위치 유지.
- 디렉터 의견: 턴 순서 통일(보스→유저)은 회귀·톤 변화로 추천 안 함. 좁은 분기로 해결.
Node 스모크: 4타일 선형 맵에서 boss 인접→prey타일 동시 도착 시나리오 → encounter=true/inPredationSafe=true 정상.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-92**).
D-92 1단계 재료 11종(stone/branch/stem/mushroom/berry/meat/big_meat/water/fish/crab_whole/grasshopper_whole) 텍스트 → 이모지 통일. 모듈 레벨 `ITEM_EMOJI` + `itemEmoji()` 헬퍼. 적용 5곳: 가방 그리드 셀(emoji 단독), CraftPanel 재료/결과, CookingModal 재료/결과, CardItemConsumeModal 음식 후보(emoji+이름), ItemInfoModal 헤더(emoji+이름, 요한 추가 지시). 2단계+은 매핑 부재 → 텍스트 폴백 유지.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-91**).
D-91 사냥 전투 UI 가독성 + 음식 정렬 (`index.html`):
- A. HuntCombatModal 상단 HP 라인에 🗡️/🛡️ 인라인 배지(prey.attack/defense > 0일 때).
- B. 턴 로그 2층 카드 재설계 — 좌측 색 보더 + 👤/{prey} 두 줄. 색상 SSOT(초록/노랑/파랑/빨강/회색/분홍)로 명중/회피/방어/피해/무산 즉시 구분. maxHeight 110→180.
- C. CardItemConsumeModal candidates를 효과 score(scaledDelta+bonus 합) 내림차순 sort. 동점은 이름. 휴식 recoverScale=2에서 grilled_big_meat_skewer(12) → grilled_meat_skewer(6) → mushroom/berry(2) → meat/big_meat(0).
Node 스모크: sort 점수 계산 6 케이스 정상.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-90**).
D-90 보스 포식 시스템 표면화 5건 묶음:
- A. 제자리 [시간 보내기]: moveTo(currentTile) 허용, `WaitConfirmModal`. 부수 효과 전부 흐름.
- B. 보스 포식 stay 2→3턴 (`boss.js`).
- C. 사체 도착 경고: `carcassTiles` Set→Map<tileId,{preyType}>. 첫 도착 시 토스트.
- D. 포식중 인접 listen 모달: bossDist=1 + predationStay>0 → 점프스케어 + `PredationListenModal`.
- E. 큰생고기 + L2 meat 절반: items 3종 신규(big_meat/skewer/grilled), combos 2건, L2 7종 drop_item=big_meat + meat//2. inventory.js 폴백 + fetch_data.py 매핑 +3. data.js 재생성. 시트 SSOT 동기화는 다음 로컬 세션 작업.
변경 파일: `boss.js`, `index.html`, `inventory.js`, `scripts/fetch_data.py`, `data/items.json`, `data/combos.json`, `data/prey.json`, `data/data.js`. Node 스모크: 보스 4타일 시퀀스 — predationStay 3턴 정상 + onPredationComplete preyType='boar' 전달 ✓.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-89**).
D-89 타일 아이콘 통합 중앙 스택. 이전 분산(흔적 우상단/prey 중앙/♟ 큰 폰트) 폐기 → `computeTileIcons` 순수 함수 + `TILE_STACK_LAYOUTS`(1/2/3/4 슬롯)로 통일. HexTile은 비-player/boss 아이콘만 그리고, GameMap이 player/boss 단일 SVG text를 같은 함수의 슬롯 인덱스로 배치 → transition 슬라이드 보존. 흔적은 같은 타일에 prey/carcass visible이면 자동 생략(요한: "정체 밝혀지면 사냥감 아이콘으로 대체"). 폰트 22 통일, paintOrder=stroke. Node 스모크 12케이스 PASS.

마지막 검증: 2026-04-25 (**13th session — 웹 세션, D-88**).
D-88 핀치줌 중심점 드리프트 수정 + 같은 타일 사냥감 식별 배지 (`index.html` 2 블록).
- A. 핀치줌: D-82가 매 프레임 `el.scrollLeft` 직접 읽다가, rAF가 도착하기 전 다음 touchmove(120Hz)가 들어오면 "새 zoom + 옛 scroll" 혼합 계산이 누적되어 손가락 중점에서 점점 어긋남. useEffect 클로저에 `scrollRef={x,y}` 객체 도입, 줌/팬 모두 이 ref만 사용+동기 갱신. `beginPan/continuePan`에도 `syncScrollFromDOM()` 연결.
- B. 사냥감 식별: `getTileLabel`이 `isCurrent`면 ''를 돌려 ♟ 만 보이던 문제. HexTile에 좌상단(x-20,y-18) prey emoji 배지 추가. trace 마커(우상단)와 좌우 대칭, ♟(중앙)과 미겹침. `!dimmed && isCurrent && showPrey` 조건.

마지막 검증: 2026-04-24 (**13th session — 웹 세션, D-80~D-87**).
D-87 맵 크기 11x11 → 8x8 (64타일, 변 ×0.73, 면적 -47%). `index.html:38` `MAP_SIZE` 한 줄 변경. mapGenerator는 D-61 gridSize 비율 기반 자동 스케일 — 빈 슬롯 12~19, good=5/trap=3, minBossDist=5. Node 스모크 20회 재생성 + spawnPrey 10/10 통과. D-86 보스 동기화 이동과 결합해 추격 압박 정상화.

마지막 검증: 2026-04-24 (**13th session — 웹 세션, D-80~D-86**).
D-86 보스 이동 템포 단순화 (2단계):
1) `boss.js::onPlayerMove` 일반 모드 2턴 스킵·추격 모드 1·2 교대 제거 → 매 호출 1칸(`chaseMode ? moveTowards() : moveRandom()`). 인스턴스 필드 `playerMoveCount`, `bossMovePhase` 제거.
2) **보강**: `index.html::moveTo`의 caller 게이트 `if (boss.chaseMode || newMoveCount % 2 === 0)` 제거 — 일반 모드에서 호출 빈도 자체가 절반이던 게 진짜 원인이었음. 이제 모든 모드에서 1턴=1칸 동작.
포식(D-77) 경로는 무변경(이미 1홉 구조). React state `playerMoveCount`는 set만 되는 dead state로 잔존(이번 범위 외).
D-85 canMove 테두리 dim 우선순위 역전: `HexTile`에서 `tileStroke = showCanMove ? '#4CAF50' : (dimmed ? '#555' : '#0f3460')` 순서로 변경. `showCanMove = canMove && !pathUnvisited`로 [맵 보기]에서 클릭 안 되는 타일 녹색 승격 생략. silhouette/discovered 잔존 플래그로 dim 처리되던 인접 타일이 더 이상 "못 가는 타일"처럼 회색으로 보이지 않음.

마지막 검증: 2026-04-24 (**13th session — 웹 세션, D-80/D-81/D-82**).
D-82 맵 조작 개선: `.map-container` `touch-action: none` + `GameMap`에 `zoom` state(0.5~2.5) + 드래그 pan / 마우스휠·핀치 zoom. SVG `viewBox` 고정 + `width/height *= zoom`으로 내부 좌표계 안전. 드래그 임계값 4px 초과 시 click 이벤트 capture 단계에서 차단해 hex tap과 공존. 줌 중심 보정(커서/핀치 중점 고정)은 `requestAnimationFrame`으로 SVG 리렌더 후 scroll 재설정.
D-81 consume 모달 유령 아이템: `InventoryModal` 닫기에 `cancelSelection` + `CardItemConsumeModal::candidates` 및 `openConsumeForCard::hasAny` 계산에서 `selectedItem.id` 제외(이중 방어).
D-80 listen 실루엣: `useCard('listen')`에서 revealed/visited 타일 connections 중 미공개를 `silhouette: true`로. `HexTile`은 `pathUnvisited`와 `silhouetteOnly`를 `dimmed`로 통합.
변경 파일: `index.html`, `gameStyles.css`, `.claude/game-director/*.md`.

마지막 검증: 2026-04-24 (**13th session — 웹 세션, D-80 listen 실루엣 확장**).
귀 기울이기 카드가 이제 현재 타일 이웃(revealed) + **그 이웃의 이웃 중 미공개 타일**을 맵 보기(D-53)와 동일한 dim 색상(#444 / opacity 0.22)으로 노출. 한번 본 실루엣은 `tile.silhouette` 플래그로 영구 유지. `HexTile`에서 `pathUnvisited`와 `silhouetteOnly`를 `dimmed`로 통합해 렌더 분기 재사용. 클릭 조건은 기존 `pathUnvisited`만 사용 — silhouette 타일이어도 canMove면 이동 가능.
변경 파일: `index.html`, `.claude/game-director/pending.md` · `project-state.md`.
웹 환경 제약(Notion MCP 미연결·notion.site 방화벽) 그대로.

마지막 검증: 2026-04-24 (**12th session — 로컬 Mac 세션 / D-72~D-78 사냥감 확장 2·3단계 통합**).
D-72 (방어구 시스템 5종 + 조합 5건, `scripts/fetch_data.py`/`inventory.js` + 시트 `방어구` 탭 신설 + `조합레시피` +5).
- 시트 `방어구` 탭 신설 (headers: id, name, type, grade, size, weight, defense, 조합법, 설명). 5 row: leaf_vest(1/armor/1), wooden_shield(2/shield/2), cloth_armor(2/armor/2), reinforced_shield(3/shield/3), scale_mail(3/armor/3).
- `fetch_data.py` ARMOR_MASTER_SHEET 상수 + rows_to_armors + API/xlsx 양쪽 export. BROWSER_BUNDLE_KEYS에 ARMORS 편입. ITEM_NAME_TO_ID +5 매핑.
- `inventory.js` ITEMS 폴백 5종 + resolveDef에 armorsBundle 머지 (defense/type/category). 기존 weapons 머지 패턴 재사용.
- 산출: armors.json 5종, combos.json 16→21 (+5 3재료 레시피).

D-73 (웅크리기·방패막기 카드 + requirement shield/armor 카테고리 DSL, `combatDeck.js`/시트 `전투카드`).
- 시트 `전투카드` 신규 `defense` 컬럼 + 2장 append: crouch(무한, def 1), shield_block(req='shield', def 1).
- `combatDeck.js` CATEGORY_REQ_TOKENS = {'shield','armor'}. `buildHuntDeck`:
  - resolveDef 기반 category 매칭. 토큰이 카테고리면 인벤 내 category 카운트로 slotLimit. 이름 매칭과 공존.
  - 카드별 defense 주입. id='shield_block'이면 카드 defense + 인벤 전체 방어구 defense 합산(shield+armor).
  - 카테고리 토큰은 accuracy 합산에서 자동 제외.
- `index.html::handleHuntResolve` 재료 소비 루프에 카테고리 토큰 skip.

D-74 (플레이어 방어 계산 + HP 차감 + 🛡️ 배지, `combatDeck.js`/`index.html`).
- `resolveHunt` 반환 객체에 `playerDamageTaken` — prey attack과 유저 카드 defense 대결 누적.
- `index.html::handleHuntResolve` setHealth로 차감, HP 0이면 setGameOver + deathReason 'health'.
- `HuntCombatModal::StatBadges` — STAT_ICONS.defense='🛡️', color '#4db8ff'. 순서 🗡️→%→🏹→🛡️. dmg=0 && def>0이면 🗡️ 숨김.

D-75 (2등급 사냥감 4턴 패턴 시트 DSL + 행동 해석, `combatDeck.js`/`index.html`/시트 `사냥감`).
- 시트 `사냥감` +actions_per_turn +defense 컬럼. L2 prey 7종 attack=2 일괄, habitat 기본값, actions CSV 고정 시퀀스.
- `combatDeck.js::parsePreyActions` DSL. `resolveHunt` Level 2 분기 — 4턴 루프, attack/defend/evade/peek 각각 고유 효과.
  - defend 턴: 유저 대미지 감쇄(prey.defense). peek 턴: evade=0 명중 보장. evade 턴만 회피율 굴림.
- `HuntCombatModal` SLOT_COUNT 상수 (L1=3/L2=4) — slots/grid/preyActions 모두 이 기준 동적. 적 슬롯 턴별 행동 라벨 + 회피 턴만 회피율.

D-76 (PREY_SPAWN 상수 + level2 5마리 + 3~5칸 거리, `mapGenerator.js`/`index.html`).
- `index.html` `PREY_SPAWN = {level1:5, level2:5}` 상수. PREY_EMOJI +L2 7종.
- `mapGenerator.js::spawnPrey` 시그니처 확장(counts 객체 또는 number 호환). L1/L2 별도 풀, L2 상호 BFS 거리 ≥ 3 강제(공간 부족 시 완화). habitat CSV string 자동 배열화.

D-77 (보스 포식 이동 우선권 + 2턴 정지 + 사체 생성, `boss.js`/`index.html`).
- `BossMonster` state 추가: predationTarget, predationStay, onPredationStart/Complete 훅.
- `onPlayerMove(playerTile, detection, preys)` 시그니처. predationStay>0면 정지+감소. 타겟 있으면 BFS 첫 홉 전진. 타겟 도달 시 stay=2 시작. 타겟 없으면 L2 거리 ≤ 2 탐색.
- `index.html::initializeGame`에서 콜백 연결 — Start에서 setPreys 제거, Complete에서 setCarcassTiles 추가. moveTo의 보스 이동 로직을 onPlayerMove 단일 경로로 통합.

D-78 (동물 사체 타일 🦴 + 귀기울이기 단서 + 뒤져보기 생고기 1회 보너스, `index.html`).
- carcassTiles / carcassMeatTaken / carcassTraceTiles 3 state. HexTile visited+carcass → 중앙 🦴. carcassTrace → 👣 대신 🦴.
- `useCard('listen')` 인접 carcassTiles → carcassTraceTiles 추가 + 메시지.
- `useCard('search')` 사체 타일 첫 시전 → 일반 region 드롭 + meat +1, carcassMeatTaken 등록. 이후 시전은 일반 드롭만.
- moveTo에서 방문 시 해당 타일의 carcassTrace 자동 정리.

12차 세션 변경 파일: `scripts/fetch_data.py`, `inventory.js`, `combatDeck.js`, `boss.js`, `mapGenerator.js`, `index.html`, `data/armors.json`(신규), `data/combat_cards.json`, `data/prey.json`, `data/combos.json`, `data/data.js`, `.claude/game-director/project-state.md`, `.claude/game-director/pending.md`.
전투카드 7→9 (+defense 컬럼). 아이템 25 유지 / 무기 2 유지 / 방어구 5 신설. 조합 16→21 (+5 방어구). prey 16 유지 (+actions_per_turn/+defense 컬럼, L2 7종 업데이트).

Node 스모크(전부 통과):
- resolveDef for armors 5종 — name/category/defense/type 정상 override.
- buildHuntDeck: shield×2(def2) + armor×1(def1) 인벤 → shield_block.defense=6 (1+2+2+1). armor-only → shield_block 제외.
- resolveHunt L2 boar(attack,attack,defend,evade): crouch→punch→shield_block→punch 시퀀스 → playerDamageTaken 3, preyHp 3.
- spawnPrey 7x7: L1 5 + L2 5 스폰, 모든 L2 쌍 거리 ≥ 3.
- BossMonster 포식: 선형 4타일 맵 0→1→2 전진, stay 2→1→0, onPredationStart/Complete 콜백 정상.

2·3단계 브라우저 E2E는 요한 QA 대기 (`pending.md` 12차 세션 블록 참조).

마지막 검증: 2026-04-24 (**12th session — 로컬 Mac 세션 / D-71 사냥감 확장 1단계**).
D-71 (게·메뚜기 보상 다양화 + 조합·요리 체인, `scripts/fetch_data.py`/`inventory.js`/`index.html` + 시트 3탭).
- 시트 `아이템마스터` +5 row: crab_whole(재료), crab_meat(음식 1hp), crab_skewer(음식 1hp), grilled_crab_skewer(음식 2hp+1hl), grasshopper_whole(음식 1hp).
- 시트 `조합레시피` 신규 `result_count` 컬럼 + 3 row: stone+crab_whole→crab_meat x2 / crab_meat+branch→crab_skewer / crab_skewer→grilled_crab_skewer.
- 시트 `사냥감` 신규 `drop_item` 컬럼: crab→crab_whole, grasshopper→grasshopper_whole (나머지 14종 공란=meat 폴백).
- `fetch_data.py::ITEM_NAME_TO_ID` +5 매핑, `build_combos_from_sheet`가 `result_count`를 combo.count(>1일 때만)로 방출.
- `inventory.js::craftRecipe` count 반복 배치 + `{produced, overflow}` 반환. 재료 소비는 1회 고정. 기존 호출부(`handleCraft`) 메시지 확장.
- `index.html::useCard('hunt_start')` activeHunt.prey에 drop_item 전달. `::handleHuntResolve` victory 분기 drop_item 우선(`meat` 폴백). LootToast/메시지 이름·등급 동적.
- 데이터 재생성: items 20→25(+5), combos 13→16(+3), prey.json drop_item 필드 등장.
- Node 스모크: `stone+crab_whole → crab_meat x2` 성공 / `crab_skewer → grilled_crab_skewer` 성공 확인.
- 2·3단계(2등급 전투/방어, 보스 포식)는 pending.md 등재 — 이번 범위 외.

마지막 검증: 2026-04-24 (**12th session — 로컬 Mac 세션**, G/H/I 기획 3건 + D-58 리팩터).
D-55 (스탯 경고 점멸, `gameStyles.css`/`index.html`), D-56 (보스 결과화면 — 점프스케어 + "삼켰습니다" + defeat 맵보기, `index.html`), D-57 (휴식=요리 시스템, 바베큐 폐지 — 아이템 4종 + 조합 4건, `inventory.js`/`scripts/fetch_data.py`/시트 2탭/`data/*.json` 재생성), **D-58** (HuntCombatModal 수치 배지 통일 + 적 슬롯 실시간 회피율, `index.html`/`gameStyles.css`, 3커밋).
12차 세션 변경 파일: `gameStyles.css`, `index.html`, `inventory.js`, `scripts/fetch_data.py`, `data/items.json`, `data/combos.json`, `data/data.js`, `.claude/game-director/design-decisions.md`, `.claude/game-director/project-state.md`, `.claude/game-director/pending.md`.
아이템 갯수: 16 → 20 (+4 — 꼬치 2 + 구이 2). 조합 레시피: 9 → 13 (+4). 시트 `아이템마스터`·`조합레시피` 각 4행 append.
`fetch_data.py::build_combos_from_sheet` 1재료 레시피 허용 (기존 `a and b and r` 필터 → `a and r`). `findRecipesContainingAny`의 `uniq.size<=1` 필터가 합성 패널에서 1재료 자동 제외하므로 회귀 없음.
**D-58 요점**: `HuntCombatModal` 지역 컴포넌트 `StatBadges`·`EvadeBadge` 도입. 배지 형식 3종(`🗡️+N` / `N%` / `🏹+N`) 통일. `computedEvades = useMemo` 로 슬롯별 최종 회피율 계산 — 공식은 `combatDeck.js::resolveHunt` L232 SSOT 참조 주석. damage>0 & finalEvade<baseEvade 시 초록+bold. `card.accuracy`는 `buildHuntDeck`(D-50) 합산값 그대로 읽기만 — 이중 합산 없음. `.evade-changed` 0.2s 트랜지션. 숫자 다이얼 연출은 차기 이터레이션으로 제외.
브라우저 E2E는 요한 QA 대기 (`pending.md` 12차 세션 블록 참조).

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

## 2026-04-24 11차 세션 변경점 — 결과 화면 회고 강화 + 스크롤 패딩 (D-53/54)

요한 노션 기획 E/F를 B/C/D 위에 추가 구현. 계획봇 계획서 + 요한 확정 스펙 기반.

1. **E. 결과 화면 보스 경로 + 전체 맵 윤곽 (D-53)**:
   - `Game`에 `bossMoveHistory` state 추가. `initializeGame`에서 `[bossPos]` 초기화.
   - `moveTo`: 보스 이동 후 위치가 변경되고 history 끝과도 다르면 push. 중복 자동 제거.
   - `GameMap`: `showPathView` 모드에서 `tiles.filter(!isEmpty)` 로 전체 공개.
   - `HexTile`: `pathUnvisited` 플래그로 미방문 타일은 회색 반투명 + 라벨/마커 숨김. 방문 타일에는 플레이어 노란 원(좌) + 보스 빨간 원 `B{n}`(우) 나란히.
   - `gameStyles.css`: `.hex-tile.path-unvisited`, `.boss-path-dot` 추가.

2. **F. 원형 스크롤 패딩 (D-54)**:
   - `mapGenerator.js`: `PADDING_HEXES = 7`, HEX_* 상수 추출. `generateHexPositions`에 xOffset/yOffset 반영 → 플레이 그리드가 캔버스 중앙. `getMapExtent(): {totalWidth, totalHeight}` 신설.
   - `index.html::GameMap`: svg width/height 하드코딩(1100x1000) → `getMapExtent()`. useLayoutEffect 중앙 정렬은 tile.position(새 좌표) 기반이라 무변경 동작.
   - 시각적 원형 테두리는 렌더 안 함(요한: 완전 투명).

**브라우저 검증**: 미실행. 요한 수동 QA (pending.md E/F 체크리스트 참조).

## 2026-04-24 12차 세션 변경점 — D-60/D-61/D-62 (턴별 회피·맵 확대·보스 배회)

요한 노션 기획 3건 일괄 구현. 계획서 확정 스펙 기반.

1. **D-60 턴별 회피율 + 도주 누적 패널티**:
   - 시트 `사냥감` 탭에 `evade_per_turn` CSV 컬럼 추가 (Level 1 9종 T3 -10~20% 하향).
   - `combatDeck.js::parseEvadesByTurn` 신설 + `resolveHunt` 턴별 계산(`evadesByTurn[t] - fleeCount*10`).
   - `HuntCombatModal::computedEvades` 턴별 base 반영.
   - `setPreys` prey_fled 분기에서 `fleeCount` 누적.
   - `useCard('hunt_start')`가 activeHunt에 `evade_per_turn`/`fleeCount` 전달.

2. **D-61 맵 크기 1.5배 (7x7 → 11x11)**:
   - `index.html` 전역 `MAP_SIZE = 11` 상수 도입, 3곳 `MapGenerator(7)` → `MapGenerator(MAP_SIZE)` 치환.
   - `mapGenerator.js::_generateOnce` 내부 하드코딩을 gridSize 기반 스케일로 리팩토링:
     - `getCornerCandidates()` 동적 산출.
     - `emptySlotCount = totalTiles * (0.20~0.31)`.
     - `minBossDistance = max(5, floor(gridSize*0.7))`.
     - `specialTiles = good/trap * (totalTiles/49)` 비율.

3. **D-62 보스 미방문 타일 선호**:
   - `boss.js::BossMonster.visitedTiles` Set 필드 + `setPosition` 헬퍼.
   - `moveRandom` 미방문 필터 → 있으면 그중 랜덤, 없으면 기존 로직.
   - `moveTowards`·`moveRandom` 둘 다 이동 후 방문 기록.
   - `initializeGame` `boss.position=X` 직접 할당 → `boss.setPosition(X)` 로 visitedTiles 동기화.
   - `moveTo` 일반 모드 인라인 랜덤 이동 → `boss.moveRandom()` 위임.

**브라우저 검증**: 미실행. Node 단위 스모크 테스트만 수행 (resolveHunt 수식, 맵 생성 스케일, 보스 미방문 우선). 요한 수동 QA — pending.md D-60/D-61/D-62 체크리스트 참조.
