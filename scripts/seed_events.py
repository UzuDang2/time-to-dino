#!/usr/bin/env python3
# scripts/seed_events.py
# ─────────────────────────────────────────────────────────────────────
# D-126 (2026-04-28): MVP+ 이벤트/상태이상/신규 아이템 시드.
# 시트(SSOT)에 4개 탭(또는 신규 행)을 직접 채워 넣고, fetch_data.py가
# 이후 들어오면 알아서 json으로 변환한다.
#
# 멱등성: 이미 있는 row는 건너뛰고 없는 것만 append. 헤더가 없으면 생성.
#
# 작업 대상 탭:
#   1) 아이템마스터        — 신규 row 3종 (wood_shard / torn_map / snare_trap)
#   2) 이벤트              — 9종 (id, title, intro, region)
#   3) 이벤트선택지        — 36개 (9 이벤트 × 평균 4선택지)
#   4) 이벤트풀            — 풀 항목 [{id, count}] 객체 배열 (DSL은 풀 id 참조)
#   5) 상태이상            — 3종 (hallucination / poison / poison_bite)
#
# 실행:
#   python3 scripts/seed_events.py            # API 우선, 없으면 에러
#
# 주의:
#   - fetch_data.py의 sheet_ensure_tab / sheet_append_row를 재사용한다.
#   - 헤더 명은 ☆5 디렉터 판단으로 영문 + 한국어 혼용 (기존 시트 톤 일치).
#   - effect_dsl은 effectParser.js / scripts/fetch_data.py의 parse_event_effect와 호환.
# ─────────────────────────────────────────────────────────────────────

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from fetch_data import open_spreadsheet, sheet_ensure_tab  # noqa: E402


# ─── 1) 신규 아이템 3종 ────────────────────────────────────────────────
# 시트 실제 헤더 (확인됨, 'weight' 없음):
#   id, name, category, material_type, grade, size, regions,
#   mergeable, merge_result, disposable, effect, summary, description, durability
ITEM_MASTER_HEADERS = [
    "id", "name", "category", "material_type", "grade", "size",
    "regions", "mergeable", "merge_result", "disposable", "effect",
    "summary", "description", "durability",
]

NEW_ITEMS = [
    {
        "id": "wood_shard",
        "name": "나무 조각",
        "category": "소모품",
        "material_type": "",
        "grade": "1단계",
        "size": "1x1",
        "regions": "",
        "mergeable": "N",
        "merge_result": "",
        "disposable": "Y",
        "effect": "shield_trap",  # 단계 2/3에서 자동 차단 트리거. 단계 1은 보유 + 정보창만.
        "summary": "함정 1회 자동 차단 (소지 시 패시브).",
        "description": "거칠게 부러진 나뭇조각. 손바닥에 거칠게 닿는 결이 묘하게 든든하다.",
        "durability": "",
    },
    {
        "id": "torn_map",
        "name": "찢어진 지도 조각",
        "category": "소모품",
        "material_type": "",
        "grade": "1단계",
        "size": "1x1",
        "regions": "",
        "mergeable": "N",
        "merge_result": "",
        "disposable": "Y",
        "effect": "hint:exit_direction",  # 사용 시 탈출구 방향 힌트 후 소멸.
        "summary": "탈출구 방향을 한 번 알려준다.",
        "description": "물에 번진 잉크와 흙 자국. 한 귀퉁이만 남았지만, 화살표가 분명하다.",
        "durability": "",
    },
    {
        "id": "snare_trap",
        "name": "덫",
        "category": "소모품",
        "material_type": "",
        "grade": "1단계",
        "size": "1x1",
        "regions": "",
        "mergeable": "N",
        "merge_result": "",
        "disposable": "Y",
        "effect": "place_snare",  # 단계 3에서 보스 발동 + 시네마틱.
        "summary": "현재 타일에 설치. 보스가 밟으면 1턴 정지.",
        "description": "녹슨 금속 고리와 팽팽한 줄. 누군가 한참 전에 손봐 둔 솜씨다.",
        "durability": "",
    },
]


# ─── 2) 이벤트 본문 ────────────────────────────────────────────────────
EVENT_HEADERS = ["id", "title", "intro_text", "region"]

