// inventory.js - 테트리스식 인벤토리 시스템

class InventorySystem {
    constructor(rows = 6, cols = 8) {
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
    rotateItem(item) {
        const newShape = this.rotate90(item.shape);
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

    // 아이템 교체
    swapItems(item1, item2) {
        this.removeItem(item1);
        this.removeItem(item2);
        
        const temp = { x: item1.x, y: item1.y };
        item1.x = item2.x;
        item1.y = item2.y;
        item2.x = temp.x;
        item2.y = temp.y;
        
        if (this.canPlace(item1.shape, item1.x, item1.y) && 
            this.canPlace(item2.shape, item2.x, item2.y)) {
            this.placeItem(item1);
            this.placeItem(item2);
            return true;
        } else {
            item1.x = temp.x;
            item1.y = temp.y;
            item2.x = item1.x;
            item2.y = item1.y;
            this.placeItem(item1);
            this.placeItem(item2);
            return false;
        }
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
        
        this.removeItem(item1);
        this.removeItem(item2);
        
        this.items = this.items.filter(i => i.id !== item1.id && i.id !== item2.id);
        
        // 다음 등급 재료 생성
        const newType = item1.grade === 1 ? 'material_mid' : 'material_high';
        return this.addItem(newType);
    }

    // 좌표로 아이템 찾기
    getItemAt(x, y) {
        if (y < 0 || y >= this.rows || x < 0 || x >= this.cols) return null;
        const itemId = this.grid[y][x];
        if (!itemId) return null;
        return this.items.find(item => item.id === itemId);
    }

    // 아이템 선택
    selectItem(item) {
        if (this.selectedItem) {
            this.placeItem(this.selectedItem);
        }
        this.selectedItem = item;
        if (item) {
            this.removeItem(item);
        }
    }

    // 선택된 아이템 확정
    confirmPlacement(x, y) {
        if (!this.selectedItem) return false;
        
        const item = this.selectedItem;
        if (this.canPlace(item.shape, x, y, item.id)) {
            item.x = x;
            item.y = y;
            this.placeItem(item);
            this.selectedItem = null;
            return true;
        }
        return false;
    }
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventorySystem;
}