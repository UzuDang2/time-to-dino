// inventory.js - 테트리스식 인벤토리 시스템
//
// D-24 머지·조합 통합 시스템:
//   - 같은 재료 N개(기본 2개)를 겹치면 머지 → `merge_result` 타입의 상위 아이템 1개.
//   - 다른 재료 2개를 겹치면 조합 조회 → `window.TTD_DATA.COMBOS`에서 매칭되는 result.
//   - 둘 다 실패면 swap (기존 동작).
// 시그니처는 기존과 동일(canMerge/mergeItems/confirmPlacement). 호출부 회귀 없음.

class InventorySystem {
    // D-47: 기본 가방 모양 5x5, 위 2행의 좌우 구석 4칸은 disabled (배치 불가).
    //   시각적으로는 "위 2x3 + 아래 5x3 연결"처럼 보임.
    //   options.disabled = [{x,y}, ...] 로 커스텀 레이아웃 주입 가능.
    static DEFAULT_DISABLED = [
        { x: 0, y: 0 }, { x: 4, y: 0 },
        { x: 0, y: 1 }, { x: 4, y: 1 }
    ];

    constructor(rows = 5, cols = 5, options = {}) {
        this.rows = rows;
        this.cols = cols;
        this.grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
        this.disabled = new Set();
        const defs = Array.isArray(options.disabled) ? options.disabled : InventorySystem.DEFAULT_DISABLED;
        for (const { x, y } of defs) {
            if (typeof x === 'number' && typeof y === 'number') {
                this.disabled.add(`${x},${y}`);
            }
        }
        this.selectedItem = null;
        this.items = [];
    }

    isDisabled(x, y) {
        return this.disabled.has(`${x},${y}`);
    }

    // 머지 수량 N — 전역 상수(D-24). 같은 재료를 N개 겹쳐야 머지 성립.
    // 현재는 "2개 겹치기"만 UI에서 지원 → N=2 외 값은 추후 확장.
    static MERGE_COUNT = 2;

