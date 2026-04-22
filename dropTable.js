// dropTable.js — 타일 "뒤져보기" 2단계 드롭 추첨
// 1단계: 지역 → 카테고리 추첨 (환경재료 / 음식재료 / 드롭없음)
// 2단계: 해당 지역에서 나오는 해당 카테고리 아이템들 중 균등 추첨
//
// 확률/매핑의 원본(Source of Truth)은 Notion:
//   - 지역→카테고리 확률: "🎲 타일 드롭 테이블" DB
//   - 지역↔아이템 매핑: "🎒 아이템" DB의 "나오는 지역" 컬럼
// 이 파일은 해당 Notion 상태를 스냅샷한 값이다. Notion을 수정하면 여기도 맞춰 갱신.

// 지역별 카테고리 드롭 확률 (% 합 = 100)
const DROP_TABLE = {
    '숲':    { env: 50, food: 25, none: 25 },
    '덤불':  { env: 40, food: 30, none: 30 },
    '평원':  { env: 35, food: 20, none: 45 },
    '시냇물': { env: 40, food: 0,  none: 60 },
    '동굴':  { env: 55, food: 20, none: 25 }
};

// 지역별 아이템 풀 (카테고리 → 인벤토리 아이템 type 배열)
// Notion "🎒 아이템" DB의 "나오는 지역" 컬럼과 정합.
const REGION_ITEM_POOL = {
    '숲':    { env: ['branch'],         food: ['mushroom'] },
    '덤불':  { env: ['stem'],           food: ['berry'] },
    '평원':  { env: ['stone'],          food: ['berry'] },
    '시냇물': { env: ['stone'],          food: [] },
    '동굴':  { env: ['stone'],          food: ['mushroom'] }
};

// 뒤져보기 1회 결과 추첨
// 반환: { item: string|null, category: 'env'|'food'|'none' }
function rollTileDrop(region) {
    const table = DROP_TABLE[region];
    if (!table) return { item: null, category: 'none' };

    const roll = Math.random() * 100;
    let category;
    if (roll < table.env) {
        category = 'env';
    } else if (roll < table.env + table.food) {
        category = 'food';
    } else {
        category = 'none';
    }

    if (category === 'none') return { item: null, category };

    const pool = REGION_ITEM_POOL[region]?.[category] || [];
    if (pool.length === 0) return { item: null, category: 'none' };

    const item = pool[Math.floor(Math.random() * pool.length)];
    return { item, category };
}

// 사람이 읽는 결과 라벨 (메시지용)
function describeDropCategory(category) {
    return category === 'env' ? '환경재료'
         : category === 'food' ? '음식재료'
         : '없음';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rollTileDrop, DROP_TABLE, REGION_ITEM_POOL, describeDropCategory };
}
