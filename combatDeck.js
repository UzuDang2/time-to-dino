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

    // D-73: 카테고리 토큰 집합. requirement가 이 토큰 단일이면 "인벤에 category=토큰인 아이템
    //   1개 이상 보유" 로 판정(이름 매칭 대신). shield/armor 두 방어구 계열에 사용.
    //   확장 시 여기에 추가만 하면 buildHuntDeck이 동일 경로로 처리.
    const CATEGORY_REQ_TOKENS = new Set(['shield', 'armor']);

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
        const IS = (typeof window !== 'undefined' && window.InventorySystem)
            || (typeof InventorySystem !== 'undefined' ? InventorySystem : null);
        const ITEM_DEFS = (IS && IS.ITEMS) || {};
        const resolveDef = IS && typeof IS.resolveDef === 'function'
            ? IS.resolveDef.bind(IS)
            : (t) => ITEM_DEFS[t] || {};
        const TTD = (typeof window !== 'undefined' && window.TTD_DATA) ? window.TTD_DATA : null;
        const WEAPONS = (TTD && Array.isArray(TTD.WEAPONS)) ? TTD.WEAPONS : [];
        const ARMORS  = (TTD && Array.isArray(TTD.ARMORS))  ? TTD.ARMORS  : [];

        // 아이템 이름별 보유 개수 맵 — requirement 재료명 → 보유 개수.
        const ownedCountByName = {};
        // 카테고리별 보유 개수 맵 — requirement='shield'/'armor' 용.
        const ownedCountByCategory = {};
        // 카테고리별 보유 아이템의 defense 합 (D-73): shield_block 카드의 방어 합산에 사용.
        const defenseSumByCategory = { shield: 0, armor: 0 };
        for (const it of items) {
            const def = resolveDef(it.type) || {};
            const name = def.name || (ITEM_DEFS[it.type] || {}).name;
            if (name) ownedCountByName[name] = (ownedCountByName[name] || 0) + 1;
            const cat = def.category;
            if (cat === 'shield' || cat === 'armor') {
                ownedCountByCategory[cat] = (ownedCountByCategory[cat] || 0) + 1;
                defenseSumByCategory[cat] += Number(def.defense) || 0;
            }
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
            const cardDefense = Number(card.defense) || 0;

            // 무한카드 (요구 없음) — 주먹/회피/도망/웅크리기.
            // D-143/D-146: 무한 방어카드(예: 웅크리기)도 인벤 방어구 합 적용.
            //   D-146 (요한 정정): +1 추가 보너스 제거. 카드 defense + 방어구 합만.
            //   잎사귀(1) + 웅크리기(card 1) = 2 방어.
            if (reqs.length === 0) {
                let infDefense = cardDefense;
                if (cardDefense > 0) {
                    infDefense = cardDefense
                        + (defenseSumByCategory.shield || 0)
                        + (defenseSumByCategory.armor  || 0);
                }
                const base = {
                    ...card, infinite: true,
                    accuracy: Number(card.accuracy) || 0,
                    defense: infDefense,
                    uid: `combat:${card.id}:${idx++}`
                };
                deck.push(base);
                continue;
            }

            // 요구 토큰별 보유 개수 — 하나라도 0이면 카드 제외.
            //   카테고리 토큰(shield/armor): 인벤에 category=토큰인 아이템 수.
            //   그 외: 이름 매칭.
            let slotLimit = Infinity;
            let missing = false;
            for (const r of reqs) {
                const owned = CATEGORY_REQ_TOKENS.has(r)
                    ? (ownedCountByCategory[r] || 0)
                    : (ownedCountByName[r] || 0);
                if (owned <= 0) { missing = true; break; }
                slotLimit = Math.min(slotLimit, owned);
            }
            if (missing) continue;

            // D-106: 카드 자체 accuracy만 사용 (무기 accuracy 컬럼 제거됨).
            //   weaponId 추적은 D-51 내구도 차감을 위해 유지.
            // D-221 (2026-05-02): owningWeaponId 단일 → weaponIds 배열 확장. require에 무기 여러 개 명시 가능.
            //   예: 화살쏘기 require="조잡한 활 + 조잡한 화살묶음" → weaponIds=['bow', 'arrow_bundle'].
            //   사용 시 모든 무기 내구도 차감. backward compat 위해 weaponId(=weaponIds[0])도 유지.
            const totalAccuracy = Number(card.accuracy) || 0;
            const ownedWeaponIds = [];
            for (const r of reqs) {
                if (CATEGORY_REQ_TOKENS.has(r)) continue;
                const wdef = weaponByName[r];
                if (wdef && !ownedWeaponIds.includes(wdef.id)) {
                    ownedWeaponIds.push(wdef.id);
                }
            }
            const owningWeaponId = ownedWeaponIds[0] || null;

            // D-73 / D-143 / D-146: 모든 방어카드(cardDefense > 0)는 인벤 방어구(shield+armor) 합산.
            //   D-146 (요한 정정): +1 추가 보너스 제거. 잎사귀(1) + 웅크리기(card 1) = 2 방어.
            //   누적 아니고 턴별 — combat 해석은 그 턴 슬롯 카드 기준으로만 적용(이미 동작).
            let finalDefense = cardDefense;
            if (cardDefense > 0) {
                finalDefense = cardDefense
                    + (defenseSumByCategory.shield || 0)
                    + (defenseSumByCategory.armor  || 0);
            }

            deck.push({
                ...card,
                requirements: reqs,                     // 런타임 편의(소비 단계용)
                accuracy: totalAccuracy,
                defense: finalDefense,
                slotLimit,
                weaponId: owningWeaponId,               // null이면 무기 아닌 카드(돌던지기 등). backward compat — D-221 이전 코드 호환.
                weaponIds: ownedWeaponIds,              // D-221: 모든 무기 id 배열 — 화살쏘기 등 require에 무기 여러 개 명시한 카드.
                uid: `combat:${card.id}:${idx++}`
            });
        }
        return deck;
    }

    // D-60/D-96: prey.evade_per_turn (CSV "T1,T2,T3") 파싱 → 턴별 회피(정수) 배열.
    //   빈 값/미지정 → fallback [evade_rate, evade_rate, evade_rate] (3턴 공통).
    //   D-96: 회피율(%) → 회피(정수) 시스템 변경. 기본값 fallback 20 → 1.
    //   항상 길이 3 보장. 부분 CSV("30,30")면 나머지는 마지막 값으로 패딩.
    function parseEvadesByTurn(prey) {
        const fallback = (Number(prey && prey.evade_rate) >= 0)
            ? Number(prey.evade_rate) : 1;
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

    // D-75/D-98/D-108: prey.actions_per_turn DSL 파싱 → 턴별 행동 id 배열.
    //   CSV. 빈값이면 레벨별 기본값.
    //   D-108: 행동 풀 SSOT(`사냥감행동` 시트, TTD_DATA.PREY_ACTIONS)로 분리.
    //     토큰은 행동 id(예: 'tusk_charge', 'iron_curl'). 알 수 없는 토큰은 그대로 두고
    //     resolveHunt에서 findPreyAction으로 lookup·fallback 처리.
    function parsePreyActions(prey, turnCount) {
        const lvl = Number(prey && prey.level) || 1;
        const defaults = lvl === 2
            ? ['attack', 'evade', 'attack', 'peek']
            : ['peek', 'evade', 'peek'];
        const raw = prey && prey.actions_per_turn;
        const parts = (raw == null || raw === '')
            ? defaults
            : String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const out = [];
        for (let i = 0; i < turnCount; i++) {
            const token = parts[i] != null ? parts[i] : parts[parts.length - 1] || 'evade';
            out.push(token || 'evade');
        }
        return out;
    }

    // D-108: 행동 id → 행동 정의 lookup. SSOT는 시트 '사냥감행동' (TTD_DATA.PREY_ACTIONS).
    //   못 찾으면 fallback — id를 type으로 보고 기본값(damage/accuracy/defense=0).
    //   기본 type 토큰('attack'/'defend'/'evade'/'peek')도 시트에 row로 있으므로 lookup 성공이 정상 경로.
    const FALLBACK_TYPES = new Set(['attack', 'defend', 'evade', 'peek']);
    function findPreyAction(id) {
        const TTD = (typeof window !== 'undefined' && window.TTD_DATA) ? window.TTD_DATA : null;
        const pool = (TTD && Array.isArray(TTD.PREY_ACTIONS)) ? TTD.PREY_ACTIONS : [];
        const hit = pool.find(a => a && a.id === id);
        if (hit) {
            return {
                id: hit.id,
                name: hit.name || hit.id,
                type: hit.type || 'peek',
                damage: Number(hit.damage) || 0,
                accuracy: Number(hit.accuracy) || 0,
                defense: Number(hit.defense) || 0,
            };
        }
        // Fallback: id 자체가 기본 type이면 그대로, 아니면 peek로.
        const t = FALLBACK_TYPES.has(id) ? id : 'peek';
        return { id, name: id, type: t, damage: 0, accuracy: 0, defense: 0 };
    }

    // D-48/D-50/D-51/D-60/D-74/D-75/D-98 개정: 사냥 전투 해결 로직.
    //   Level 1: 3턴 고정. D-98 (2026-04-25 요한 지시) — actions_per_turn DSL 사용
    //     (peek≤2 / evade≤1 / defend≤1로 사냥감별 성격 반영).
    //   Level 2: 4턴 고정. prey.actions_per_turn 시트 DSL로 턴별 행동.
    //   공통:
    //     - attack: prey가 공격. 유저가 defense>0 카드 배치 시 finalDamage = max(0, preyAttack - cardDefense).
    //     - defend: prey 방어 태세. 유저 공격 대미지에서 prey.defense 감쇄.
    //     - evade : 기존 회피 로직 그대로 (evadesByTurn 기반).
    //     - peek  : 아무 행동 없음. evade=0 간주 → 유저 공격 100% 명중(success_rate만 굴림).
    //   D-74: 반환 객체에 `playerDamageTaken` — 유저 HP 차감에 사용.
    //   D-60/D-96: 턴별 회피(evade_per_turn 정수) + 도주 누적 패널티(fleeCount당 -1).
    //     명중 ≥ 회피 → 명중. 회피 > 명중 → 회피.
    //
    // opts.weaponState: { [weaponId]: { durabilityLeft:number, fullLossSeed:false } }
    // opts.armorState (D-150): { [armorId]: { durabilityLeft:number } } — 방어구 인스턴스별 잔여 내구.
    function resolveHunt(prey, userSlots, opts) {
        opts = opts || {};
        const weaponState = {};
        // 얕은 복사 — 원본 훼손 방지.
        if (opts.weaponState) {
            for (const [k, v] of Object.entries(opts.weaponState)) {
                weaponState[k] = { durabilityLeft: Number(v && v.durabilityLeft) || 0 };
            }
        }
        // D-150: armorState 얕은 복사. 방어 카드 사용 시 모든 잔여 방어구 1씩 차감.
        const armorState = {};
        if (opts.armorState) {
            for (const [k, v] of Object.entries(opts.armorState)) {
                armorState[k] = { durabilityLeft: Number(v && v.durabilityLeft) || 0 };
            }
        }

        let hp = prey.hp;
        const evadesByTurn = parseEvadesByTurn(prey);
        const fleeCount = Math.max(0, Number(prey && prey.fleeCount) || 0);
        const turns = [];
        const weaponUsage = {}; // 턴 내 누적 소모량
        const armorUsage = {};  // D-150: 방어구 누적 차감
        // D-74: 유저가 받은 누적 대미지.
        let playerDamageTaken = 0;

        // D-246 (2026-05-04 요한 지시): 방어/회피 스택 시스템.
        //   카드 사용 시 stack ← cap (cap = 유저 총 방어력/회피력 — 장비/패시브 합산).
        //   카드 자체 수치는 stack 부여 트리거일 뿐, 그 값은 무관(사용자 (1) implicit 폐기 — (2) 정정 결과).
        //   evade stack > 0 → 사냥감 attack 1회 회피(stack -1). 그 다음 defense stack로 흡수.
        //   "한 턴 유지(다음 턴까지)" — 부여 turn 포함 2 turn 유효, 그 후 만료.
        //   사냥감은 본 시스템 미적용(현재 동작 유지) — 사용자 (4) 결정.
        //   opts.defenseCap / opts.evadeCap 미전달 시 0 — 스택 시스템 비활성(backward compat).
        const defenseCap = Math.max(0, Number(opts.defenseCap) || 0);
        const evadeCap = Math.max(0, Number(opts.evadeCap) || 0);
        let defenseStack = 0;
        let defenseStackAge = 0;  // 0 = 부여 turn, 1 = 다음 turn, 2+ 만료
        let evadeStack = 0;
        let evadeStackAge = 0;
        const stackEvents = [];   // UI용 — 매 turn 끝 시점 stack 스냅샷
        // D-108: prey.attack은 fallback. 우선 turn별 actionDef.damage 사용.
        const preyAttackFallback = Math.max(0, Number(prey && prey.attack) || 0);

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

        // D-150: 방어구 사용 기록 — 방어 카드 슬롯 발동 시 모든 잔여 방어구 1씩 차감.
        const recordArmorUseAll = () => {
            for (const [aid, state] of Object.entries(armorState)) {
                if (!state || state.durabilityLeft <= 0) continue;
                state.durabilityLeft = Math.max(0, state.durabilityLeft - 1);
                const slot = armorUsage[aid] || { used: 0, broken: false };
                slot.used += 1;
                slot.broken = slot.broken || state.durabilityLeft <= 0;
                slot.durabilityFinal = state.durabilityLeft;
                armorUsage[aid] = slot;
            }
        };

        let terminatedOutcome = null;

        const isLevel2 = Number(prey && prey.level) === 2;
        const turnCount = isLevel2 ? 4 : 3;
        // D-98: L1도 actions_per_turn DSL 사용 — L1/L2 공통 처리.
        const preyActions = parsePreyActions(prey, turnCount);
        const preyDefenseFallback = Math.max(0, Number(prey && prey.defense) || 0);

        for (let t = 0; t < turnCount; t++) {
            // D-246: turn 시작 시 (첫 turn 제외) age += 1, 만료 처리(age >= 2면 stack 0).
            if (t > 0) {
                if (defenseStack > 0) defenseStackAge += 1;
                if (evadeStack > 0) evadeStackAge += 1;
                if (defenseStackAge >= 2) { defenseStack = 0; defenseStackAge = 0; }
                if (evadeStackAge >= 2) { evadeStack = 0; evadeStackAge = 0; }
            }

            const card = userSlots[t];
            // D-108: 행동 id → actionDef lookup. type/damage/accuracy/defense 모두 actionDef 기준.
            const actionDef = findPreyAction(preyActions[t]);
            const preyActionType = actionDef.type;
            const preyActionLabel = actionDef.name || (
                preyActionType === 'attack' ? '공격'
                : preyActionType === 'defend' ? '방어'
                : preyActionType === 'peek'   ? '눈치'
                : '회피'
            );

            // 턴별 prey 수치 — actionDef 우선, 0이면 prey 폴백.
            const preyAttackThisTurn = (actionDef.damage > 0)
                ? actionDef.damage : preyAttackFallback;
            const preyDefenseThisTurn = (actionDef.defense > 0)
                ? actionDef.defense : preyDefenseFallback;
            const cardDefense = Math.max(0, Number(card && card.defense) || 0);
            const cardEvade = Math.max(0, Number(card && card.evade) || 0);

            // D-246: 방어/회피 카드 사용 시 stack ← cap. 카드 자체 수치 무관(트리거 역할).
            //   stack < cap이면 cap으로 set, 이미 cap이면 변화 X. age 0 리셋(부여 turn).
            if (card && cardDefense > 0 && defenseStack < defenseCap) {
                defenseStack = defenseCap;
                defenseStackAge = 0;
            }
            if (card && cardEvade > 0 && evadeStack < evadeCap) {
                evadeStack = evadeCap;
                evadeStackAge = 0;
            }

            const takeDamageThisTurn = () => {
                if (preyActionType !== 'attack' || preyAttackThisTurn <= 0) return 0;
                // D-232: 유저 선공 — 유저 카드로 prey HP 0 도달 시 prey attack 무효.
                if (hp <= 0) return 0;
                // D-246: evade stack 우선 — 1회 회피 + stack -1.
                if (evadeStack > 0) {
                    evadeStack -= 1;
                    return 0;
                }
                // D-246: defense stack 흡수 — 흡수한 만큼 stack 차감.
                if (defenseStack > 0) {
                    const absorbed = Math.min(defenseStack, preyAttackThisTurn);
                    defenseStack -= absorbed;
                    const dmg = preyAttackThisTurn - absorbed;
                    if (dmg > 0) playerDamageTaken += dmg;
                    return dmg;
                }
                playerDamageTaken += preyAttackThisTurn;
                return preyAttackThisTurn;
            };

            if (!card) {
                const dmgTaken = takeDamageThisTurn();
                turns.push({
                    turn: t + 1, preyAction: preyActionLabel, preyActionType, userCard: null,
                    hit: false, preyHpAfter: hp,
                    ...(dmgTaken > 0 ? { playerDamage: dmgTaken } : {})
                });
                continue;
            }

            // D-150: 방어 카드 슬롯이면 인벤 모든 방어구 내구도 1씩 차감.
            //   cardDefense > 0 = 카드의 finalDefense가 인벤 합산까지 포함되어 있으니
            //   자체 defense가 양수라는 뜻 — crouch/shield_block 등.
            if (cardDefense > 0) recordArmorUseAll();

            // D-51 auto-fail: 무기 요구 카드인데 무기 재고가 0이면 시도조차 하지 않음.
            // D-221: weaponIds 배열 — 무기 여러 개 require하는 카드(화살쏘기)는 어느 하나라도 0이면 fail.
            const cardWeaponIds = (Array.isArray(card.weaponIds) && card.weaponIds.length > 0)
                ? card.weaponIds
                : (card.weaponId ? [card.weaponId] : []);
            if (cardWeaponIds.length > 0) {
                const anyMissing = cardWeaponIds.some(wid => {
                    const ws = weaponState[wid];
                    return !ws || ws.durabilityLeft <= 0;
                });
                if (anyMissing) {
                    const dmgTaken = takeDamageThisTurn();
                    turns.push({
                        turn: t + 1, preyAction: preyActionLabel, preyActionType, userCard: card,
                        hit: false, autoFail: true, reason: 'weapon_missing', preyHpAfter: hp,
                        ...(dmgTaken > 0 ? { playerDamage: dmgTaken } : {})
                    });
                    continue;
                }
            }

            const cardHit = Math.random() * 100 < (card.success_rate || 0);

            // 도망치기 성공 분기.
            if (card.id === 'run_away' && cardHit) {
                turns.push({
                    turn: t + 1, preyAction: preyActionLabel, preyActionType, userCard: card,
                    outcome: 'player_flee', preyHpAfter: hp
                });
                terminatedOutcome = 'player_fled';
                break;
            }

            const damageOut = Number(card.damage) || 0;
            if (cardHit && damageOut > 0) {
                // D-96 (2026-04-25 요한 지시): 회피율(%) → 회피(정수), 명중률(%) → 명중(정수).
                //   판정: 명중 ≥ 회피이면 무조건 명중, 회피 > 명중이면 무조건 회피.
                //   확률 굴림 제거(결정론). fleeCount는 회피 -1씩 차감(누적 패널티 단순화).
                //   D-98: turn-action 분기 L1/L2 공통 — peek/attack/defend는 회피 0.
                let baseEvadeT = Math.max(0, (evadesByTurn[t] || 0) - fleeCount);
                if (preyActionType !== 'evade') baseEvadeT = 0;
                const cardAccuracy = Number(card.accuracy) || 0;
                const effectiveEvade = baseEvadeT;
                const preyEvaded = effectiveEvade > cardAccuracy;

                // 공격 실행 자체는 성공 — 무기 사용 카운트(명중/회피 무관).
                // D-97 (2026-04-25 요한 지시): full_loss="Y" 100% 손실 외, loss_chance(0~100)
                //   확률 손실도 지원. throw_spear는 50% 확률로 창을 잃는다.
                // D-221: weaponIds 배열 — 모든 무기에 내구도 차감 적용 (활/화살묶음 동시 -1).
                if (cardWeaponIds.length > 0) {
                    const fullLoss = String(card.full_loss || '').toUpperCase() === 'Y';
                    const lossChance = Math.max(0, Math.min(100, Number(card.loss_chance) || 0));
                    const probLoss = !fullLoss && lossChance > 0 && (Math.random() * 100 < lossChance);
                    for (const wid of cardWeaponIds) recordWeaponUse(wid, fullLoss || probLoss);
                }

                if (!preyEvaded) {
                    // D-75/D-98/D-108: preyAction.type='defend' → 유저 공격 대미지에서 actionDef.defense 감쇄.
                    const defenseReduction = (preyActionType === 'defend') ? preyDefenseThisTurn : 0;
                    const appliedDamage = Math.max(0, damageOut - defenseReduction);
                    hp -= appliedDamage;
                    const dmgTaken = takeDamageThisTurn();
                    turns.push({
                        turn: t + 1, preyAction: preyActionLabel, preyActionType, userCard: card,
                        hit: true, preyEvaded: false, damage: appliedDamage,
                        effectiveEvade, preyHpAfter: hp,
                        ...(defenseReduction > 0 ? { preyDefended: defenseReduction } : {}),
                        ...(dmgTaken > 0 ? { playerDamage: dmgTaken } : {})
                    });
                    if (hp <= 0) {
                        terminatedOutcome = 'victory';
                        break;
                    }
                } else {
                    const dmgTaken = takeDamageThisTurn();
                    turns.push({
                        turn: t + 1, preyAction: preyActionLabel, preyActionType, userCard: card,
                        hit: true, preyEvaded: true,
                        effectiveEvade, preyHpAfter: hp,
                        ...(dmgTaken > 0 ? { playerDamage: dmgTaken } : {})
                    });
                }
            } else {
                // 카드 자체 실패(success_rate 미달) 또는 damage=0 카드.
                const dmgTaken = takeDamageThisTurn();
                turns.push({
                    turn: t + 1, preyAction: preyActionLabel, preyActionType, userCard: card,
                    hit: false, preyHpAfter: hp,
                    ...(dmgTaken > 0 ? { playerDamage: dmgTaken } : {})
                });
            }

            // D-246: turn 끝 시점 stack 스냅샷 — 마지막 push된 turn에 기록 + 별도 events 배열.
            const lastTurn = turns[turns.length - 1];
            if (lastTurn) {
                lastTurn.defenseStack = defenseStack;
                lastTurn.evadeStack = evadeStack;
            }
            stackEvents.push({ turn: t + 1, defenseStack, evadeStack });
        }

        const outcome = terminatedOutcome || (hp <= 0 ? 'victory' : 'prey_fled');
        return {
            outcome, turns, preyHpFinal: hp,
            weaponUsage, armorUsage, playerDamageTaken,
            stackEvents,                                   // D-246: turn별 스택 변화
            defenseCap, evadeCap                           // D-246: UI 표시용 cap (캐릭터 박스 배지 max)
        };
    }

    const api = {
        buildCombatDeck, consumeExtraCard, RUNTIME_CARDS,
        buildHuntDeck, resolveHunt, parseRequirement, parseEvadesByTurn,
        parsePreyActions, findPreyAction,
        CATEGORY_REQ_TOKENS
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.CombatDeck = api;
    }
})(typeof window !== 'undefined' ? window : this);
