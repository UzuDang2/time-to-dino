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

    const api = { parseItemEffect, applyItemEffect, describeEffect, STAT_BOUNDS };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.EffectParser = api;
    }
})(typeof window !== 'undefined' ? window : this);
