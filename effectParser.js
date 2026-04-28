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
        health: { min: 0, max: 8 }
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

        // D-156: 아이템 사용 액션 확장.
        //   hint:<kind>      — torn_map 등. ctx.showHint 호출.
        //   place_snare      — snare_trap 설치. ctx.placeSnare 호출.
        //   shield_trap      — 패시브 마커(소지만으로 동작). 능동 사용은 no-op.
        const hintMatch = raw.match(/^hint\s*:\s*([A-Za-z_]+)$/);
        if (hintMatch) {
            return { type: 'hint', kind: hintMatch[1] };
        }
        if (raw === 'place_snare') {
            return { type: 'place_snare' };
        }
        if (raw === 'shield_trap') {
            return { type: 'shield_trap' };
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
    // D-156: 'shield_trap'처럼 패시브-only 액션만 있는 경우 usable=false (사용 버튼 비활성).
    //   소지만으로 동작하므로 능동 사용 자체가 의미 없음.
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
        const PASSIVE_ONLY = new Set(['shield_trap']);
        const hasActive = actions.some(a => !PASSIVE_ONLY.has(a.type));
        return { usable: actions.length > 0 && hasActive, actions, raw: s };
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
    // D-49 (2026-04-24): bonuses(덧셈) 지원 추가.
    //   - recover: 양수 delta stat action에 상수로 더함(곱과 구별). 휴식 카드가
    //     'scale:recover=2'(음식 효과 × 2)에서 'bonus:recover=1'(+1 고정 보너스)로 전환.
    //   - 적용 순서: scale 먼저 적용 → bonus 합산. (음식 1→× scale → + bonus)
    //
    // 범위 외 action(spawn_card 등)은 그대로 패스스루.
    function scaleEffect(parsed, scales, bonuses) {
        if (!parsed || !parsed.actions) return parsed;
        const factorRecover = (scales && typeof scales.recover === 'number') ? scales.recover : 1;
        const bonusRecover = (bonuses && typeof bonuses.recover === 'number') ? bonuses.recover : 0;
        const scaledActions = parsed.actions.map(a => {
            if (a.type === 'stat' && a.delta > 0) {
                let delta = a.delta;
                if (factorRecover !== 1) delta = delta * factorRecover;
                if (bonusRecover !== 0) delta = delta + bonusRecover;
                if (delta !== a.delta) return { ...a, delta };
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
    //   'scale:recover=2'           → 스케일(곱): 회복 delta × 2
    //   'bonus:recover=1'           → 보너스(합): 회복 delta + 1  (D-49)
    //
    // 여러 필터가 함께 있으면 AND 조건. scale·bonus는 각각 복수 가능.
    // 파싱 실패 토큰은 조용히 무시(런타임 가드).
    function parseCardConsume(raw) {
        const s = String(raw || '').trim();
        if (!s) return null;

        const filters = {};
        const scales = {};
        const bonuses = {};
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
            // bonus:key=value  (D-49: 상수 보너스)
            const bonusMatch = tok.match(/^bonus\s*:\s*([a-z_]+)\s*=\s*(-?\d+(?:\.\d+)?)$/i);
            if (bonusMatch) {
                const key = bonusMatch[1].toLowerCase();
                const val = parseFloat(bonusMatch[2]);
                if (Number.isFinite(val)) bonuses[key] = val;
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

        if (Object.keys(filters).length === 0 && Object.keys(scales).length === 0 && Object.keys(bonuses).length === 0) {
            return null;
        }
        return { filters, scales, bonuses, raw: s };
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
        // D-156: usable=false이지만 패시브 액션(shield_trap 등)이 있는 경우 한국어 라벨로 노출.
        if (parsed && !parsed.usable && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
            const labels = parsed.actions.map(a => {
                if (a.type === 'shield_trap') return '소지 중에 함정을 한 번 막아낸다';
                return '';
            }).filter(Boolean);
            if (labels.length > 0) return labels.join(' / ');
        }
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
            if (a.type === 'hint') {
                const KIND_LABEL = {
                    exit_direction: '탈출구 방향',
                    boss_direction: '보스 방향',
                    boss_position: '보스 위치',
                    tile_reveal: '근처 한 칸 공개',
                    nearby_tile_reveal: '인접 한 칸 공개'
                };
                return KIND_LABEL[a.kind] ? `${KIND_LABEL[a.kind]} 1회 표시` : '단서 표시';
            }
            if (a.type === 'place_snare') return '현재 타일에 덫 설치';
            if (a.type === 'shield_trap') return '소지 시 함정 1회 자동 차단';
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
            } else if (a.type === 'hint') {
                // D-156: 아이템에서 발동되는 힌트(예: torn_map). showHint 콜백이 실제 방향 텍스트 출력.
                if (typeof ctx.showHint === 'function') ctx.showHint(a.kind);
            } else if (a.type === 'place_snare') {
                // D-157: 현재 타일에 덫 설치. ctx.placeSnare가 실제 tile.placedTrap 갱신.
                if (typeof ctx.placeSnare === 'function') ctx.placeSnare();
            } else if (a.type === 'shield_trap') {
                // 패시브 — 사용 시점에는 동작 없음. 함정 진입 시 인벤 자동 검사.
            }
        }
        return { ok: true, consumed: true };
    }

    // ─── D-126 (2026-04-28) 이벤트 효과 DSL 파서 ────────────────────────
    //
    // 아이템 effect와 별개의 더 풍부한 DSL. SSOT는 시트 '이벤트선택지' 탭의
    // effect_dsl 컬럼. 기존 parseItemEffect와 namespace를 분리해 회귀를 막는다.
    //
    // 토큰 (세미콜론 ; 으로 체인):
    //   item_grant:<id>*<n>                   — 아이템 N개 획득
    //   item_grant_pool:<pool_id>*<n>         — 풀에서 N개 추첨 (events.json::pool 참조)
    //   item_consume_filter:<filter>*<n>      — 카테고리/재료타입에 맞는 인벤 1개 소모
    //                                           (filter 자리에 '음식'·'재료' 등 카테고리)
    //   stat_delta:<stat><sign><amt>          — health/hunger 변화
    //   detection_delta:<sign><amt>           — 발각 % 변화
    //   status_apply:<id>[*<dur>]             — 상태이상 부여 (dur 생략 시 카탈로그 기본값)
    //   hint:<kind>                           — exit_direction / boss_direction / ...
    //   force_random_move                     — 1초 페이드 후 랜덤 인접 이동
    //   nothing                               — 명시적 no-op
    //   chance_grant:<pct>,<id>*<n>           — pct% 확률로 아이템 N개
    //   chance_grant_status_on_item:<pct>,<status>,<item_id>
    //                                          — 채집 결과 N개 중 1개에 상태이상 부여
    //   chance_stat:<pct>,<stat><sign><amt>
    //   chance_status:<pct>,<status>[*<dur>]
    //   chance_hint:<pct>,<kind>
    //   branches:<pct>|<dsl>||<pct>|<dsl>...  — 확률 분기 (pct 합 100 권장)
    //
    // 파서는 알 수 없는 토큰을 console.warn으로 기록하고 무시한다 (silent fail 금지).
    function parseEventEffect(raw) {
        const s = String(raw || '').trim();
        if (!s) return { actions: [], raw: s };
        const tokens = s.split(';').map(t => t.trim()).filter(Boolean);
        const actions = [];
        for (const tok of tokens) {
            const a = parseEventToken(tok);
            if (a) actions.push(a);
            else console.warn('[eventDSL] 미지의 토큰 — 무시:', tok);
        }
        return { actions, raw: s };
    }

    function parseEventToken(tok) {
        // branches:<pct>|<dsl>||<pct>|<dsl>
        const branchMatch = tok.match(/^branches\s*:\s*(.+)$/);
        if (branchMatch) {
            const segs = branchMatch[1].split('||');
            const branches = [];
            for (const seg of segs) {
                const idx = seg.indexOf('|');
                if (idx < 0) continue;
                const pct = parseInt(seg.slice(0, idx).trim(), 10);
                const dsl = seg.slice(idx + 1).trim();
                if (!Number.isFinite(pct)) continue;
                branches.push({ pct, dsl });
            }
            if (branches.length > 0) return { type: 'branches', branches };
        }

        // nothing
        if (tok === 'nothing') return { type: 'nothing' };

        // force_random_move
        if (tok === 'force_random_move') return { type: 'force_random_move' };

        // item_grant:<id>*<n>
        let m = tok.match(/^item_grant\s*:\s*([A-Za-z0-9_]+)\s*\*\s*(\d+)$/);
        if (m) return { type: 'item_grant', itemId: m[1], count: parseInt(m[2], 10) };

        // item_grant_pool:<pool_id>*<n>
        m = tok.match(/^item_grant_pool\s*:\s*([A-Za-z0-9_]+)\s*\*\s*(\d+)$/);
        if (m) return { type: 'item_grant_pool', poolId: m[1], count: parseInt(m[2], 10) };

        // item_consume_filter:<filter>*<n>
        m = tok.match(/^item_consume_filter\s*:\s*([^*]+)\s*\*\s*(\d+)$/);
        if (m) return { type: 'item_consume_filter', filter: m[1].trim(), count: parseInt(m[2], 10) };

        // stat_delta:<stat><sign><amt>
        m = tok.match(/^stat_delta\s*:\s*([a-z_]+)\s*([+\-])\s*(\d+)$/i);
        if (m) {
            const sign = m[2] === '-' ? -1 : 1;
            return { type: 'stat_delta', stat: m[1].toLowerCase(), delta: sign * parseInt(m[3], 10) };
        }

        // detection_delta:<sign><amt>
        m = tok.match(/^detection_delta\s*:\s*([+\-])\s*(\d+)$/);
        if (m) {
            const sign = m[1] === '-' ? -1 : 1;
            return { type: 'detection_delta', delta: sign * parseInt(m[2], 10) };
        }

        // status_apply:<id>[*<dur>]
        m = tok.match(/^status_apply\s*:\s*([A-Za-z0-9_]+)(?:\s*\*\s*(\d+))?$/);
        if (m) {
            const out = { type: 'status_apply', statusId: m[1] };
            if (m[2]) out.duration = parseInt(m[2], 10);
            return out;
        }

        // hint:<kind>
        m = tok.match(/^hint\s*:\s*([A-Za-z_]+)$/);
        if (m) return { type: 'hint', kind: m[1] };

        // chance_grant:<pct>,<id>*<n>
        m = tok.match(/^chance_grant\s*:\s*(\d+)\s*,\s*([A-Za-z0-9_]+)\s*\*\s*(\d+)$/);
        if (m) return { type: 'chance_grant', pct: parseInt(m[1], 10), itemId: m[2], count: parseInt(m[3], 10) };

        // chance_grant_status_on_item:<pct>,<status>,<item_id>
        m = tok.match(/^chance_grant_status_on_item\s*:\s*(\d+)\s*,\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)$/);
        if (m) return { type: 'chance_grant_status_on_item', pct: parseInt(m[1], 10), statusId: m[2], itemId: m[3] };

        // chance_stat:<pct>,<stat><sign><amt>
        m = tok.match(/^chance_stat\s*:\s*(\d+)\s*,\s*([a-z_]+)\s*([+\-])\s*(\d+)$/i);
        if (m) {
            const sign = m[3] === '-' ? -1 : 1;
            return { type: 'chance_stat', pct: parseInt(m[1], 10), stat: m[2].toLowerCase(), delta: sign * parseInt(m[4], 10) };
        }

        // chance_status:<pct>,<status>[*<dur>]
        m = tok.match(/^chance_status\s*:\s*(\d+)\s*,\s*([A-Za-z0-9_]+)(?:\s*\*\s*(\d+))?$/);
        if (m) {
            const out = { type: 'chance_status', pct: parseInt(m[1], 10), statusId: m[2] };
            if (m[3]) out.duration = parseInt(m[3], 10);
            return out;
        }

        // chance_hint:<pct>,<kind>
        m = tok.match(/^chance_hint\s*:\s*(\d+)\s*,\s*([A-Za-z_]+)$/);
        if (m) return { type: 'chance_hint', pct: parseInt(m[1], 10), kind: m[2] };

        return null;
    }

    // 이벤트 효과 적용기.
    // ctx: {
    //   grantItem(itemId, count) -> ok bool        // 인벤에 추가 (가득 차면 false)
    //   grantItemTagged(itemId, count, tags)       // tags = { statusEffects: ['poison_bite'] }
    //   consumeItemByFilter(filter, count) -> ok   // 카테고리/타입 매칭 인벤 소모
    //   applyStat(stat, delta) -> void             // health/hunger
    //   applyDetection(delta) -> void              // % 단위
    //   applyStatus(statusId, duration?) -> void   // 상태이상 부여
    //   showHint(kind) -> void                     // 'exit_direction' 등
    //   forceRandomMove() -> Promise|void          // 1초 페이드 후 인접 랜덤 이동
    //   poolPick(poolId, count) -> [{id, count}]   // 비복원 풀 추첨 (events.pool에서 카운트만큼 뽑기)
    //   addLogLine(text) -> void                   // 1인칭 텍스트 로그
    // }
    // 반환: 적용된 액션 요약 (텍스트 라인 배열)
    function applyEventEffect(parsed, ctx) {
        const lines = [];
        if (!parsed || !parsed.actions) return lines;

        for (const a of parsed.actions) {
            applySingle(a, ctx, lines);
        }
        return lines;
    }

    function applySingle(a, ctx, lines) {
        switch (a.type) {
            case 'nothing':
                // no-op. 이벤트 본문에 따라 한 줄 안 찍어도 됨.
                return;
            case 'item_grant': {
                const ok = ctx.grantItem ? ctx.grantItem(a.itemId, a.count) : false;
                if (ok && ctx.itemNameOf) lines.push(`${ctx.itemNameOf(a.itemId)}을(를) ${a.count}개 챙겼다.`);
                else if (!ok) lines.push('가방이 가득 차서 챙기지 못했다.');
                return;
            }
            case 'item_grant_pool': {
                if (!ctx.poolPick) return;
                const picks = ctx.poolPick(a.poolId, a.count) || [];
                for (const p of picks) {
                    const ok = ctx.grantItem ? ctx.grantItem(p.id, p.count || 1) : false;
                    if (ok && ctx.itemNameOf) lines.push(`${ctx.itemNameOf(p.id)}을(를) ${p.count || 1}개 챙겼다.`);
                    else if (!ok) lines.push('가방이 가득 차서 챙기지 못했다.');
                }
                return;
            }
            case 'item_consume_filter': {
                if (ctx.consumeItemByFilter) ctx.consumeItemByFilter(a.filter, a.count);
                return;
            }
            case 'stat_delta': {
                if (ctx.applyStat) ctx.applyStat(a.stat, a.delta);
                return;
            }
            case 'detection_delta': {
                if (ctx.applyDetection) ctx.applyDetection(a.delta);
                return;
            }
            case 'status_apply': {
                if (ctx.applyStatus) ctx.applyStatus(a.statusId, a.duration);
                return;
            }
            case 'hint': {
                if (ctx.showHint) ctx.showHint(a.kind);
                return;
            }
            case 'force_random_move': {
                if (ctx.forceRandomMove) ctx.forceRandomMove();
                return;
            }
            case 'chance_grant': {
                if (Math.random() * 100 < a.pct) {
                    applySingle({ type: 'item_grant', itemId: a.itemId, count: a.count }, ctx, lines);
                }
                return;
            }
            case 'chance_grant_status_on_item': {
                // 채집 결과 1개에 상태이상 부여 — 직전 grantItem 결과를 직접 추적하지 않고,
                // ctx.tagLastGrantedItem이 있으면 호출. 없으면 폴백으로 grantItemTagged.
                if (Math.random() * 100 < a.pct) {
                    if (ctx.tagLastGrantedItem) ctx.tagLastGrantedItem(a.itemId, a.statusId);
                    else if (ctx.grantItemTagged) ctx.grantItemTagged(a.itemId, 1, { statusEffects: [a.statusId] });
                }
                return;
            }
            case 'chance_stat': {
                if (Math.random() * 100 < a.pct) {
                    applySingle({ type: 'stat_delta', stat: a.stat, delta: a.delta }, ctx, lines);
                }
                return;
            }
            case 'chance_status': {
                if (Math.random() * 100 < a.pct) {
                    applySingle({ type: 'status_apply', statusId: a.statusId, duration: a.duration }, ctx, lines);
                }
                return;
            }
            case 'chance_hint': {
                if (Math.random() * 100 < a.pct) {
                    applySingle({ type: 'hint', kind: a.kind }, ctx, lines);
                }
                return;
            }
            case 'branches': {
                // pct 합 기준 가중 랜덤. 합이 0이면 첫 번째 강제 적용.
                const total = a.branches.reduce((s, b) => s + b.pct, 0);
                if (total <= 0) {
                    if (a.branches[0]) applyEventEffect(parseEventEffect(a.branches[0].dsl), ctx).forEach(l => lines.push(l));
                    return;
                }
                let r = Math.random() * total;
                for (const b of a.branches) {
                    r -= b.pct;
                    if (r <= 0) {
                        applyEventEffect(parseEventEffect(b.dsl), ctx).forEach(l => lines.push(l));
                        return;
                    }
                }
                return;
            }
            default:
                console.warn('[eventDSL] 알 수 없는 액션 type — 무시:', a);
        }
    }

    // ─── D-158 (2026-04-28) 이벤트 선택지 요약 ─────────────────────────
    //
    // 이벤트 모달의 선택지 버튼 아래에 노출할 "정보형 라벨"을 만든다.
    // 디자인 원칙:
    //   - 확정 비용/효과는 명확히 노출 (예: '음식 -1', '발각 +15%', '체력 -1').
    //   - 불확정 결과(branches/chance_*)는 수치 노출 X, '결과는 모름' 모호 마커만.
    //     게임 긴장감 유지(보스/이벤트의 의외성).
    //   - 상태이상 한글명은 window.StatusEffects.getCatalog 의존. 미주입 시 id 그대로.
    //
    // 반환:
    //   {
    //     labels: string[],            // 확정 라벨 (한 줄씩)
    //     uncertain: boolean,          // 불확정 액션이 하나라도 있으면 true
    //     itemConsume: [{filter, count}],  // 자원 부족 체크용
    //   }
    function summarizeEventEffects(parsed) {
        const out = { labels: [], uncertain: false, itemConsume: [] };
        if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) return out;

        const STAT_LABEL = { hunger: '배고픔', health: '체력' };
        const HINT_LABEL = {
            exit_direction: '탈출구 방향',
            wrong_exit_direction: '탈출구 방향(불확실)',
            boss_direction: '보스 방향',
            boss_position: '보스 위치',
            tile_reveal: '한 칸 공개',
            nearby_tile_reveal: '인접 칸 공개',
            exit_direction_or_boss: '단서'
        };
        const statusName = (id) => {
            const cat = (root && root.StatusEffects && typeof root.StatusEffects.getCatalog === 'function')
                ? root.StatusEffects.getCatalog(id) : null;
            return (cat && cat.name) || id;
        };

        for (const a of parsed.actions) {
            switch (a.type) {
                case 'nothing':
                    break;
                case 'item_grant': {
                    // InventorySystem은 브라우저에서 글로벌 클래스로만 노출됨(window 프로퍼티 X).
                    // root.InventorySystem 우선, 실패 시 노션 ITEMS에서 이름 조회로 폴백.
                    let name = a.itemId;
                    const invSys = (root && root.InventorySystem) || (typeof InventorySystem !== 'undefined' ? InventorySystem : null);
                    if (invSys && typeof invSys.resolveDef === 'function') {
                        const def = invSys.resolveDef(a.itemId);
                        if (def && def.name) name = def.name;
                    }
                    out.labels.push(`${name} +${a.count}`);
                    break;
                }
                case 'item_grant_pool':
                    // 풀에서 어떤 게 나올지 모르므로 모호 라벨.
                    out.labels.push(`아이템 ${a.count}개 획득`);
                    out.uncertain = true;
                    break;
                case 'item_consume_filter':
                    out.labels.push(`${a.filter} -${a.count}`);
                    out.itemConsume.push({ filter: a.filter, count: a.count });
                    break;
                case 'stat_delta': {
                    const sign = a.delta >= 0 ? '+' : '';
                    out.labels.push(`${STAT_LABEL[a.stat] || a.stat} ${sign}${a.delta}`);
                    break;
                }
                case 'detection_delta': {
                    const sign = a.delta >= 0 ? '+' : '';
                    out.labels.push(`발각 ${sign}${a.delta}%`);
                    break;
                }
                case 'status_apply': {
                    const dur = a.duration ? `${a.duration}턴` : '';
                    out.labels.push(`${statusName(a.statusId)}${dur ? ' ' + dur : ''}`);
                    break;
                }
                case 'hint':
                    out.labels.push(`${HINT_LABEL[a.kind] || '단서'} 1회`);
                    break;
                case 'force_random_move':
                    out.labels.push('의식이 흐려짐 (강제 이동)');
                    break;
                case 'chance_grant':
                case 'chance_grant_status_on_item':
                case 'chance_stat':
                case 'chance_status':
                case 'chance_hint':
                case 'branches':
                    out.uncertain = true;
                    break;
                default:
                    // 미지의 토큰 — 안전 무시.
                    break;
            }
        }
        if (out.uncertain) out.labels.push('결과는 모름');
        return out;
    }

    const api = {
        parseItemEffect,
        applyItemEffect,
        describeEffect,
        STAT_BOUNDS,
        // D-23 프레임워크: 카드로 아이템 사용 공통 헬퍼
        scaleEffect,
        parseCardConsume,
        matchesConsumeFilter,
        // D-126 이벤트 효과 DSL
        parseEventEffect,
        applyEventEffect,
        // D-158 이벤트 모달 의사결정 컨텍스트
        summarizeEventEffects
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.EffectParser = api;
    }
})(typeof window !== 'undefined' ? window : this);
