// dropTable.js — 타일 "뒤져보기" 2단계 드롭 추첨
// 1단계: 지역 → 카테고리 추첨 (환경재료 / 음식재료 / 드롭없음)
// 2단계: 해당 지역에서 나오는 해당 카테고리 아이템들 중 균등 추첨
//
// 확률/매핑의 원본(Source of Truth)은 구글 시트의 두 탭:
//   - 지역→카테고리 확률: 탭 '드롭테이블'
//   - 지역×카테고리 → 아이템 풀: 탭 '드롭풀'
// 시트 → data/drop_table.json → data/data.js → window.TTD_DATA.DROP_TABLE 로
// 빌드 타임에 주입된다. 이 파일은 런타임에 TTD_DATA를 우선 읽고,
// 데이터가 비어 있을 때만 아래 폴백 상수를 사용한다.
// (D-06: 시트 SSOT 전환)
//
// 시트 탭이 아직 없거나 make data를 돌리기 전이면 폴백이 사용된다.
// 폴백 값은 시트 SSOT로 옮기기 전의 마지막 하드코딩 스냅샷이며,
// 지역별 카테고리 확률·아이템 풀을 수정할 때는 시트를 먼저 고쳐야 한다.

// 폴백 — 시트 탭이 없을 때만 사용. 시트 SSOT가 정상화되면 건드리지 않음.
const FALLBACK_DROP_TABLE = {
    '숲':    { env: 50, food: 25, none: 25 },
    '덤불':  { env: 40, food: 30, none: 30 },
    '평원':  { env: 35, food: 20, none: 45 },
    '시냇물': { env: 40, food: 0,  none: 60 },
    '동굴':  { env: 55, food: 20, none: 25 }
};

const FALLBACK_REGION_ITEM_POOL = {
    '숲':    { env: ['branch'],         food: ['mushroom'] },
    '덤불':  { env: ['stem'],           food: ['berry'] },
    '평원':  { env: ['stone'],          food: ['berry'] },
    '시냇물': { env: ['stone'],          food: [] },
    '동굴':  { env: ['stone'],          food: ['mushroom'] }
};

// TTD_DATA.DROP_TABLE이 있으면 그걸 쓰고, 없거나 비면 폴백.
// 반환 형태: { regions, pool } — 각각 DROP_TABLE/REGION_ITEM_POOL에 대응.
function resolveDropSource() {
    const bundle = (typeof window !== 'undefined' && window.TTD_DATA && window.TTD_DATA.DROP_TABLE) || null;
    const fromBundle = bundle && typeof bundle === 'object' && !Array.isArray(bundle) ? bundle : null;

    const regions = (fromBundle && fromBundle.regions && Object.keys(fromBundle.regions).length > 0)
        ? fromBundle.regions
        : FALLBACK_DROP_TABLE;
    const pool = (fromBundle && fromBundle.pool && Object.keys(fromBundle.pool).length > 0)
        ? fromBundle.pool
        : FALLBACK_REGION_ITEM_POOL;

    return { regions, pool };
}

// 이름을 유지해 외부 호환성 (module.exports 경로용)
const DROP_TABLE = FALLBACK_DROP_TABLE;
const REGION_ITEM_POOL = FALLBACK_REGION_ITEM_POOL;

// 뒤져보기 1회 결과 추첨
// opts.forceCategory: 'env'|'food' — 카테고리 1차 추첨을 건너뛰고 해당 풀에서 직접 추첨.
//   '음식 찾기' 같은 카드는 이 옵션으로 배선된다. 지역에 food 풀이 비어있으면 none 폴백.
// 반환: { item: string|null, category: 'env'|'food'|'none' }
function rollTileDrop(region, opts) {
    const { regions, pool } = resolveDropSource();
    const table = regions[region];
    if (!table) return { item: null, category: 'none' };

    const forceCategory = opts && opts.forceCategory;

    let category;
    if (forceCategory === 'env' || forceCategory === 'food') {
        category = forceCategory;
    } else {
        const roll = Math.random() * 100;
        if (roll < table.env) {
            category = 'env';
        } else if (roll < table.env + table.food) {
            category = 'food';
        } else {
            category = 'none';
        }
    }

    if (category === 'none') return { item: null, category };

    const items = pool[region]?.[category] || [];
    if (items.length === 0) return { item: null, category: 'none' };

    const item = items[Math.floor(Math.random() * items.length)];
    return { item, category };
}

// 사람이 읽는 결과 라벨 (메시지용)
function describeDropCategory(category) {
    return category === 'env' ? '환경재료'
         : category === 'food' ? '음식재료'
         : '없음';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rollTileDrop, DROP_TABLE, REGION_ITEM_POOL, describeDropCategory, resolveDropSource };
}