    // 아이템 정의
    // 1단계/2단계는 Notion DB의 id와 1:1 매칭(scripts/fetch_data.py::ITEM_NAME_TO_ID 참고).
    // `merge_result`는 Notion의 `결과물` relation을 런타임에서 덮어쓸 수 있음(TTD_DATA.ITEMS).
    // 여기 하드코딩된 값은 런타임 폴백 + 오프라인 테스트용.
    static ITEMS = {
        // === 1단계 환경재료 ===
        stone:    { name: '돌맹이',   shape: [[1]], grade: 1, mergeable: false, category: 'env',  merge_result: null },
        branch:   { name: '나뭇가지', shape: [[1]], grade: 1, mergeable: true,  category: 'env',  merge_result: 'wood' },
        stem:     { name: '줄기',     shape: [[1]], grade: 1, mergeable: true,  category: 'env',  merge_result: 'plant_fiber' },

        // === 1단계 음식재료 (D-30: 2단계 음식 추가 — 머지 가능) ===
        mushroom: { name: '버섯',     shape: [[1]], grade: 1, mergeable: true,  category: 'food', merge_result: 'mushroom_mix' },
        berry:    { name: '산딸기',   shape: [[1]], grade: 1, mergeable: true,  category: 'food', merge_result: 'berry_mix' },

        // === 시냇물 음식재료 (D-33: 신규 — 머지 없음, 단독 소비) ===
        //   water: hunger+1 기본 음식. 80% 비중으로 시냇물에서 자주.
        //   fish : hunger+2 귀한 음식. 20% 비중. 머지는 없지만 mix와 동급 효과.
        // D-44 (2026-04-23): '맑은 물' → '맑은물' 표기 통일 (시트 SSOT와 일치).
        water:    { name: '맑은물',   shape: [[1]], grade: 1, mergeable: false, category: 'food', merge_result: null },
        fish:     { name: '물고기',   shape: [[1]], grade: 1, mergeable: false, category: 'food', merge_result: null },

        // === 2단계 (조합 결과물) ===
        wood:         { name: '목재',         shape: [[1]], grade: 2, mergeable: false, category: 'material', merge_result: null },
        plant_fiber:  { name: '끈',           shape: [[1]], grade: 2, mergeable: false, category: 'material', merge_result: null },
        clean_cloth:  { name: '깨끗한 천',    shape: [[1]], grade: 2, mergeable: false, category: 'material', merge_result: null },
        bandage:      { name: '붕대',         shape: [[1]], grade: 2, mergeable: false, category: 'consumable', merge_result: null },

        // === 2단계 음식 (D-30 신규) ===
        berry_mix:    { name: '딸기모둠',     shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        mushroom_mix: { name: '버섯모둠',     shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },

        // === 3단계 음식 (D-44 신규) ===
        //   clean_berry: water + berry_mix 조합 결과. hunger+3. 최종형(머지 불가).
        clean_berry:  { name: '깨끗한 딸기',  shape: [[1]], grade: 3, mergeable: false, category: 'food', merge_result: null },

        // === 사냥감 전투 1단계 생고기 (D-46 신규) ===
        //   승리 시 prey.meat 수만큼 지급. Notion 아이템 DB 승격 전까지 런타임 폴백.
        //   REST_FALLBACK 패턴(D-23) 준용 — items.raw.json 동기화 + make data 후 자연 스왑.
        meat:         { name: '생고기',       shape: [[1]], grade: 1, mergeable: false, category: 'food',  merge_result: null },

        // === D-57 요리 시스템: 꼬치(2재료 조합) + 구이(1재료 요리) ===
        //   꼬치(2단계): meat/fish + branch. 효과 hunger+1, health-1 — 생고기 부담 유지.
        //   구이(3단계): 꼬치 1재료 "요리". 효과 hunger+2, health+1 — 불에 익혀 안전·든든.
        //   모두 일회용, 머지·합성 경로 없음. 구이는 휴식 카드 요리 모달 경유로만 생성.
        meat_skewer:          { name: '생고기꼬치',   shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        fish_skewer:          { name: '물고기꼬치',   shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        grilled_meat_skewer:  { name: '고기꼬치구이', shape: [[1]], grade: 3, mergeable: false, category: 'food', merge_result: null },
        grilled_fish_skewer:  { name: '생선꼬치구이', shape: [[1]], grade: 3, mergeable: false, category: 'food', merge_result: null },

        // D-90 (2026-04-25): L2 사냥감 큰생고기 드롭 체인. 효과 = 생고기 ×2(영양·페널티 모두).
        big_meat:                  { name: '큰생고기',         shape: [[1]], grade: 1, mergeable: false, category: 'food', merge_result: null },
        big_meat_skewer:           { name: '큰고기꼬치',       shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        grilled_big_meat_skewer:   { name: '큰고기꼬치구이',   shape: [[1]], grade: 3, mergeable: false, category: 'food', merge_result: null },
        // D-94 (2026-04-25): 거대한 먹이 — 보스 유인용 2x2 음식. is_bait 플래그 = ItemInfoModal에서 [먹이로 유인하기] 버튼 노출 트리거.
        giant_bait:                { name: '거대한 먹이',      shape: [[1,1],[1,1]], grade: 2, mergeable: false, category: 'food', merge_result: null, is_bait: true },
        grilled_giant_bait:        { name: '거대한 먹이 구이', shape: [[1,1],[1,1]], grade: 3, mergeable: false, category: 'food', merge_result: null, is_bait: true },

        // === D-71 사냥감 확장 1단계 — 게·메뚜기 보상 체인 ===
        //   crab_whole(재료): 단독 섭취 불가. 돌+게 조합으로 게살 2개.
        //   crab_meat(음식 2단계): hunger+1. 꼬치 재료로도 사용.
        //   crab_skewer(음식 2단계): hunger+1. 요리 모달에서 구울 수 있음.
        //   grilled_crab_skewer(음식 3단계): hunger+2, health+1.
        //   grasshopper_whole(음식 1단계): 메뚜기 단독 섭취 hunger+1.
        crab_whole:           { name: '게',             shape: [[1]], grade: 1, mergeable: false, category: '재료', merge_result: null },
        crab_meat:            { name: '발라낸 게살',    shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        crab_skewer:          { name: '게살꼬치',       shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        grilled_crab_skewer:  { name: '구운게살꼬치',   shape: [[1]], grade: 3, mergeable: false, category: 'food', merge_result: null },
        grasshopper_whole:    { name: '메뚜기',         shape: [[1]], grade: 1, mergeable: false, category: 'food', merge_result: null },

        // === 레거시 (기존 카드 시스템 참조) — 후속 작업에서 1단계 체계로 흡수 예정 ===
        material_low:  { name: '낡은 재료', shape: [[1]], grade: 1, mergeable: false, merge_result: null },
        material_mid:  { name: '일반 재료', shape: [[1]], grade: 2, mergeable: false, merge_result: null },
        material_high: { name: '고급 재료', shape: [[1]], grade: 3, mergeable: false, merge_result: null },

        weapon_basic: { name: '나무창', shape: [[1, 1]], grade: 1, mergeable: false, category: '무기' },
        weapon_stone: { name: '돌창',   shape: [[1, 1]], grade: 2, mergeable: false, category: '무기' },

        // D-52 신규: 새총 — 1x1 소형 무기. branch + plant_fiber 조합.
        //   런타임 정의는 TTD_DATA.WEAPONS가 덮어쓴다(내구도/정확도 등).
        //   shape은 여기 하드코딩 — weapons.json에 shape 필드가 없어서 resolveDef가
        //   name/내구도만 덮고 shape는 static 유지.
        slingshot:    { name: '새총',   shape: [[1]],    grade: 1, mergeable: false, category: '무기' },

        // D-99 신규: 뗀석기 — 1x1 원시 무기. stone×3 합성. 뗀석기 카드 2종 사용 조건.
        chipped_stone: { name: '뗀석기', shape: [[1, 1]], grade: 1, mergeable: false, category: '무기' },

        // === D-72 방어구 5종 (2026-04-24) ===
        //   shape 1x1 고정, mergeable=false. category는 type과 동일('shield' | 'armor').
        //   런타임 TTD_DATA.ARMORS가 defense/name/size/grade 등을 덮어씀.
        //   requirement DSL 확장: 카드 requirement='shield' / 'armor' 이면 카테고리 매칭.
        leaf_vest:         { name: '잎사귀 조끼',  shape: [[1]], grade: 1, mergeable: false, category: 'armor',  merge_result: null, defense: 1 },
        wooden_shield:     { name: '나무 방패',    shape: [[1]], grade: 2, mergeable: false, category: 'shield', merge_result: null, defense: 2 },
        cloth_armor:       { name: '천 갑옷',      shape: [[1]], grade: 2, mergeable: false, category: 'armor',  merge_result: null, defense: 2 },
        reinforced_shield: { name: '강화 방패',    shape: [[1]], grade: 3, mergeable: false, category: 'shield', merge_result: null, defense: 3 },
        scale_mail:        { name: '비늘 갑옷',    shape: [[1]], grade: 3, mergeable: false, category: 'armor',  merge_result: null, defense: 3 },

        tool_pickaxe: { name: '곡괭이', shape: [[1, 0], [1, 1]], grade: 2, mergeable: false },

        armor: { name: '가죽 갑옷', shape: [[1, 1], [1, 1]], grade: 2, mergeable: false },

        // === D-126 (2026-04-28) 이벤트 신규 아이템 3종 (☆1/☆3 폴백) ===
        //   wood_shard:  소지 시 함정 1회 자동 차단 (단계 2/3에서 트리거 구현). 폴백 단계는 보유만.
        //   torn_map:    사용 시 탈출구 방향 1회 표시. ItemInfoModal [사용]에서 hint:exit_direction 발동 예정.
        //   snare_trap:  현재 타일에 설치, 보스가 밟으면 1턴 정지. 단계 3.
        wood_shard: { name: '나무 조각',         shape: [[1]], grade: 1, mergeable: false, category: '소모품', merge_result: null },
        torn_map:   { name: '찢어진 지도 조각',   shape: [[1]], grade: 1, mergeable: false, category: '소모품', merge_result: null },
        snare_trap: { name: '덫',               shape: [[1]], grade: 1, mergeable: false, category: '소모품', merge_result: null }
    };

    // 런타임에 TTD_DATA.ITEMS(Notion 기반)이 덮어쓰는 값 조회.
    // 우선 순위: TTD_DATA.ITEMS(id 매칭) → TTD_DATA.WEAPONS(id 매칭) → static ITEMS(type 매칭).
    // D-24: 이 함수가 있어야 시트·Notion 편집이 코드 재배포 없이 반영됨.
    // D-47: 무기 탭 분리 — 무기는 ITEMS에 없으므로 WEAPONS에서 찾아 name/내구도/공격력 등 덮어씀.
    //       shape은 static ITEMS의 값 유지 (weapon_basic은 [[1,1]] 등).
    static resolveDef(type) {
        const staticDef = InventorySystem.ITEMS[type] || {};
        const td = (typeof window !== 'undefined' && window.TTD_DATA) ? window.TTD_DATA : null;
        const itemsBundle = td && Array.isArray(td.ITEMS) ? td.ITEMS : null;
        const weaponsBundle = td && Array.isArray(td.WEAPONS) ? td.WEAPONS : null;
        const armorsBundle = td && Array.isArray(td.ARMORS) ? td.ARMORS : null;

        // D-64: itemsBundle과 weaponsBundle을 머지해 덮어씀(early return 제거).
        //   이전엔 itemsBundle에 무기 아이템(slingshot 등)이 먼저 매칭되면
        //   early return되어 weapons.json의 durability/accuracy를 못 읽어왔다.
        //   결과: durabilityLeft 미초기화 → weaponState total=0 → resolveHunt auto-fail.
        //   수정: items 분기로 mergeable/merge_result만 반영하고, weapons 분기가
        //         이어서 무기 메타(내구도·공격력·accuracy)를 덮어쓰게.
        let merged = { ...staticDef };

        if (itemsBundle) {
            const itemDef = itemsBundle.find(it => it && it.id === type);
            if (itemDef) {
                merged.mergeable = itemDef.merge_enabled === true;
                merged.merge_result = itemDef.merge_result || null;
                // D-106: 시트에서 weight/attack/accuracy 컬럼 제거됨. 내구도만 유지.
                if (itemDef['내구도'] != null) merged.durability = Number(itemDef['내구도']);
            }
        }
        if (weaponsBundle) {
            const wDef = weaponsBundle.find(w => w && w.id === type);
            if (wDef) {
                // 무기 메타 덮어씀. weapons 탭이 더 최신 SSOT라고 간주.
                // D-106: weight/attack/accuracy 제거 — 무기는 name/category/내구도만 의미 있음.
                if (wDef.name) merged.name = wDef.name;
                merged.category = wDef['카테고리'] || merged.category || '무기';
                if (wDef['내구도'] != null) merged.durability = Number(wDef['내구도']);
            }
        }
        // D-72: 방어구 번들 병합. type은 'shield' | 'armor' — category로도 그대로 사용.
        //   defense는 requirement='shield'/'armor' DSL과 전투 카드 방어 합산에 쓰임.
        if (armorsBundle) {
            const aDef = armorsBundle.find(a => a && a.id === type);
            if (aDef) {
                if (aDef.name) merged.name = aDef.name;
                // type이 있으면 category로 사용 (shield/armor). 없으면 static category 유지.
                if (aDef.type) merged.category = aDef.type;
                if (aDef.defense != null) merged.defense = Number(aDef.defense);
                // D-150: 방어구 내구도 — 방어 카드 사용마다 1씩 차감.
                if (aDef['내구도'] != null) merged.durability = Number(aDef['내구도']);
                else if (aDef.durability != null) merged.durability = Number(aDef.durability);
                merged.type = aDef.type || merged.type;
            }
        }
        return merged;
    }

    // D-174: 한글 자원 이름 → 영문 id 매핑.
    //   parseRewardItems / handleCompleteQuest 한글 cost 차감에서 사용.
    //   우선순위: static ITEMS 매칭(레거시 안정) → window.TTD_DATA.ITEMS 매칭(런타임 신규).
    //   - 동일 이름이 여러 id에 걸친 경우(예: '맑은물' = water/clear_water) static의 'water'가 우선.
    //   미매칭 시 null. 호출부는 console.warn + 스킵.
    static findIdByKoreanName(koName) {
        if (!koName || typeof koName !== 'string') return null;
        const target = koName.trim();
        if (!target) return null;
        // 1. static ITEMS — 레거시 안정 영역 우선.
        for (const [id, def] of Object.entries(InventorySystem.ITEMS)) {
            if (def && def.name === target) return id;
        }
        // 2. window.TTD_DATA.ITEMS — 시트 신규 자원(석재·금속·가죽 등).
        const td = (typeof window !== 'undefined' && window.TTD_DATA) ? window.TTD_DATA : null;
        const bundle = td && Array.isArray(td.ITEMS) ? td.ITEMS : null;
        if (bundle) {
            for (const it of bundle) {
                if (!it) continue;
                if (it['이름'] === target || it.name === target) {
                    return it.id || null;
                }
            }
        }
        return null;
    }

    // D-174 v2 (2026-04-30): 캠프 보관함 텐트 슬롯 풀기.
    //   캠프 보관함 12x16 — row 0-5(BASE 활성 72칸) + row 6-15(텐트 슬롯, 좌측 10칸 변동
    //   disabled · 우측 2칸 영구 disabled). 텐트 단계당 +10칸 — 풀 텐트(Lv.10) 시 +100.
    //   slotsToOpen은 풀 칸 수. 좌상단(y=6,x=0)부터 행→열 순으로 풀기. x=10,11은 영구 스킵.
    //   안전: 음수/0이면 no-op. disabled에 없으면 건너뜀(idempotent).
    expandStorage(slotsToOpen) {
        const n = Math.max(0, Number(slotsToOpen) || 0);
        if (n <= 0) return;
        const TENT_ROW_START = 6;     // BASE 활성 row 0-5 다음부터 텐트 슬롯
        const TENT_MAX_COLS = 10;     // 우측 2칸(x=10,11)은 영구 disabled
        let opened = 0;
        for (let y = TENT_ROW_START; y < this.rows && opened < n; y++) {
            for (let x = 0; x < Math.min(TENT_MAX_COLS, this.cols) && opened < n; x++) {
                const key = `${x},${y}`;
                if (this.disabled.has(key)) {
                    this.disabled.delete(key);
                    opened += 1;
                }
            }
        }
    }

    // 두 아이템의 2종 조합 레시피 조회 (TTD_DATA.COMBOS 전역 리스트).
    // ingredients 순서 무관 비교. **2종 레시피만** 매칭 — 3종은 합성 패널 경유.
    // (D-24 자동 조합 경로에서 쓰던 API. 현재는 fallback 용으로만 유지.)
    static lookupCombo(typeA, typeB) {
        const bundle = InventorySystem._combosBundle();
        const target = [typeA, typeB].sort();
        for (const recipe of bundle) {
            if (!recipe || !Array.isArray(recipe.ingredients)) continue;
            if (recipe.ingredients.length !== 2) continue;
            const sorted = [...recipe.ingredients].sort();
            if (sorted[0] === target[0] && sorted[1] === target[1]) {
                return recipe.result;
            }
        }
        return null;
    }

    static _combosBundle() {
        return (typeof window !== 'undefined' && window.TTD_DATA && Array.isArray(window.TTD_DATA.COMBOS))
            ? window.TTD_DATA.COMBOS
            : [];
    }

    // D-47 합성 패널용: typeA 또는 typeB 중 하나라도 ingredients에 포함된 모든 레시피.
    // - 2종/3종 모두 지원.
    // - D-136: 진짜 머지형(ingredient.mergeable + result === merge_result)만 제외.
    //   stone×3 → chipped_stone(돌맹이 mergeable:false)처럼 단일 재료라도 변환 레시피는 포함.
    static findRecipesContainingAny(typeA, typeB) {
        const bundle = InventorySystem._combosBundle();
        const hits = [];
        for (const recipe of bundle) {
            if (!recipe || !Array.isArray(recipe.ingredients)) continue;
            const uniq = new Set(recipe.ingredients);
            if (uniq.size === 1) {
                const only = recipe.ingredients[0];
                const def = InventorySystem.ITEMS[only] || {};
                if (def.mergeable && def.merge_result === recipe.result) continue;
            }
            if (uniq.has(typeA) || uniq.has(typeB)) {
                hits.push(recipe);
            }
        }
        return hits;
    }

    // 레시피의 재료별 필요 수량 맵. 중복 재료(예: 섬유 x2) 지원.
    static recipeRequirements(recipe) {
        const req = {};
        if (!recipe || !Array.isArray(recipe.ingredients)) return req;
        for (const t of recipe.ingredients) {
            req[t] = (req[t] || 0) + 1;
        }
        return req;
    }

    // 인벤 보유량으로 레시피 완성 가능 여부 + 부족 재료 계산.
    //   inventoryItems: [{ type, id, ... }, ...]
    //   excludeIds: 이번 합성에서 "제외할 아이템 id" (선택) — 예: 드래그 중인 아이템 중복 계산 방지.
    // 반환: { canCraft, need:{type:count}, have:{type:count}, shortage:{type:count} }
    static evaluateRecipe(recipe, inventoryItems, excludeIds) {
        const need = InventorySystem.recipeRequirements(recipe);
        const excl = excludeIds ? new Set(excludeIds) : null;
        const have = {};
        for (const it of (inventoryItems || [])) {
            if (excl && excl.has(it.id)) continue;
            have[it.type] = (have[it.type] || 0) + 1;
        }
        const shortage = {};
        let canCraft = true;
        for (const [type, count] of Object.entries(need)) {
            const h = have[type] || 0;
            if (h < count) {
                shortage[type] = count - h;
                canCraft = false;
            }
        }
        return { canCraft, need, have, shortage };
    }

    // 아이템 추가
    addItem(itemType) {
        const itemDef = InventorySystem.ITEMS[itemType];
        if (!itemDef) return false;

        const item = {
            id: Date.now() + Math.random(),
            type: itemType,
            ...itemDef,
            rotation: 0,
            x: 0,
            y: 0
        };
        // D-51: 무기 인스턴스에 durabilityLeft 초기화.
        //   런타임 소스(TTD_DATA.WEAPONS) 우선 → static fallback.
        const resolved = InventorySystem.resolveDef(itemType) || {};
        if (typeof resolved.durability === 'number' && resolved.durability > 0) {
            item.durabilityLeft = resolved.durability;
        }

        // 빈 공간 찾기
        const position = this.findEmptySpace(item.shape);
        if (!position) return false;

        item.x = position.x;
        item.y = position.y;
        this.placeItem(item);
        this.items.push(item);
        return true;
    }

    // 빈 공간 찾기
    findEmptySpace(shape) {
        const height = shape.length;
        const width = shape[0].length;

        for (let y = 0; y <= this.rows - height; y++) {
            for (let x = 0; x <= this.cols - width; x++) {
                if (this.canPlace(shape, x, y)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    // 배치 가능 여부 확인
    canPlace(shape, x, y, ignoreItemId = null) {
        const height = shape.length;
        const width = shape[0].length;

        if (y + height > this.rows || x + width > this.cols) return false;

        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (shape[dy][dx] === 1) {
                    const cellX = x + dx, cellY = y + dy;
                    // D-47: disabled 셀(가방 구석 비활성 영역)에는 배치 불가.
                    if (this.isDisabled(cellX, cellY)) return false;
                    const cell = this.grid[cellY][cellX];
                    if (cell !== null && cell !== ignoreItemId) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    // 아이템 배치
    placeItem(item) {
        const shape = item.shape;
        for (let dy = 0; dy < shape.length; dy++) {
            for (let dx = 0; dx < shape[0].length; dx++) {
                if (shape[dy][dx] === 1) {
                    this.grid[item.y + dy][item.x + dx] = item.id;
                }
            }
        }
    }

    // 아이템 제거
    removeItem(item) {
        const shape = item.shape;
        for (let dy = 0; dy < shape.length; dy++) {
            for (let dx = 0; dx < shape[0].length; dx++) {
                if (shape[dy][dx] === 1) {
                    this.grid[item.y + dy][item.x + dx] = null;
                }
            }
        }
    }

    // 아이템 회전
    // - 그리드에 배치된 상태면 기존 자리에서 회전 시도, 불가 시 원복
    // - 선택 모드(그리드에서 떠 있는 상태)면 shape만 갱신 (배치 없음)
    rotateItem(item) {
        const newShape = this.rotate90(item.shape);
        const isFloating = this.selectedItem && this.selectedItem.id === item.id;

        if (isFloating) {
            item.shape = newShape;
            item.rotation = (item.rotation + 90) % 360;
            return true;
        }

        this.removeItem(item);
        if (this.canPlace(newShape, item.x, item.y, item.id)) {
            item.shape = newShape;
            item.rotation = (item.rotation + 90) % 360;
            this.placeItem(item);
            return true;
        } else {
            this.placeItem(item);
            return false;
        }
    }

    // 90도 회전
    rotate90(shape) {
        const rows = shape.length;
        const cols = shape[0].length;
        const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                rotated[x][rows - 1 - y] = shape[y][x];
            }
        }
        return rotated;
    }

    // 아이템 이동
    moveItem(item, newX, newY) {
        this.removeItem(item);

        if (this.canPlace(item.shape, newX, newY, item.id)) {
            item.x = newX;
            item.y = newY;
            this.placeItem(item);
            return true;
        } else {
            this.placeItem(item);
            return false;
        }
    }

    // 아이템 교체 (둘 다 그리드에 있을 때만 사용)
    swapItems(item1, item2) {
        this.removeItem(item1);
        this.removeItem(item2);

        const pos1 = { x: item1.x, y: item1.y };
        const pos2 = { x: item2.x, y: item2.y };

        item1.x = pos2.x;
        item1.y = pos2.y;
        item2.x = pos1.x;
        item2.y = pos1.y;

        if (this.canPlace(item1.shape, item1.x, item1.y) &&
            this.canPlace(item2.shape, item2.x, item2.y, item1.id)) {
            this.placeItem(item1);
            this.placeItem(item2);
            return true;
        } else {
            item1.x = pos1.x;
            item1.y = pos1.y;
            item2.x = pos2.x;
            item2.y = pos2.y;
            this.placeItem(item1);
            this.placeItem(item2);
            return false;
        }
    }

    // 선택 모드 아이템을 (x,y) 좌표에 떨어뜨릴 때 그 자리의 아이템 목록
    // shape 기준으로 점유할 모든 칸을 훑어 유니크한 아이템만 반환
    getItemsOverlapping(shape, x, y) {
        const set = new Set();
        const overlapped = [];
        const h = shape.length;
        const w = shape[0].length;
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (shape[dy][dx] !== 1) continue;
                const gy = y + dy;
                const gx = x + dx;
                if (gy < 0 || gy >= this.rows || gx < 0 || gx >= this.cols) continue;
                const id = this.grid[gy][gx];
                if (id && !set.has(id)) {
                    set.add(id);
                    const item = this.items.find(i => i.id === id);
                    if (item) overlapped.push(item);
                }
            }
        }
        return overlapped;
    }

    // ── D-24 머지·조합 통합 ──────────────────────────────────────────
    //
    // canMerge: 같은 type 두 아이템이 상위 단계로 파생 가능한지.
    //   시그니처 유지. 내부 로직만 merge_result 기반으로 교체(기존 grade 승급 제거).
    canMerge(item1, item2) {
        if (!item1 || !item2 || item1.id === item2.id) return false;
        if (item1.type !== item2.type) return false;
        const def = InventorySystem.resolveDef(item1.type);
        return def.mergeable === true && !!def.merge_result;
    }

    // getMergeResult: 머지 성공 시 생성할 타입 id. null이면 머지 불가.
    getMergeResult(item) {
        if (!item) return null;
        const def = InventorySystem.resolveDef(item.type);
        return def.merge_result || null;
    }

    // canCombine: 서로 다른 type 두 아이템이 조합 레시피에 존재하는가.
    canCombine(item1, item2) {
        if (!item1 || !item2 || item1.id === item2.id) return false;
        if (item1.type === item2.type) return false;
        return InventorySystem.lookupCombo(item1.type, item2.type) !== null;
    }

    getCombineResult(item1, item2) {
        if (!this.canCombine(item1, item2)) return null;
        return InventorySystem.lookupCombo(item1.type, item2.type);
    }

    // 구버전 호환: 기존에 호출하던 "선택된 아이템 + 그리드 아이템 머지" API.
    // confirmPlacement 경로로 흡수됐으나, 외부에서 직접 호출할 수 있어 시그니처 유지.
    mergeItems(item1, item2) {
        if (!this.canMerge(item1, item2)) return null;
        const newType = this.getMergeResult(item1);
        if (!newType) return null;
        this.removeItem(item1);
        this.removeItem(item2);
        this.items = this.items.filter(i => i.id !== item1.id && i.id !== item2.id);
        return this.addItem(newType);
    }

    // 좌표로 아이템 찾기
    getItemAt(x, y) {
        if (y < 0 || y >= this.rows || x < 0 || x >= this.cols) return null;
        const itemId = this.grid[y][x];
        if (!itemId) return null;
        return this.items.find(item => item.id === itemId);
    }

    // 아이템 선택 (공중에 띄움)
    // - 이미 선택된 아이템이 있으면 원래 위치에 돌려놓고 새 아이템을 선택
    selectItem(item) {
        if (this.selectedItem && this.selectedItem !== item) {
            // 원래 위치에 되돌리기 가능하면 되돌리고, 아니면 그대로 공중 유지
            if (this.canPlace(this.selectedItem.shape, this.selectedItem.x, this.selectedItem.y)) {
                this.placeItem(this.selectedItem);
            }
        }
        if (!item) {
            this.selectedItem = null;
            return;
        }
        if (this.selectedItem && this.selectedItem.id === item.id) return;
        this.removeItem(item);
        this.selectedItem = item;
    }

    // 선택 취소 — 원래 위치로 되돌림 (불가 시 빈 자리로 fallback)
    cancelSelection() {
        if (!this.selectedItem) return;
        const item = this.selectedItem;
        if (this.canPlace(item.shape, item.x, item.y)) {
            this.placeItem(item);
        } else {
            const pos = this.findEmptySpace(item.shape);
            if (pos) {
                item.x = pos.x;
                item.y = pos.y;
                this.placeItem(item);
            }
        }
        this.selectedItem = null;
    }

    // D-45 (2026-04-23): 선택된 아이템을 인벤토리에서 영구 제거 (버리기).
    // - selectItem() 시점에 이미 grid에서 removeItem() 되어 있으므로 items 배열에서만 빼면 된다.
    // - 반환: 제거된 아이템(없으면 null). 호출부는 이름으로 메시지를 구성.
    // - 확인 단계 없음(1회 확정) — UI 쪽에서 버튼 1클릭 = 즉시 폐기. 인벤토리 롱프레스 UX라
    //   오조작 확률이 낮아 속도를 우선 (디렉터 판단).
    discardSelected() {
        if (!this.selectedItem) return null;
        const item = this.selectedItem;
        this.items = this.items.filter(it => it.id !== item.id);
        this.selectedItem = null;
        return item;
    }

    // 상위 단계 결과물(머지/조합)을 그리드의 특정 좌표에 배치.
    // 해당 자리가 차 있으면 빈 자리로 폴백(`addItem`).
    // - 공통 헬퍼: 머지·조합 분기에서 결과물 배치 로직 중복 제거.
    _placeDerivedItem(newType, preferredX, preferredY) {
        const def = InventorySystem.ITEMS[newType];
        if (!def) return false;
        const merged = {
            id: Date.now() + Math.random(),
            type: newType,
            ...def,
            rotation: 0,
            x: preferredX,
            y: preferredY
        };
        // D-51: 무기 결과물은 durabilityLeft 초기화 (조합으로 생성된 신품).
        const resolved = InventorySystem.resolveDef(newType) || {};
        if (typeof resolved.durability === 'number' && resolved.durability > 0) {
            merged.durabilityLeft = resolved.durability;
        }
        if (this.canPlace(merged.shape, merged.x, merged.y)) {
            this.placeItem(merged);
            this.items.push(merged);
            return true;
        }
        return this.addItem(newType);
    }

    // D-51: 무기 사용 소모.
    //   item: inventory.items 중 무기 인스턴스 1자루.
    //   n: 차감량(창찌르기 1, 창던지기는 fullLoss로 durabilityLeft 전량).
    //   fullLoss: true면 남은 durability 전부 날림.
    //   durabilityLeft <= 0이 되면 인벤에서 제거하고 broken=true 반환.
    // 반환: { broken, durabilityLeft }
    consumeWeaponUse(item, n, fullLoss) {
        if (!item) return { broken: false, durabilityLeft: 0 };
        const before = typeof item.durabilityLeft === 'number' ? item.durabilityLeft : 0;
        const dec = fullLoss ? before : (typeof n === 'number' ? n : 1);
        const after = Math.max(0, before - dec);
        item.durabilityLeft = after;
        if (after <= 0) {
            this.removeItem(item);
            this.items = this.items.filter(it => it.id !== item.id);
            return { broken: true, durabilityLeft: 0 };
        }
        return { broken: false, durabilityLeft: after };
    }

    // 선택된 아이템을 (x, y)에 확정 배치
    // 반환: { ok, action: 'place'|'merge'|'swap'|'none', ... }
    //   - merge: 같은 재료 → 즉시 상위 재료 자동 합성.
    //   - swap: 다른 재료 → 교체 (선택 전환).
    // D-48: 합성 패널은 '선택된 아이템 기준'으로 UI가 자동 노출 — 이 함수가 craft_prompt를
    //   반환하던 경로는 폐기. 드롭 상호작용은 단순 머지/swap/배치에 집중.
    confirmPlacement(x, y) {
        if (!this.selectedItem) return { ok: false, action: 'none' };
        const item = this.selectedItem;

        // 범위 체크
        if (y + item.shape.length > this.rows || x + item.shape[0].length > this.cols || x < 0 || y < 0) {
            return { ok: false, action: 'none' };
        }

        const overlapped = this.getItemsOverlapping(item.shape, x, y);

        // 1) 빈 자리 — 그대로 배치
        if (overlapped.length === 0) {
            item.x = x;
            item.y = y;
            this.placeItem(item);
            this.selectedItem = null;
            return { ok: true, action: 'place' };
        }

        // 2) 정확히 1개 아이템과 겹침
        if (overlapped.length === 1) {
            const target = overlapped[0];

            // 2a) 머지 (같은 재료 2개 → merge_result, 즉시 실행)
            if (this.canMerge(item, target)) {
                const newType = this.getMergeResult(item);
                this.removeItem(target);
                this.items = this.items.filter(i => i.id !== target.id && i.id !== item.id);
                this.selectedItem = null;
                if (!newType) return { ok: true, action: 'merge' };
                this._placeDerivedItem(newType, target.x, target.y);
                return { ok: true, action: 'merge', resultType: newType };
            }

            // 2b) 교체 (swap) — 다른 재료는 무조건 swap. 합성은 선택 시점에 UI가 패널로 안내.
            this.removeItem(target);
            if (this.canPlace(item.shape, x, y)) {
                item.x = x;
                item.y = y;
                this.placeItem(item);
                this.selectedItem = target;
                return { ok: true, action: 'swap' };
            } else {
                this.placeItem(target);
                return { ok: false, action: 'none' };
            }
        }

        // 3) 2개 이상 겹침 — 기획상 불가
        return { ok: false, action: 'none' };
    }

    // D-47 합성 확정: 레시피의 ingredients를 인벤에서 개별 제거 후 결과 아이템을 배치.
    //   - preferredPos가 있으면 해당 자리 우선, 실패 시 빈 공간 자동 탐색.
    //   - 결과 배치 실패(공간 없음)면 재료 소비도 하지 않고 실패 반환.
    // D-71: `recipe.count` 지원 — 1회 조합으로 생성되는 결과물 수량.
    //   첫 번째 결과물은 preferredPos에 시도, 나머지는 빈 칸 자동 탐색.
    //   인벤이 가득 차면 들어간 만큼만 생성(overflow>0)하고 ok 반환.
    //   재료 소비는 1회 고정(count와 무관) — 한 번의 조합.
    // 반환: { ok, reason?, resultType?, shortage?, produced?, overflow? }
    craftRecipe(recipe, preferredPos) {
        if (!recipe || !Array.isArray(recipe.ingredients) || !recipe.result) {
            return { ok: false, reason: 'invalid_recipe' };
        }
        const evalResult = InventorySystem.evaluateRecipe(recipe, this.items);
        if (!evalResult.canCraft) {
            return { ok: false, reason: 'short_ingredients', shortage: evalResult.shortage };
        }
        // 결과물 배치 가능 여부 선검사 — 실제 소비 전에 공간 체크(첫 1개 기준).
        const resultDef = InventorySystem.ITEMS[recipe.result];
        if (!resultDef) return { ok: false, reason: 'unknown_result' };
        const canPlaceAtPreferred = preferredPos
            && this.canPlace(resultDef.shape, preferredPos.x, preferredPos.y);
        const placementPos = canPlaceAtPreferred
            ? preferredPos
            : this.findEmptySpace(resultDef.shape);
        if (!placementPos) {
            return { ok: false, reason: 'no_space' };
        }
        // 재료 소비 — 각 type에 대해 필요 개수만큼 items 앞에서부터 제거.
        const need = InventorySystem.recipeRequirements(recipe);
        for (const [type, count] of Object.entries(need)) {
            let remaining = count;
            const keep = [];
            for (const it of this.items) {
                if (remaining > 0 && it.type === type) {
                    this.removeItem(it);
                    remaining -= 1;
                    continue;
                }
                keep.push(it);
            }
            this.items = keep;
        }
        // 결과 배치 — count만큼 반복. 첫 1개는 preferredPos에, 나머지는 빈 칸.
        const count = Math.max(1, Number(recipe.count) || 1);
        let produced = 0;
        const firstOk = this._placeDerivedItem(recipe.result, placementPos.x, placementPos.y);
        if (firstOk) produced += 1;
        for (let i = 1; i < count; i++) {
            if (this.addItem(recipe.result)) produced += 1;
            else break; // 가방 포화 — 나머지는 포기.
        }
        if (produced === 0) return { ok: false, reason: 'place_failed' };
        const overflow = count - produced;
        return { ok: true, resultType: recipe.result, produced, overflow };
    }
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventorySystem;
}
