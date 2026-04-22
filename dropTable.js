// dropTable.js — 타일 "뒤져보기" 2단계 드롭 추첨
// 1단계: 지역 → 카테고리 추첨 (환경재료 / 음식재료 / 드롭없음)
// 2단계: 해당 지역에서 나오는 해당 카테고리 아이템들 중 가중치 추첨
//
// 확률/매핑의 원본(Source of Truth)은 구글 시트의 세 탭:
//   - 지역→카테고리 확률: 탭 '드롭테이블'
//   - 지역×카테고리 → 아이템 풀: 탭 '드롭풀' (weights 컬럼이 있으면 가중치 적용)
// 시트 → data/drop_table.json → data/data.js → window.TTD_DATA.DROP_TABLE 로
// 빌드 타임에 주입된다. 이 파일은 런타임에 TTD_DATA를 우선 읽고,
// 데이터가 비어 있을 때만 아래 폴백 상수를 사용한다.
// (D-06: 시트 SSOT 전환)
//
// D-28(2026-04-22, 요한 지시):
// - 뒤져보기는 "슬롯 3개 독립 추첨"으로 진행. 슬롯별 게이트 확률 통과 시에만
//   rollTileDrop이 호출되어 그 슬롯의 아이템이 결정된다.
//   슬롯1 100% / 슬롯2 30% / 슬롯3 30% — 유저에게는 노출하지 않는다.
// - 확률/슬롯 수는 SSOT 승격 여지를 남겨둔다: window.TTD_DATA.SEARCH_SLOTS가 있으면
//   그 값을 쓰고, 없으면 아래 폴백 상수를 사용. 배열 요소가 하나의 슬롯 확률(0~100).
//
// D-33 (2026-04-22, 요한 지시): 시냇물 신규 아이템 water/fish + 가중치.
// - 기존 "풀에서 균등 추첨" 방식은 80/20 같은 밸런스를 표현하지 못함.
// - 시트 `드롭풀`에 `weights` 컬럼을 추가(CSV "80,20") 또는 별도 `weights`
//   최상위 맵을 두어 지역×카테고리별 가중치를 지정한다.
// - 하위 호환: weights 없는 지역/카테고리는 기존과 동일한 균등 추첨.
//
// D-34 (2026-04-22, 요한 지시): '좋은곳' 타일 슬롯 확률 상향 (100/80/80).
// - 타일 속성별로 슬롯 확률이 달라질 수 있게 resolveSearchSlots(tile)에 tile을 넘김.
// - tile.type === 'good'이면 TILE_TYPE_SLOTS의 'good' 맵을 사용.
// - 시트 SSOT 승격 시 window.TTD_DATA.TILE_TYPE_SLOTS에서 덮어쓸 수 있도록 배선.
//
// D-35 (2026-04-22, 요한 지시): 같은 타일 반복 뒤져보기 페널티.
// - 한 타일에서 뒤져보기를 반복하면 매번 슬롯 확률이 절반이 됨(0.5^searchedCount).
// - 플레이어가 타일을 한 번이라도 떠났었다면(hasBeenLeft=true) 초기 mult가 0.5.
//   (= 이미 한 번 쓸고 간 구역이라는 뉘앙스. 돌아와도 수확량이 회복되지 않음.)
// - 수식: mult = (hasBeenLeft ? 0.5 : 1.0) * 0.5^searchedCount.
// - 슬롯 확률에 mult를 곱하고 0~100에 clamp.
//
// 시트 탭이 아직 없거나 make data를 돌리기 전이면 폴백이 사용된다.
// 폴백 값은 시트 SSOT로 옮기기 전의 마지막 하드코딩 스냅샷이며,
// 지역별 카테고리 확률·아이템 풀을 수정할 때는 시트를 먼저 고쳐야 한다.

// 폴백 — 시트 탭이 없을 때만 사용. 시트 SSOT가 정상화되면 건드리지 않음.
const FALLBACK_DROP_TABLE = {
    '숲':    { env: 50, food: 25, none: 25 },
    '덤불':  { env: 40, food: 30, none: 30 },
    '평원':  { env: 35, food: 20, none: 45 },
    '시냇물': { env: 30, food: 40, none: 30 },
    '동굴':  { env: 55, food: 20, none: 25 }
};

