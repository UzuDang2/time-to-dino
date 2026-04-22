// effectParser.js — 아이템 '사용 효과' DSL 파서 & 디스패처
//
// SSOT는 Notion "🎒 아이템" DB의 '사용 효과' rich_text 필드.
// 포맷: '<action>:<params>' 를 세미콜론(;)으로 체인 가능.
//   hunger+1           → { type:'stat', stat:'hunger', delta: 1 }
//   hunger-1           → { type:'stat', stat:'hunger', delta:-1 }
//   health+1           → { type:'stat', stat:'health', delta: 1 }
//   spawn_card:throw   → { type:'spawn_card', cardId:'throw' }
//
// 디자인 의도:
//   - 효과가 늘어날 때마다 Notion select를 수정하지 않아도 되게 문자열+파서.
//   - 런타임은 parseItemEffect(...)의 반환을 dispatch만 하면 됨.
//   - 파싱 실패/빈 문자열은 '사용 불가'로 취급하고 UI에서 버튼 비활성화.

(function (root) {
    'use strict';

    // 스탯 clamp 상한 (게임 상수와 동기화 필요)
    const STAT_BOUNDS = {
        hunger: { min: 0, max: 12 },
        health: { min: 0, max: 6 }
    };

    // 단일 액션 파싱
    // 반환: action 객체 or null
    function parseSingleAction(token) {
        const raw = String(token || '').trim();
        if (!raw) return null;

        // spawn_card:<id>
        const spawnMatch = raw.match(/^spawn_card\s*:\s*([A-Za-z0-9_\-]+)$/);
        if (spawnMatch) {
            return { type: 'spawn_card', cardId: spawnMatch[1] };
        }

        // <stat><+|-><number>
        const statMatch = raw.match(/^([a-z_]+)\s*([+\-])\s*(\d+)$/i);
        if (statMatch) {
            const stat = statMatch[1].toLowerCase();
            const sign = statMatch[2] === '-' ? -1 : 1;
            const n = parseInt(statMatch[3], 10);
            if (!Number.isFinite(n)) return null;
            return { type: 'stat', stat, delta: sign * n };
        }

        return null;
    }

    // 파싱 진입점: 원본 문자열 → action 배열
    // 미정/실패 action은 건너뛰고, 하나도 없으면 usable=false.
    function parseItemEffect(raw) {
        const s = String(raw || '').trim();
        if (!s) return { usable: false, actions: [], raw: s };

        // "미정" / "효과 없음" 등 휴먼 가드
        const UNSET_TOKENS = ['미정', '효과 없음', '효과없음', 'tbd', 'TBD', '-'];
        if (UNSET_TOKENS.includes(s)) return { usable: false, actions: [], raw: s };

        const tokens = s.split(';').map(t => t.trim()).filter(Boolean);
        const actions = [];
        for (const tok of tokens) {
            const a = parseSingleAction(tok);
            if (a) actions.push(a);
        }
        return { usable: actions.length > 0, actions, raw: s };
    }

    // ─── 효과 스케일링 ────────────────────────────────────────────────
    //
    // "카드로 아이템 사용" 프레임워크(D-23)의 일부. 카드가 아이템의 효과를 변형해서
    // 적용해야 할 때(예: 휴식 카드가 음식의 회복 효과를 2배로) 쓰는 순수 함수.
    //
    // 입력: 파싱된 effect({usable, actions, raw}) + scales({recover: N})
    // 출력: 원본을 건드리지 않은 새 effect 객체. action 단위로 스케일 규칙을 적용.
    //
    // 현재 지원하는 스케일 키:
    //   - recover: 양수 delta의 stat action(배고픔·생명력 회복)에만 곱해 delta를 늘림.
    //              음수 delta(감소)는 건드리지 않는다 (회복 액션만 증폭하는 의미).
    //   - 향후 확장: damage, detection 등 action 타입이 늘어나면 여기에 분기 추가.
    //
    // 범위 외 action(spawn_card 등)은 그대로 패스스루.
    function scaleEffect(parsed, scales) {
        if (!parsed || !parsed.actions) return parsed;
        const factorRecover = (scales && typeof scales.recover === 'number') ? scales.recover : 1;
        const scaledActions = parsed.actions.map(a => {
            if (a.type === 'stat' && a.delta > 0 && factorRecover !== 1) {
                return { ...a, delta: a.delta * factorRecover };
            }
            return a;
        });
        return {
            usable: parsed.usable,
            actions: scaledActions,
            raw: parsed.raw
        };
    }

    // ─── 카드 consume DSL 파싱 ───────────────────────────────────────
    //
    // "카드로 아이템 사용" 프레임워크(D-23): 카드 스펙의 consume 필드를 구조화.
    // 포맷(세미콜론 체인):
    //   'category:음식'              → 필터: 아이템의 '카테고리'가 '음식'
    //   'material_type:음식재료'     → 필터: '재료 타입'이 '음식재료'
    //   'id:stone'                  → 필터: 인벤토리 아이템 type === 'stone'
    //   'scale:recover=2'           → 스케일: 회복 delta x2
    //
    // 여러 필터가 함께 있으면 AND 조건. scale은 복수 가능.
    // 파싱 실패 토큰은 조용히 무시(런타임 가드).
    function parseCardConsume(raw) {
        const s = String(raw || '').trim();
        if (!s) return null;

        const filters = {};
        const scales = {};
        const tokens = s.split(';').map(t => t.trim()).filter(Boolean);
        for (const tok of tokens) {
            // scale:key=value
            const scaleMatch = tok.match(/^scale\s*:\s*([a-z_]+)\s*=\s*(-?\d+(?:\.\d+)?)$/i);
            if (scaleMatch) {
                const key = scaleMatch[1].toLowerCase();
                const val = parseFloat(scaleMatch[2]);
                if (Number.isFinite(val)) scales[key] = val;
                continue;
            }
            // filterKey:value  (카테고리/material_type/id 등)
            const filterMatch = tok.match(/^([a-z_가-힣]+)\s*:\s*(.+)$/i);
            if (filterMatch) {
                const key = filterMatch[1].trim().toLowerCase();
                const val = filterMatch[2].trim();
                filters[key] = val;
                continue;
            }
        }

        if (Object.keys(filters).length === 0 && Object.keys(scales).length === 0) {
            return null;
        }
        return { filters, scales, raw: s };
    }

    // 필터 매칭: 인벤 아이템 1개가 consume.filters를 모두 만족하는가?
    // 아이템 메타는 두 소스에서 조회:
    //   - inventoryItem.type  (InventorySystem.ITEMS 키, 예: 'mushroom')
    //   - notionItem          (window.TTD_DATA.ITEMS에서 name으로 매칭된 것)
    // 둘 다 있어야 더 많은 필터를 확인 가능.
    function matchesConsumeFilter(consume, inventoryItem, notionItem) {
        if (!consume || !consume.filters) return true;
        const f = consume.filters;
        // id 필터 — inventoryItem.type 기준
        if (f.id && inventoryItem && inventoryItem.type !== f.id) return false;
        // category/material_type — notionItem 기준
        if (f.category || f['카테고리']) {
            const want = f.category || f['카테고리'];
            const got = notionItem && notionItem['카테고리'];
            if (got !== want) return false;
        }
        if (f.material_type || f['재료_타입'] || f['재료 타입']) {
            const want = f.material_type || f['재료_타입'] || f['재료 타입'];
            const got = notionItem && notionItem['재료 타입'];
            if (got !== want) return false;
        }
        return true;
    }

    // 사람이 읽는 효과 설명 (UI '성능' 필드)
    function describeEffect(parsed) {
        if (!parsed || !parsed.usable) {
            // 원본이 있으면 원본 노출 (미정/tbd 등을 그대로 보여 기획자에게 피드백)
            return parsed && parsed.raw ? parsed.raw : '효과 없음';
        }
        return parsed.actions.map(a => {
            if (a.type === 'stat') {
                const label = a.stat === 'hunger' ? '배고픔'
                            : a.stat === 'health' ? '생명력'
                            : a.stat;
                const sign = a.delta >= 0 ? '+' : '';
                return `${label} ${sign}${a.delta}`;
            }
            if (a.type === 'spawn_card') {
                return `전투 카드 추가: ${a.cardId}`;
            }
            return '';
        }).filter(Boolean).join(' / ');
    }

    // 런타임 디스패처
    // ctx: {
    //   getStat: (name) => number,
    //   setStat: (name, value) => void,
    //   addThrowCard: (cardId) => void,  // 전투 임시 덱에 1장 추가
    //   setMessage: (text) => void
    // }
    // 반환: { ok: boolean, consumed: boolean, reason?: string }
    function applyItemEffect(parsed, ctx) {
        if (!parsed || !parsed.usable) {
            return { ok: false, consumed: false, reason: '사용할 수 없는 아이템' };
        }
        for (const a of parsed.actions) {
            if (a.type === 'stat') {
                const cur = typeof ctx.getStat === 'function' ? ctx.getStat(a.stat) : null;
                if (cur == null) continue;
                const bound = STAT_BOUNDS[a.stat] || { min: -Infinity, max: Infinity };
                const next = Math.max(bound.min, Math.min(bound.max, cur + a.delta));
                if (typeof ctx.setStat === 'function') ctx.setStat(a.stat, next);
            } else if (a.type === 'spawn_card') {
                if (typeof ctx.addThrowCard === 'function') ctx.addThrowCard(a.cardId);
            }
        }
        return { ok: true, consumed: true };
    }

    const api = {
        parseItemEffect,
        applyItemEffect,
        describeEffect,
        STAT_BOUNDS,
        // D-23 프레임워크: 카드로 아이템 사용 공통 헬퍼
        scaleEffect,
        parseCardConsume,
        matchesConsumeFilter
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.EffectParser = api;
    }
})(typeof window !== 'undefined' ? window : this);
