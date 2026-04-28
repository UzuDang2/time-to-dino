// statusEffects.js — D-126 (2026-04-28) 상태이상 시스템
//
// ☆3 결정: hallucination / poison / poison_bite 3종 fix. injured/fear/accelerated는 도입 안 함.
// SSOT는 시트 '상태이상' 탭 → window.TTD_DATA.STATUS_EFFECTS 배열.
//
// 데이터 모델:
//   - 플레이어 상태이상: [{ id, remainingTurns }]
//     · 같은 id 재부여 시 remainingTurns를 max(현재, 신규)로 갱신 (스택 X, 새로고침 O)
//     · 매 이동 후 tick — remainingTurns -= 1, tick_effect DSL 실행, 0 이하면 제거
//   - 아이템 인스턴스 상태이상 (poison_bite):
//     · inventory item에 statusTags: [statusId] 부착. 사용 시 onConsume 훅에서 health-1.
//     · 인스턴스 단위로 1개에만 붙임 — chance_grant_status_on_item DSL이 부여.
//
// 모듈 API (window.StatusEffects 또는 EffectParser와 분리된 namespace):
//   getCatalog(id)             → { id, name, duration, tick_effect, summary, description } | null
//   describeBadge(state)       → { id, name, remaining, summary } UI용 요약
//   apply(list, statusId, dur) → 새 list 반환 (immutable)
//   tick(list, ctx)            → { list, lines } — 1회 tick 적용 후 새 list + 텍스트 라인
//   has(list, id)              → bool
//   describePool(list)         → 텍스트 (HUD/메시지용)
//   onItemConsumed(item, ctx)  → poison_bite 등 인스턴스 효과 처리. 호출자(inventory.js)가 사용 시 1회 호출.

(function (root) {
    'use strict';

    function _catalog() {
        const arr = (root && root.TTD_DATA && Array.isArray(root.TTD_DATA.STATUS_EFFECTS))
            ? root.TTD_DATA.STATUS_EFFECTS
            : [];
        return arr;
    }

    function getCatalog(id) {
        const found = _catalog().find(s => s.id === id);
        return found || null;
    }

    function apply(list, statusId, duration) {
        const cat = getCatalog(statusId);
        if (!cat) {
            console.warn('[statusEffects] 미지의 상태이상 — 무시:', statusId);
            return Array.isArray(list) ? list.slice() : [];
        }
        // poison_bite는 플레이어 상태가 아닌 아이템 인스턴스 태그. apply()에선 무시.
        if (cat.id === 'poison_bite') return Array.isArray(list) ? list.slice() : [];

        const dur = Number.isFinite(duration) ? duration : (cat.duration || 0);
        const next = Array.isArray(list) ? list.slice() : [];
        const idx = next.findIndex(s => s.id === statusId);
        if (idx >= 0) {
            next[idx] = { ...next[idx], remainingTurns: Math.max(next[idx].remainingTurns || 0, dur) };
        } else {
            next.push({ id: statusId, remainingTurns: dur });
        }
        return next;
    }

    function has(list, id) {
        if (!Array.isArray(list)) return false;
        return list.some(s => s.id === id && (s.remainingTurns == null || s.remainingTurns > 0));
    }

    // tick(list, ctx):
    //   - 각 상태의 tick_effect를 실행 (chance_stat 등) — EffectParser 재사용.
    //   - remainingTurns -= 1. 0 이하면 expire 라인 추가 후 제거.
    function tick(list, ctx) {
        if (!Array.isArray(list) || list.length === 0) return { list: [], lines: [] };
        const lines = [];
        const next = [];
        for (const s of list) {
            const cat = getCatalog(s.id);
            if (!cat) continue;
            // tick_effect 실행 (DSL)
            if (cat.tick_effect && root.EffectParser && root.EffectParser.parseEventEffect) {
                const parsed = root.EffectParser.parseEventEffect(cat.tick_effect);
                root.EffectParser.applyEventEffect(parsed, ctx).forEach(l => lines.push(l));
            }
            const remaining = (s.remainingTurns || 0) - 1;
            if (remaining > 0) {
                next.push({ ...s, remainingTurns: remaining });
            } else {
                lines.push(`${cat.name} 상태가 가셨다.`);
            }
        }
        return { list: next, lines };
    }

    function describeBadge(s) {
        const cat = getCatalog(s.id);
        if (!cat) return null;
        return {
            id: s.id,
            name: cat.name,
            remaining: s.remainingTurns || 0,
            summary: cat.summary || ''
        };
    }

    function describePool(list) {
        if (!Array.isArray(list) || list.length === 0) return '';
        return list.map(s => {
            const cat = getCatalog(s.id);
            if (!cat) return null;
            return `${cat.name}(${s.remainingTurns || 0}턴)`;
        }).filter(Boolean).join(', ');
    }

    // 아이템 인스턴스 단위 상태(poison_bite) 처리. inventory.js의 사용 흐름에서 호출.
    // item.statusTags 배열에 'poison_bite'가 있으면 health-1 1회 적용 후 태그 제거 의도이지만,
    // 어차피 일회용 음식이라 인벤에서 빠지므로 호출자가 별도 정리 안 해도 OK.
    function onItemConsumed(item, ctx) {
        if (!item || !Array.isArray(item.statusTags)) return;
        if (item.statusTags.includes('poison_bite')) {
            if (ctx && typeof ctx.applyStat === 'function') {
                ctx.applyStat('health', -1);
            }
            if (ctx && typeof ctx.addLogLine === 'function') {
                ctx.addLogLine('한 입 무는 순간 속이 뒤집힌다. 체력 -1.');
            }
        }
    }

    const api = { getCatalog, apply, tick, has, describeBadge, describePool, onItemConsumed };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.StatusEffects = api;
})(typeof window !== 'undefined' ? window : this);