const FALLBACK_REGION_ITEM_POOL = {
    '숲':    { env: ['branch'],         food: ['mushroom'] },
    '덤불':  { env: ['stem'],           food: ['berry'] },
    '평원':  { env: ['stone'],          food: ['berry'] },
    '시냇물': { env: ['stone'],          food: ['water', 'fish'] },
    '동굴':  { env: ['stone'],          food: ['mushroom'] }
};

// D-33: 지역×카테고리 가중치. items 배열과 같은 순서/길이의 숫자 배열.
// 예: {'시냇물': {'food': [80, 20]}} → water 80%, fish 20%.
// 비어있거나 길이가 맞지 않으면 균등 추첨으로 폴백.
const FALLBACK_REGION_POOL_WEIGHTS = {
    '시냇물': { food: [80, 20] }
};

// TTD_DATA.DROP_TABLE이 있으면 그걸 쓰고, 없거나 비면 폴백.
// 반환 형태: { regions, pool, weights } — 각각 DROP_TABLE/REGION_ITEM_POOL에 대응.
function resolveDropSource() {
    const bundle = (typeof window !== 'undefined' && window.TTD_DATA && window.TTD_DATA.DROP_TABLE) || null;
    const fromBundle = bundle && typeof bundle === 'object' && !Array.isArray(bundle) ? bundle : null;

    const regions = (fromBundle && fromBundle.regions && Object.keys(fromBundle.regions).length > 0)
        ? fromBundle.regions
        : FALLBACK_DROP_TABLE;
    const pool = (fromBundle && fromBundle.pool && Object.keys(fromBundle.pool).length > 0)
        ? fromBundle.pool
        : FALLBACK_REGION_ITEM_POOL;
    const weights = (fromBundle && fromBundle.weights && typeof fromBundle.weights === 'object')
        ? fromBundle.weights
        : FALLBACK_REGION_POOL_WEIGHTS;

    return { regions, pool, weights };
}

// 이름을 유지해 외부 호환성 (module.exports 경로용)
const DROP_TABLE = FALLBACK_DROP_TABLE;
const REGION_ITEM_POOL = FALLBACK_REGION_ITEM_POOL;

