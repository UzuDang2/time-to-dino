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

    // D-52: 복합 requirement DSL 파서.
    //   "A + B" → ["A", "B"]. 단일 재료는 ["A"]. 빈값/"없음" 계열 → [].
    //   공백 유무 모두 허용( " + " 우선, fallback "+"). 이름 자체에 + 가 없다는 전제.
    function parseRequirement(req) {
        if (req == null) return [];
        const s = String(req).trim();
        if (!s || s === '없음' || s.indexOf('없음') === 0) return [];
        // " + " 구분 우선, 없으면 "+" 단일 구분.
        const parts = s.indexOf(' + ') >= 0 ? s.split(' + ') : s.split('+');
        return parts.map(p => p.trim()).filter(Boolean);
    }

    // D-46/D-50 개정: 사냥감 전투 덱 빌드.
    //   손패 구성 규칙:
    //     - requirement '없음' → 무한카드(infinite=true).
    //     - requirement 단일/복합 재료 → 각 재료 이름이 인벤에 존재해야 포함.
    //       slotLimit = min(보유 개수들). 하나라도 0이면 카드 제외.
    //   D-50: 카드 accuracy에 owning weapon의 accuracy를 합산해서 주입.
    //     - owning weapon = requirement 재료 중 '무기 카테고리'에 해당하는 것.
    //     - 여러 무기가 요구돼도 한 카드에 한 주무기 전제(현재 스펙상 하나).
    //   통과한 카드에 uid `combat:{id}:{idx}` 부여.
    function buildHuntDeck(combatCardsJson, inventory) {
        const cards = Array.isArray(combatCardsJson) ? combatCardsJson : [];
        const items = (inventory && Array.isArray(inventory.items)) ? inventory.items : [];
        const ITEM_DEFS = (typeof window !== 'undefined' && window.InventorySystem && window.InventorySystem.ITEMS)
            ? window.InventorySystem.ITEMS
            : (typeof InventorySystem !== 'undefined' && InventorySystem.ITEMS) || {};
        const TTD = (typeof window !== 'undefined' && window.TTD_DATA) ? window.TTD_DATA : null;
        const WEAPONS = (TTD && Array.isArray(TTD.WEAPONS)) ? TTD.WEAPONS : [];

        // 아이템 이름별 보유 개수 맵 — requirement 재료명 → 보유 개수.
        const ownedCountByName = {};
        for (const it of items) {
            const staticName = (ITEM_DEFS[it.type] || {}).name;
            // 무기는 ITEMS에 없을 수도 있어 WEAPONS까지 조회.
            const weaponDef = WEAPONS.find(w => w && w.id === it.type);
            const name = staticName || (weaponDef && weaponDef.name);
            if (name) ownedCountByName[name] = (ownedCountByName[name] || 0) + 1;
        }

        // 이름 → 무기 정의 맵 (카드에 accuracy 보너스 합산 + full_loss 분기용).
        const weaponByName = {};
        for (const w of WEAPONS) {
            if (w && w.name) weaponByName[w.name] = w;
        }

        const deck = [];
        let idx = 0;
        for (const card of cards) {
            const reqs = parseRequirement(card && card.requirement);

            // 무한카드 (요구 없음) — 주먹/회피/도망.
            if (reqs.length === 0) {
                const base = { ...card, infinite: true, uid: `combat:${card.id}:${idx++}` };
                base.accuracy = Number(card.accuracy) || 0;
                deck.push(base);
                continue;
            }

            // 요구 재료별 보유 개수 — 하나라도 0이면 카드 제외.
            let slotLimit = Infinity;
            let missing = false;
            for (const r of reqs) {
                const owned = ownedCountByName[r] || 0;
                if (owned <= 0) { missing = true; break; }
                slotLimit = Math.min(slotLimit, owned);
            }
            if (missing) continue;

            // accuracy 합산: 카드 자체 accuracy + (요구 재료 중 무기의 accuracy).
            let totalAccuracy = Number(card.accuracy) || 0;
            let owningWeaponId = null;
            for (const r of reqs) {
                const wdef = weaponByName[r];
                if (wdef) {
                    totalAccuracy += Number(wdef.accuracy) || 0;
                    owningWeaponId = owningWeaponId || wdef.id; // 첫 매칭 무기 기록
                }
            }

            deck.push({
                ...card,
                requirements: reqs,                     // 런타임 편의(소비 단계용)
                accuracy: totalAccuracy,
                slotLimit,
                weaponId: owningWeaponId,               // null이면 무기 아닌 카드(돌던지기 등)
                uid: `combat:${card.id}:${idx++}`
            });
        }
        return deck;
    }

    // D-60: prey.evade_per_turn (CSV "T1,T2,T3") 파싱 → 턴별 회피율 배열.
    //   빈 값/미지정 → fallback [evade_rate, evade_rate, evade_rate] (3턴 공통).
    //   항상 길이 3 보장. 부분 CSV("30,30")면 나머지는 마지막 값으로 패딩.
    function parseEvadesByTurn(prey) {
        const fallback = (Number(prey && prey.evade_rate) >= 0)
            ? Number(prey.evade_rate) : 20;
        const raw = prey && prey.evade_per_turn;
        if (raw == null || raw === '') return [fallback, fallback, fallback];
        const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return [fallback, fallback, fallback];
        const out = [];
        for (let i = 0; i < 3; i++) {
            const token = parts[i] != null ? parts[i] : parts[parts.length - 1];
            const n = Number(token);
            out.push(Number.isFinite(n) ? n : fallback);
        }
        return out;
    }

    // D-48/D-50/D-51/D-60 개정: 사냥 전투 해결 로직.
    //   3턴 고정. 모든 턴 공통으로 prey는 '회피'.
    //   D-60: 턴별 회피율(evade_per_turn) + 도주 누적 패널티(fleeCount*10).
    //   각 턴:
    //     1) 무기 요구 카드인데 weaponState의 durabilityLeft<=0 → auto-fail (무기 부재).
    //     2) 플레이어 카드 success_rate 판정 → run_away 성공 시 player_fled.
    //     3) damage>0이면 baseEvadeT = evadesByTurn[t] - fleeCount*10 (max 0).
    //        effectiveEvade = max(0, baseEvadeT - card.accuracy).
    //     4) cardHit & 공격 실행된 경우, 무기 내구도 차감
    //        (full_loss='Y'면 남은 durability 전부 0 → 인벤 제거; 아니면 -1).
    //   반환: { outcome, turns, preyHpFinal, weaponUsage }
    //     weaponUsage: { [weaponId]: { used:N, broken:bool, durabilityFinal } }
    //
    // opts.weaponState: { [weaponId]: { durabilityLeft:number, fullLossSeed:false } }
    //   UI에서 각 무기 인스턴스의 현재 durabilityLeft를 미리 세팅해 넘긴다.
    //   동일 weaponId 여러 자루가 있으면 상위에서 "한 자루씩 순차" 처리를 구현(여기선 1자루 추적).
    function resolveHunt(prey, userSlots, opts) {
        opts = opts || {};
        const weaponState = {};
        // 얕은 복사 — 원본 훼손 방지.
        if (opts.weaponState) {
            for (const [k, v] of Object.entries(opts.weaponState)) {
                weaponState[k] = { durabilityLeft: Number(v && v.durabilityLeft) || 0 };
            }
        }

        let hp = prey.hp;
        const evadesByTurn = parseEvadesByTurn(prey);
        const fleeCount = Math.max(0, Number(prey && prey.fleeCount) || 0);
        const turns = [];
        const weaponUsage = {}; // 턴 내 누적 소모량

        // 무기 사용 기록 헬퍼.
        const recordWeaponUse = (wid, fullLoss) => {
            const state = weaponState[wid];
            if (!state) return;
            const before = state.durabilityLeft;
            const dec = fullLoss ? before : 1;
            state.durabilityLeft = Math.max(0, before - dec);
            const slot = weaponUsage[wid] || { used: 0, broken: false, fullLossCount: 0 };
            slot.used += dec;
            slot.broken = slot.broken || state.durabilityLeft <= 0;
            if (fullLoss) slot.fullLossCount += 1;
            slot.durabilityFinal = state.durabilityLeft;
            weaponUsage[wid] = slot;
        };

        let terminatedOutcome = null;

        for (let t = 0; t < 3; t++) {
            const card = userSlots[t];
            if (!card) {
                turns.push({ turn: t + 1, preyAction: '회피', userCard: null, hit: false, preyHpAfter: hp });
                continue;
            }

            // D-51 auto-fail: 무기 요구 카드인데 무기 재고가 0이면 시도조차 하지 않음.
            if (card.weaponId) {
                const ws = weaponState[card.weaponId];
                if (!ws || ws.durabilityLeft <= 0) {
                    turns.push({
                        turn: t + 1, preyAction: '회피', userCard: card,
                        hit: false, autoFail: true, reason: 'weapon_missing', preyHpAfter: hp
                    });
                    continue;
                }
            }

            const cardHit = Math.random() * 100 < (card.success_rate || 0);

            // 도망치기 성공 분기.
            if (card.id === 'run_away' && cardHit) {
                turns.push({
                    turn: t + 1, preyAction: '회피', userCard: card,
                    outcome: 'player_flee', preyHpAfter: hp
                });
                terminatedOutcome = 'player_fled';
                break;
            }

            if (cardHit && (card.damage || 0) > 0) {
                // D-50/D-60: effectiveEvade = max(0, evadesByTurn[t] - fleeCount*10 - card.accuracy).
                const baseEvadeT = Math.max(0, evadesByTurn[t] - fleeCount * 10);
                const effectiveEvade = Math.max(0, baseEvadeT - (Number(card.accuracy) || 0));
                const preyEvaded = Math.random() * 100 < effectiveEvade;

                // 공격 실행 자체는 성공 — 무기 사용 카운트(명중/회피 무관).
                // 요한 스펙: "창던지기 성공 시 창이 날아가 사라짐" — cardHit 기준이지 명중 여부와 무관.
                if (card.weaponId) {
                    const fullLoss = String(card.full_loss || '').toUpperCase() === 'Y';
                    recordWeaponUse(card.weaponId, fullLoss);
                }

                if (!preyEvaded) {
                    hp -= card.damage;
                    turns.push({
                        turn: t + 1, preyAction: '회피', userCard: card,
                        hit: true, preyEvaded: false, damage: card.damage,
                        effectiveEvade, preyHpAfter: hp
                    });
                    if (hp <= 0) {
                        terminatedOutcome = 'victory';
                        break;
                    }
                } else {
                    turns.push({
                        turn: t + 1, preyAction: '회피', userCard: card,
                        hit: true, preyEvaded: true,
                        effectiveEvade, preyHpAfter: hp
                    });
                }
            } else {
                // 카드 자체 실패(success_rate 미달) — 무기 소모 없음 (던지기 전에 놓친 셈).
                turns.push({
                    turn: t + 1, preyAction: '회피', userCard: card,
                    hit: false, preyHpAfter: hp
                });
            }
        }

        const outcome = terminatedOutcome || (hp <= 0 ? 'victory' : 'prey_fled');
        return { outcome, turns, preyHpFinal: hp, weaponUsage };
    }

    const api = {
        buildCombatDeck, consumeExtraCard, RUNTIME_CARDS,
        buildHuntDeck, resolveHunt, parseRequirement, parseEvadesByTurn
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.CombatDeck = api;
    }
})(typeof window !== 'undefined' ? window : this);