EVENTS = [
    {
        "id": "wounded_animal",
        "title": "부상당한 작은 동물",
        "intro_text": "덤불 사이에서 희미한 울음소리가 들린다. 다가가보니 덫에 걸린 작은 동물이 있다.",
        "region": "",
    },
    {
        "id": "bloody_pack",
        "title": "피 묻은 배낭",
        "intro_text": "나무 밑에 낡은 배낭이 버려져 있다. 천에는 마른 피가 묻어 있고, 안쪽에서 희미한 금속 소리가 난다.",
        "region": "",
    },
    {
        "id": "fairy_ring",
        "title": "요정의 고리",
        "intro_text": "색색의 버섯들이 완벽한 원을 이루며 자라고 있다. 이상하게도 그 안쪽만 바람이 멈춘 듯 조용하다.",
        "region": "",
    },
    {
        "id": "weird_cry",
        "title": "기묘한 울음소리",
        "intro_text": "숲 깊은 곳에서 사람의 울음 같은 소리가 들린다. 하지만 그 소리는 너무 일정하고, 너무 가까워지고 있다.",
        "region": "",
    },
    {
        "id": "abandoned_campfire",
        "title": "버려진 모닥불",
        "intro_text": "꺼진 지 얼마 되지 않은 모닥불이 있다. 재 속에는 아직 붉은 열기가 남아 있다. 누군가 방금 전까지 여기 있었다.",
        "region": "",
    },
    {
        "id": "shaking_bush",
        "title": "흔들리는 덤불",
        "intro_text": "앞쪽 덤불이 심하게 흔들린다. 바람 때문은 아니다. 무언가 숨어 있다.",
        "region": "",
    },
    {
        "id": "broken_signpost",
        "title": "부서진 이정표",
        "intro_text": "낡은 나무 이정표가 땅에 쓰러져 있다. 방향 표시는 반쯤 부러져 있지만, 누군가 일부러 돌려놓은 흔적이 있다.",
        "region": "",
    },
    {
        "id": "suspicious_berry_tree",
        "title": "수상한 열매나무",
        "intro_text": "낮은 가지에 붉은 열매가 가득 열려 있다. 이상하게도 주변에는 벌레도, 새도 보이지 않는다.",
        "region": "",
    },
    {
        "id": "old_hunter_trap",
        "title": "낡은 사냥꾼의 덫",
        "intro_text": "나뭇잎 아래에 금속성 빛이 비친다. 오래된 사냥꾼의 덫이다. 아직 작동하는 것 같다.",
        "region": "",
    },
]


# ─── 3) 이벤트선택지 ───────────────────────────────────────────────────
# DSL 토큰 (effectParser.js와 호환되도록 정의):
#   item_grant:<id>*<n>
#   item_grant_pool:<pool_id>*<n>            — 풀은 이벤트풀 탭 참조
#   item_consume_filter:<filter>*<n>         — filter는 카테고리/타입(예: 음식)
#   stat_delta:<stat><sign><amount>          — health, hunger
#   detection_delta:<sign><amount>           — % 단위
#   status_apply:<id>[*<dur>]
#   hint:<kind>                              — exit_direction / boss_direction / boss_position / tile_reveal / wrong_exit_direction
#   force_random_move
#   nothing
#   chance_grant:<pct>,<id>*<n>
#   chance_grant_status_on_item:<pct>,<status>,<item_id>   — 채집 결과 N개 중 1개에 상태이상 부여
#   chance_stat:<pct>,<stat><sign><amount>
#   chance_status:<pct>,<status>[*<dur>]
#   chance_hint:<pct>,<kind>
#   branches:<pct>|<dsl1>||<pct>|<dsl2>      — 확률 분기. 합 100 권장.
#
# 체인은 ';'.

EVENT_CHOICE_HEADERS = ["event_id", "choice_id", "label", "effect_dsl"]

