// inventory.js - 테트리스식 인벤토리 시스템
//
// D-24 머지·조합 통합 시스템:
//   - 같은 재료 N개(기본 2개)를 겹치면 머지 → `merge_result` 타입의 상위 아이템 1개.
//   - 다른 재료 2개를 겹치면 조합 조회 → `window.TTD_DATA.COMBOS`에서 매칭되는 result.
//   - 둘 다 실패면 swap (기존 동작).
// 시그니처는 기존과 동일(canMerge/mergeItems/confirmPlacement). 호출부 회귀 없음.

class InventorySystem {
    constructor(rows = 6, cols = 5) {
        this.rows = rows;
        this.cols = cols;
        this.grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
        this.selectedItem = null;
        this.items = [];
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
        stem:     { name: '질긴줄기', shape: [[1]], grade: 1, mergeable: true,  category: 'env',  merge_result: 'plant_fiber' },

        // === 1단계 음식재료 (D-30: 2단계 음식 추가 — 머지 가능) ===
        mushroom: { name: '버섯',     shape: [[1]], grade: 1, mergeable: true,  category: 'food', merge_result: 'mushroom_mix' },
        berry:    { name: '산딸기',   shape: [[1]], grade: 1, mergeable: true,  category: 'food', merge_result: 'berry_mix' },

        // === 2단계 (조합 결과물) ===
        wood:         { name: '목재',         shape: [[1]], grade: 2, mergeable: false, category: 'material', merge_result: null },
        plant_fiber:  { name: '식물 섬유',    shape: [[1]], grade: 2, mergeable: false, category: 'material', merge_result: null },
        clean_cloth:  { name: '깨끗한 천',    shape: [[1]], grade: 2, mergeable: false, category: 'material', merge_result: null },
        bandage:      { name: '붕대',         shape: [[1]], grade: 2, mergeable: false, category: 'consumable', merge_result: null },

        // === 2단계 음식 (D-30 신규) ===
        berry_mix:    { name: '딸기모둠',     shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },
        mushroom_mix: { name: '버섯모둠',     shape: [[1]], grade: 2, mergeable: false, category: 'food', merge_result: null },

        // === 레거시 (기존 카드 시스템 참조) — 후속 작업에서 1단계 체계로 흡수 예정 ===
        material_low:  { name: '낡은 재료', shape: [[1]], grade: 1, mergeable: false, merge_result: null },
        material_mid:  { name: '일반 재료', shape: [[1]], grade: 2, mergeable: false, merge_result: null },
        material_high: { name: '고급 재료', shape: [[1]], grade: 3, mergeable: false, merge_result: null },

        weapon_basic: { name: '나무창', shape: [[1, 1]], grade: 1, mergeable: false },
        weapon_stone: { name: '돌창',   shape: [[1, 1]], grade: 2, mergeable: false },

        tool_pickaxe: { name: '곡괭이', shape: [[1, 0], [1, 1]], grade: 2, mergeable: false },

        armor: { name: '가죽 갑옷', shape: [[1, 1], [1, 1]], grade: 2, mergeable: false }
    };

    // 런타임에 TTD_DATA.ITEMS(Notion 기반)이 덮어쓰는 값 조회.
    // 우선 순위: TTD_DATA.ITEMS(id 매칭) → static ITEMS(type 매칭).
    // D-24: 이 함수가 있어야 시트·Notion 편집이 코드 재배포 없이 반영됨.
    static resolveDef(type) {
        const staticDef = InventorySystem.ITEMS[type] || {};
        const bundle = (typeof window !== 'undefined' && window.TTD_DATA && Array.isArray(window.TTD_DATA.ITEMS))
            ? window.TTD_DATA.ITEMS
            : null;
        if (!bundle) return staticDef;
        const notionDef = bundle.find(it => it && it.id === type);
        if (!notionDef) return staticDef;
        // Notion 우선: merge_enabled + merge_result만 덮어씀. name/shape 등은 static 유지.
        return {
            ...staticDef,
            mergeable: notionDef.merge_enabled === true,
            merge_result: notionDef.merge_result || null,
        };
    }

    // 두 아이템의 조합 레시피 조회 (TTD_DATA.COMBOS 전역 리스트).
    // ingredients 순서 무관 비교. 2종 매칭만 지원(3종 이상은 후속 이터레이션).
    static lookupCombo(typeA, typeB) {
        const bundle = (typeof window !== 'undefined' && window.TTD_DATA && Array.isArray(window.TTD_DATA.COMBOS))
            ? window.TTD_DATA.COMBOS
            : [];
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
                    const cell = this.grid[y + dy][x + dx];
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
        if (this.canPlace(merged.shape, merged.x, merged.y)) {
            this.placeItem(merged);
            this.items.push(merged);
            return true;
        }
        return this.addItem(newType);
    }

    // 선택된 아이템을 (x, y)에 확정 배치
    // 반환: { ok: boolean, action: 'place'|'merge'|'combine'|'swap'|'none', mergedTo?: item, resultType?: string }
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

            // 2a) 머지 (같은 재료 2개 → merge_result)
            if (this.canMerge(item, target)) {
                const newType = this.getMergeResult(item);
                this.removeItem(target);
                this.items = this.items.filter(i => i.id !== target.id && i.id !== item.id);
                this.selectedItem = null;
                if (!newType) return { ok: true, action: 'merge' };
                this._placeDerivedItem(newType, target.x, target.y);
                return { ok: true, action: 'merge', resultType: newType };
            }

            // 2b) 조합 (다른 재료 2개 → combos 레시피)
            if (this.canCombine(item, target)) {
                const newType = this.getCombineResult(item, target);
                this.removeItem(target);
                this.items = this.items.filter(i => i.id !== target.id && i.id !== item.id);
                this.selectedItem = null;
                if (!newType) return { ok: true, action: 'combine' };
                this._placeDerivedItem(newType, target.x, target.y);
                return { ok: true, action: 'combine', resultType: newType };
            }

            // 2c) 교체: 선택 중이던 item을 target 자리에 두고, target을 선택 모드로 전환
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
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventorySystem;
}