// 가중치 추첨 유틸 — weights가 items와 길이가 다르거나 합이 0이면 균등 추첨 폴백.
function weightedPick(items, weights) {
    if (!Array.isArray(items) || items.length === 0) return null;
    if (!Array.isArray(weights) || weights.length !== items.length) {
        return items[Math.floor(Math.random() * items.length)];
    }
    let total = 0;
    for (const w of weights) total += Math.max(0, Number(w) || 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= Math.max(0, Number(weights[i]) || 0);
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

// 뒤져보기 1회 결과 추첨
// opts.forceCategory: 'env'|'food' — 카테고리 1차 추첨을 건너뛰고 해당 풀에서 직접 추첨.
//   '음식 찾기' 같은 카드는 이 옵션으로 배선된다. 지역에 food 풀이 비어있으면 none 폴백.
// 반환: { item: string|null, category: 'env'|'food'|'none' }
function rollTileDrop(region, opts) {
    const { regions, pool, weights } = resolveDropSource();
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

    // D-33: 가중치 있으면 적용, 없으면 균등 추첨.
    const w = weights && weights[region] && weights[region][category];
    const item = weightedPick(items, w);
    if (!item) return { item: null, category: 'none' };
    return { item, category };
}

// 사람이 읽는 결과 라벨 (메시지용)
function describeDropCategory(category) {
    return category === 'env' ? '환경재료'
         : category === 'food' ? '음식재료'
         : '없음';
}

// 뒤져보기 슬롯 확률 — 유저에게 비공개. 내부 SSOT.
// 시트 승격 시 window.TTD_DATA.SEARCH_SLOTS(배열)에서 읽어오고, 없으면 폴백.
// D-30(요한): 2~3번 슬롯 100→20%로 확률 하향 ("2개씩 나오는게 너무 잦다").
const FALLBACK_SEARCH_SLOTS = [100, 20, 20];

// D-34: 타일 속성별 슬롯 확률 오버라이드. tile.type === 'good'이면 여기 값을 사용.
// 요한 지시(2026-04-22): "좋은칸"은 슬롯2/3을 80%로 — 기본보다 훨씬 풍족.
const FALLBACK_TILE_TYPE_SLOTS = {
    good: [100, 80, 80]
};

// 배열 새니타이즈 — 각 원소를 0~100 정수로 clamp.
function sanitizeSlotArray(arr) {
    return arr.map(v => Math.max(0, Math.min(100, Number(v) || 0)));
}

// tile(또는 null)을 받아 기본 슬롯 확률 배열 반환.
// 1순위: TTD_DATA.TILE_TYPE_SLOTS[tile.type]
// 2순위: FALLBACK_TILE_TYPE_SLOTS[tile.type]
// 3순위: TTD_DATA.SEARCH_SLOTS
// 4순위: FALLBACK_SEARCH_SLOTS
function resolveSearchSlots(tile) {
    const ttd = (typeof window !== 'undefined' && window.TTD_DATA) || null;

    if (tile && tile.type) {
        const typeSlotsBundle = ttd && ttd.TILE_TYPE_SLOTS;
        if (typeSlotsBundle && Array.isArray(typeSlotsBundle[tile.type]) && typeSlotsBundle[tile.type].length > 0) {
            return sanitizeSlotArray(typeSlotsBundle[tile.type]);
        }
        if (Array.isArray(FALLBACK_TILE_TYPE_SLOTS[tile.type]) && FALLBACK_TILE_TYPE_SLOTS[tile.type].length > 0) {
            return sanitizeSlotArray(FALLBACK_TILE_TYPE_SLOTS[tile.type]);
        }
    }

    const fromBundle = ttd && ttd.SEARCH_SLOTS;
    if (Array.isArray(fromBundle) && fromBundle.length > 0) {
        return sanitizeSlotArray(fromBundle);
    }
    return FALLBACK_SEARCH_SLOTS.slice();
}

// D-35: 반복 뒤져보기 페널티 곱수 계산.
// mult = (hasBeenLeft ? 0.5 : 1.0) * 0.5 ^ searchedCount.
// 반환은 0~1 범위. 슬롯 확률에 곱해 0~100에 clamp.
function computeSearchMultiplier(tile) {
    if (!tile) return 1;
    const searched = Math.max(0, Number(tile.searchedCount) || 0);
    let mult = 1;
    if (tile.hasBeenLeft) mult *= 0.5;
    mult *= Math.pow(0.5, searched);
    return mult;
}

// 뒤져보기 1회 = 슬롯 배열만큼 독립 추첨.
// 각 슬롯마다 게이트 확률을 굴려 통과 시 rollTileDrop 실행.
// 반환: [{ item, category }, ...] — item이 null인 슬롯은 제외(= 드롭 없음).
// opts는 rollTileDrop과 동일하게 forceCategory 등을 허용.
// tile: 타일 객체(없으면 기본 확률) — type/searchedCount/hasBeenLeft를 읽는다.
function rollSearchLoot(region, tile, opts) {
    const slots = resolveSearchSlots(tile);
    const mult = computeSearchMultiplier(tile);
    const results = [];
    for (let i = 0; i < slots.length; i++) {
        const gate = Math.max(0, Math.min(100, slots[i] * mult));
        if (Math.random() * 100 >= gate) continue;
        const drop = rollTileDrop(region, opts);
        if (drop && drop.item) results.push(drop);
    }
    return results;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        rollTileDrop,
        rollSearchLoot,
        DROP_TABLE,
        REGION_ITEM_POOL,
        describeDropCategory,
        resolveDropSource,
        resolveSearchSlots,
        computeSearchMultiplier,
        weightedPick
    };
}
