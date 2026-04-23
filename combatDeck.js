// combatDeck.js — 전투 카드 덱 구성/사용 유틸
//
// 전투 덱의 최종 구성은 "베이스 카드(시트 SSOT) + 임시 카드(아이템 사용으로 생성)"이다.
// 임시 카드는 아이템에서 spawn된 풀(`extraCards: [{ id, count }]`)에 쌓이고,
// 전투 시작 때 이 유틸이 실제 덱을 빌드한다. 전투 내에서 임시 카드를 '사용'하면
// consumeExtraCard()로 풀에서 1장 차감되어 다음 전투엔 줄어든 상태로 들어간다.
//
// 기본 카드는 이미 data/combat_cards.json에 정의되어 있다. 동적 카드(throw 등)는
// 아래 RUNTIME_CARDS에 스펙을 둔다. 시트에 영구 편입하지 않는 이유는, 아이템 사용
// 없이도 항상 뽑을 수 있으면 기획 의도("아이템을 써야 등장")와 어긋나기 때문이다.

(function (root) {
    'use strict';

    // 동적으로만 등장하는 카드 사전.
    // 시트의 기존 throw_stone(명중률 70, 돌멩이 요구)과 별개로, 아이템 사용으로
    // 생성되는 새 '던지기' 카드는 요구 조건 없이 공격력 +1로 간단하게 설정.
    const RUNTIME_CARDS = {
        throw: {
            id: 'throw',
            name: '던지기',
            damage: 1,              // 공격력 +1 (요한 지시)
            success_rate: 100,
            requirement: '없음',
            runtime: true           // UI에서 '임시 카드' 배지 등 부가 표시에 쓸 힌트
        }
    };

    // base: data/combat_cards.json 내용 (배열)
    // extras: [{ id, count }, ...]  — 아이템 사용으로 쌓인 임시 카드들
    // 반환: 전투 시작용 카드 배열 (uid 부여됨, 셔플은 상위에서 선택)
    function buildCombatDeck(base, extras) {
        const deck = [];
        for (const card of (base || [])) {
            deck.push({ ...card, uid: `base:${card.id}:${deck.length}` });
        }
        for (const ex of (extras || [])) {
            const spec = RUNTIME_CARDS[ex.id];
            if (!spec) continue;
            for (let i = 0; i < (ex.count || 0); i++) {
                deck.push({ ...spec, uid: `ex:${ex.id}:${i}` });
            }
        }
        return deck;
    }

    // 임시 카드 1장 소비 — 전투 중 카드를 실제로 '사용'했을 때 호출.
    // prev: 이전 extras 배열. cardId: 소비할 카드 id.
    // 반환: 새 extras 배열 (불변).
    function consumeExtraCard(prev, cardId) {
        const next = [];
        for (const e of (prev || [])) {
            if (e.id !== cardId) { next.push(e); continue; }
            const left = (e.count || 0) - 1;
            if (left > 0) next.push({ ...e, count: left });
        }
        return next;
    }

    // D-46 (2026-04-23) — 사냥감 전투 덱 빌드.
    //   보스 전투와 별개 파이프라인. 손패 구성은 간단:
    //     - `requirement === '없음'` 또는 '없음 (항상 사용 가능)' 포함: 무조건 포함.
    //     - 그 외: 인벤 아이템 중 하나의 `ITEMS[type].name`이 requirement와 일치해야 포함.
    //   통과한 카드를 `count || 1`만큼 복제하고 uid `combat:{id}:{idx}` 부여.
    //   기존 buildCombatDeck / RUNTIME_CARDS / consumeExtraCard는 건드리지 않음 (보스 전투 경로).
    function buildHuntDeck(combatCardsJson, inventory) {
        const cards = Array.isArray(combatCardsJson) ? combatCardsJson : [];
        const items = (inventory && Array.isArray(inventory.items)) ? inventory.items : [];
        // inventory는 InventorySystem 인스턴스. ITEMS 사전은 InventorySystem.ITEMS.
        // 런타임에 전역으로 접근 가능. TTD_DATA.ITEMS는 이름 치환용(이미 ITEMS에 반영됨).
        const ITEM_DEFS = (typeof window !== 'undefined' && window.InventorySystem && window.InventorySystem.ITEMS)
            ? window.InventorySystem.ITEMS
            : (typeof InventorySystem !== 'undefined' && InventorySystem.ITEMS) || {};

        const ownedNames = new Set(
            items.map(it => (ITEM_DEFS[it.type] || {}).name).filter(Boolean)
        );

        const deck = [];
        let idx = 0;
        for (const card of cards) {
            const req = card && card.requirement;
            const isFree = typeof req === 'string' && (req === '없음' || req.indexOf('없음') === 0);
            const pass = isFree || (typeof req === 'string' && ownedNames.has(req));
            if (!pass) continue;
            // D-46 보강: requirement 없는 기본 카드(주먹/회피/도망 등)는 '무한카드'.
            // 손패에 1장만 두고 infinite=true로 표시 — 슬롯 배치 시 손패에서 소진되지 않음.
            // 요구 아이템이 있는 카드(돌 던지기 등)는 기존대로 count만큼 복제 후 1회성 소비.
            if (isFree) {
                deck.push({ ...card, infinite: true, uid: `combat:${card.id}:${idx++}` });
                continue;
            }
            const copies = Number(card.count) || 1;
            for (let i = 0; i < copies; i++) {
                deck.push({ ...card, uid: `combat:${card.id}:${idx++}` });
            }
        }
        return deck;
    }

    // D-46 (2026-04-23) — 사냥 전투 해결 로직.
    //   3턴 고정. 3턴차는 prey가 '빠르게 도망' → prey_fled (카드 무관).
    //   각 턴: 플레이어 카드 → success_rate 판정 → run_away 성공 시 즉시 player_fled 종료
    //   → damage>0이면 prey.evade_rate 판정 → 명중 시 hp 차감 → hp<=0이면 victory 즉시 종료.
    //   evade_rate는 prey별 개별 설정(시트 '사냥감' 탭), 누락 시 20 폴백.
    //   turns 배열은 모달 로그 단위로 순차 표시할 수 있게 구조화.
    function resolveHunt(prey, userSlots) {
        let hp = prey.hp;
        const evadeRate = (Number(prey.evade_rate) >= 0) ? Number(prey.evade_rate) : 20;
        const turns = [];
        for (let t = 0; t < 3; t++) {
            if (t === 2) {
                turns.push({ turn: t + 1, preyAction: '빠르게 도망', outcome: 'flee_signal' });
                return { outcome: 'prey_fled', turns, preyHpFinal: hp };
            }
            const card = userSlots[t];
            if (!card) {
                turns.push({ turn: t + 1, preyAction: '회피', userCard: null, hit: false, preyHpAfter: hp });
                continue;
            }
            const cardHit = Math.random() * 100 < (card.success_rate || 0);
            if (card.id === 'run_away' && cardHit) {
                turns.push({
                    turn: t + 1, preyAction: '회피', userCard: card,
                    outcome: 'player_flee', preyHpAfter: hp
                });
                return { outcome: 'player_fled', turns, preyHpFinal: hp };
            }
            if (cardHit && (card.damage || 0) > 0) {
                const preyEvaded = Math.random() * 100 < evadeRate;
                if (!preyEvaded) {
                    hp -= card.damage;
                    turns.push({
                        turn: t + 1, preyAction: '회피', userCard: card,
                        hit: true, preyEvaded: false, damage: card.damage, preyHpAfter: hp
                    });
                    if (hp <= 0) return { outcome: 'victory', turns, preyHpFinal: hp };
                } else {
                    turns.push({
                        turn: t + 1, preyAction: '회피', userCard: card,
                        hit: true, preyEvaded: true, preyHpAfter: hp
                    });
                }
            } else {
                turns.push({
                    turn: t + 1, preyAction: '회피', userCard: card,
                    hit: false, preyHpAfter: hp
                });
            }
        }
        // 논리적으로 안 닿음 (t===2에서 return). 안전망.
        return { outcome: 'prey_fled', turns, preyHpFinal: hp };
    }

    const api = { buildCombatDeck, consumeExtraCard, RUNTIME_CARDS, buildHuntDeck, resolveHunt };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.CombatDeck = api;
    }
})(typeof window !== 'undefined' ? window : this);