EVENT_CHOICES = [
    # 1) 부상당한 작은 동물
    ("wounded_animal", "help",   "도와준다",   "item_grant:berry*1;hint:exit_direction"),
    ("wounded_animal", "hunt",   "사냥한다",   "item_grant:meat*1;detection_delta:+10"),
    ("wounded_animal", "ignore", "무시한다",   "nothing"),

    # 2) 피 묻은 배낭
    ("bloody_pack", "search_carefully", "조심스럽게 뒤진다",
     "item_grant_pool:bloody_pack_common*1;chance_stat:30,health-1"),
    ("bloody_pack", "grab_quickly", "급히 챙긴다",
     "item_grant_pool:bloody_pack_common*2;detection_delta:+15;chance_grant:30,torn_map*1"),
    ("bloody_pack", "pass", "그냥 지나간다", "nothing"),

    # 3) 요정의 고리
    ("fairy_ring", "eat_mushroom", "버섯을 먹는다",
     "branches:50|stat_delta:hunger+4||50|status_apply:hallucination*3"),
    ("fairy_ring", "harvest", "버섯을 채집한다",
     "item_grant:mushroom*2;chance_grant_status_on_item:20,poison_bite,mushroom"),
    ("fairy_ring", "enter_ring", "고리 안으로 들어간다",
     "hint:exit_direction;detection_delta:+20"),
    ("fairy_ring", "avoid", "피해서 간다", "nothing"),

    # 4) 기묘한 울음소리
    ("weird_cry", "follow_sound", "소리를 따라간다",
     "branches:60|item_grant_pool:weird_cry_rare*1||40|stat_delta:health-1;detection_delta:+15"),
    ("weird_cry", "watch_hidden", "숨어서 지켜본다",
     "hint:boss_direction;stat_delta:hunger-1"),
    ("weird_cry", "flee_opposite", "반대 방향으로 도망친다",
     "detection_delta:-10;force_random_move"),
    ("weird_cry", "ignore", "무시하고 이동한다",
     "detection_delta:+5"),

    # 5) 버려진 모닥불
    ("abandoned_campfire", "find_food", "남은 음식을 찾는다",
     "item_grant_pool:campfire_food*1;detection_delta:+10"),
    ("abandoned_campfire", "scrape_ash", "재를 뒤져 흔적을 찾는다",
     "branches:50|hint:exit_direction||50|hint:boss_direction;chance_stat:30,health-1"),
    ("abandoned_campfire", "stamp_out", "불씨를 밟아 끈다",
     "detection_delta:-10"),
    ("abandoned_campfire", "pass", "그냥 지나간다", "nothing"),

    # 6) 흔들리는 덤불
    ("shaking_bush", "attack_first", "먼저 공격한다",
     "branches:50|item_grant:meat*1||50|stat_delta:health-1"),
    ("shaking_bush", "throw_food", "먹이를 던진다",
     "item_consume_filter:음식*1;detection_delta:-15;chance_hint:30,exit_direction"),
    ("shaking_bush", "go_around", "조용히 우회한다",
     "stat_delta:hunger-1"),
    ("shaking_bush", "approach", "다가가 확인한다",
     "branches:25|item_grant:meat*1||25|stat_delta:health-1||25|nothing||25|hint:boss_direction"),

    # 7) 부서진 이정표
    ("broken_signpost", "align", "이정표를 맞춰본다",
     "branches:70|hint:exit_direction||30|hint:wrong_exit_direction"),
    ("broken_signpost", "follow_traces", "흔적을 따라간다",
     "item_grant_pool:signpost_loot*1;detection_delta:+10"),
    ("broken_signpost", "pick_shard", "부러진 조각을 챙긴다",
     "item_grant:wood_shard*1"),
    ("broken_signpost", "ignore", "무시한다", "nothing"),

    # 8) 수상한 열매나무
    ("suspicious_berry_tree", "eat", "열매를 먹는다",
     "stat_delta:hunger+5;chance_status:40,poison*3"),
    ("suspicious_berry_tree", "harvest_some", "조금만 채집한다",
     "item_grant:berry*1;chance_grant_status_on_item:20,poison_bite,berry"),
    ("suspicious_berry_tree", "shake_tree", "나무를 흔든다",
     "item_grant:berry*2;detection_delta:+20"),
    ("suspicious_berry_tree", "avoid", "피한다", "nothing"),

    # 9) 낡은 사냥꾼의 덫
    ("old_hunter_trap", "disarm", "해체한다",
     "branches:70|item_grant:snare_trap*1||30|stat_delta:health-1"),
    ("old_hunter_trap", "pass", "피해서 지나간다", "nothing"),
    ("old_hunter_trap", "trigger", "일부러 작동시킨다",
     "detection_delta:+20;hint:tile_reveal"),
]


# ─── 4) 이벤트풀 ───────────────────────────────────────────────────────
# 명세 ☆2: pool 항목은 [{id, count}] 객체 배열로 격상.
# 시트는 한 row에 (pool_id, item_id, count) 하나씩 — 풀별 여러 row.

EVENT_POOL_HEADERS = ["pool_id", "item_id", "count"]

EVENT_POOL = [
    # bloody_pack: 일반 풀
    ("bloody_pack_common", "bandage", 1),
    ("bloody_pack_common", "plant_fiber", 1),
    ("bloody_pack_common", "clean_cloth", 1),
    ("bloody_pack_common", "wood", 1),

    # weird_cry: 희귀 풀
    ("weird_cry_rare", "grilled_crab_skewer", 1),
    ("weird_cry_rare", "grilled_fish_skewer", 1),
    ("weird_cry_rare", "grilled_meat_skewer", 1),
    ("weird_cry_rare", "bandage", 1),

    # campfire_food: 모닥불 음식
    ("campfire_food", "meat_skewer", 1),
    ("campfire_food", "fish_skewer", 1),
    ("campfire_food", "crab_skewer", 1),
    ("campfire_food", "berry", 2),

    # signpost_loot: 이정표 루트
    ("signpost_loot", "wood", 1),
    ("signpost_loot", "plant_fiber", 1),
    ("signpost_loot", "bandage", 1),
]


# ─── 5) 상태이상 카탈로그 (☆3: 3종 fix) ────────────────────────────────
STATUS_HEADERS = ["id", "name", "duration", "tick_effect", "summary", "description"]

