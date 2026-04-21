// inventory.js - 테트리스식 인벤토리 시스템

class InventorySystem {
    constructor(rows = 6, cols = 5) {
        this.rows = rows;
        this.cols = cols;
        this.grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
        this.selectedItem = null;
        this.items = [];
    }

    // 아이템 정의
    static ITEMS = {
        // 재료 (1x1)
        material_low: { name: '낡은 재료', shape: [[1]], grade: 1, mergeable: true },
        material_mid: { name: '일반 재료', shape: [[1]], grade: 2, mergeable: true },
        material_high: { name: '고급 재료', shape: [[1]], grade: 3, mergeable: true },
        
        // 음식 (1x1)
        food: { name: '음식', shape: [[1]], grade: 1, mergeable: false },
        
        // 무기 (2x1)
        weapon_basic: { name: '나무창', shape: [[1, 1]], grade: 1, mergeable: false },
        weapon_stone: { name: '돌창', shape: [[1, 1]], grade: 2, mergeable: false },
        
        // 도구 (L자 모양)
        tool_pickaxe: { name: '곡괭이', shape: [[1, 0], [1, 1]], grade: 2, mergeable: false },
        
        // 장비 (2x2)
        armor: { name: '가죽 갑옷', shape: [[1, 1], [1, 1]], grade: 2, mergeable: false }
    };

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

    // 머지 (같은 등급 재료 합치기)
    canMerge(item1, item2) {
        return item1.mergeable && 
               item2.mergeable && 
               item1.type === item2.type && 
               item1.grade === item2.grade &&
               item1.id !== item2.id;
    }

    mergeItems(item1, item2) {
        if (!this.canMerge(item1, item2)) return null;

        // 다음 등급 재료 (grade 3 = 최고 등급이면 머지 불가)
        const newType = item1.grade === 1 ? 'material_mid'
                       : item1.grade === 2 ? 'material_high'
                       : null;
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

    // 선택된 아이템을 (x, y)에 확정 배치
    // 반환: { ok: boolean, action: 'place'|'merge'|'swap'|'none', mergedTo?: item }
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

            // 2a) 머지 가능하면 머지
            if (this.canMerge(item, target)) {
                // target은 grid에 있고 item은 공중. 둘 다 제거 후 상위 등급 생성.
                this.removeItem(target);
                this.items = this.items.filter(i => i.id !== target.id && i.id !== item.id);
                this.selectedItem = null;
                const newType = item.grade === 1 ? 'material_mid'
                               : item.grade === 2 ? 'material_high'
                               : null;
                if (!newType) return { ok: true, action: 'merge' };
                // 머지 결과를 target 자리에 우선 배치 시도
                const def = InventorySystem.ITEMS[newType];
                const merged = {
                    id: Date.now() + Math.random(),
                    type: newType,
                    ...def,
                    rotation: 0,
                    x: target.x,
                    y: target.y
                };
                if (this.canPlace(merged.shape, merged.x, merged.y)) {
                    this.placeItem(merged);
                    this.items.push(merged);
                } else {
                    this.addItem(newType);
                }
                return { ok: true, action: 'merge' };
            }

            // 2b) 교체: 선택 중이던 item을 target 자리에 두고, target을 선택 모드로 전환
            //     단, item이 target 자리에 모양 맞게 들어가야 함
            this.removeItem(target);
            if (this.canPlace(item.shape, x, y)) {
                item.x = x;
                item.y = y;
                this.placeItem(item);
                this.selectedItem = target; // target이 공중으로
                return { ok: true, action: 'swap' };
            } else {
                // 되돌리기
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