STATUSES = [
    {
        "id": "hallucination",
        "name": "환각",
        "duration": 3,
        "tick_effect": "",  # 패시브: 정보 표시 교란. 코드에서 분기.
        "summary": "주변 정보가 뒤섞여 보인다 (3턴).",
        "description": "버섯 향이 감각을 흔든다. 타일과 발자국이 한 박자씩 어긋나 보인다.",
    },
    {
        "id": "poison",
        "name": "독",
        "duration": 3,
        "tick_effect": "chance_stat:30,health-1",
        "summary": "이동 시 30% 확률로 체력 -1 (3턴).",
        "description": "혀끝에 쇠 맛이 남는다. 발걸음마다 속이 뒤집히는 듯하다.",
    },
    {
        "id": "poison_bite",
        "name": "독이 든 한 입",
        "duration": 0,  # 인스턴스 바인딩: 아이템 하나에 부여, 사용 시 health-1.
        "tick_effect": "",
        "summary": "이 아이템을 먹으면 체력 -1.",
        "description": "겉으론 멀쩡하지만, 한 입 무는 순간 알게 될 것이다.",
    },
]


# ─── 시트 쓰기 헬퍼 ───────────────────────────────────────────────────


def _existing_keys(ws, key_cols: list[str]) -> set[tuple[str, ...]]:
    """이미 들어간 row의 (key_cols) 튜플 집합."""
    values = ws.get_all_values()
    if len(values) < 2:
        return set()
    header = values[0]
    idxs = [header.index(c) for c in key_cols if c in header]
    if len(idxs) != len(key_cols):
        return set()
    out = set()
    for row in values[1:]:
        if not any((c or "").strip() for c in row):
            continue
        key = tuple((row[i] if i < len(row) else "").strip() for i in idxs)
        out.add(key)
    return out


def _append_rows(ws, headers: list[str], rows: list[dict], key_cols: list[str]) -> int:
    """헤더 매핑으로 row들을 append. 이미 있는 키는 건너뜀."""
    existing = _existing_keys(ws, key_cols)
    new_rows: list[list] = []
    for r in rows:
        key = tuple(str(r.get(c, "")).strip() for c in key_cols)
        if key in existing:
            print(f"  · skip (이미 있음) {key}")
            continue
        values = [r.get(h, "") for h in headers]
        values = ["" if v is None else v for v in values]
        new_rows.append(values)
    if new_rows:
        ws.append_rows(new_rows, value_input_option="USER_ENTERED")
    return len(new_rows)


def main() -> int:
    sh = open_spreadsheet()
    if sh is None:
        print("[error] 시트 열기 실패 — sheets-sa.json 확인")
        return 1

    # 1) 아이템마스터 신규 행
    print("[1/5] 아이템마스터 — 신규 3종 append")
    ws = sh.worksheet("아이템마스터")
    n = _append_rows(ws, ITEM_MASTER_HEADERS, NEW_ITEMS, ["id"])
    print(f"      → {n}건 추가")

    # 2) 이벤트 탭
    print("[2/5] 이벤트 탭 — ensure + 9종 append")
    ws = sheet_ensure_tab(sh, "이벤트", EVENT_HEADERS)
    n = _append_rows(ws, EVENT_HEADERS, EVENTS, ["id"])
    print(f"      → {n}건 추가")

    # 3) 이벤트선택지 탭
    print("[3/5] 이벤트선택지 탭 — ensure + 36개 append")
    ws = sheet_ensure_tab(sh, "이벤트선택지", EVENT_CHOICE_HEADERS)
    rows = [
        {"event_id": e, "choice_id": c, "label": l, "effect_dsl": d}
        for (e, c, l, d) in EVENT_CHOICES
    ]
    n = _append_rows(ws, EVENT_CHOICE_HEADERS, rows, ["event_id", "choice_id"])
    print(f"      → {n}건 추가")

    # 4) 이벤트풀 탭
    print("[4/5] 이벤트풀 탭 — ensure + pool 항목 append")
    ws = sheet_ensure_tab(sh, "이벤트풀", EVENT_POOL_HEADERS)
    rows = [{"pool_id": p, "item_id": i, "count": c} for (p, i, c) in EVENT_POOL]
    n = _append_rows(ws, EVENT_POOL_HEADERS, rows, ["pool_id", "item_id"])
    print(f"      → {n}건 추가")

    # 5) 상태이상 탭
    print("[5/5] 상태이상 탭 — ensure + 3종 append")
    ws = sheet_ensure_tab(sh, "상태이상", STATUS_HEADERS)
    n = _append_rows(ws, STATUS_HEADERS, STATUSES, ["id"])
    print(f"      → {n}건 추가")

    print("[ok] seed_events 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
