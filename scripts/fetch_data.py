#!/usr/bin/env python3
# scripts/fetch_data.py
# ────────────────────────────────────────────────────────────────────────
# SSOT 데이터(구글 시트 6탭 + Notion 아이템 DB) → data/*.json 추출 파이프라인.
#
# 원본(읽기 전용):
#   - 시트: https://docs.google.com/spreadsheets/d/1iS4Lmjx32w0Mu527foFtc8pQn3pw6APcQYnvcKdVM9o/
#           탭: 베이스탐험카드 / 1차_확정카드 / 전투카드 / 몬스터 / 사냥감 / 빌딩
#   - Notion 아이템 DB: https://www.notion.so/8c76219106854ea58b6817e6d9bd8042
#
# 산출물(덮어쓰기):
#   - data/base_cards.json       (베이스탐험카드)
#   - data/extra_cards.json      (1차_확정카드)
#   - data/combat_cards.json     (전투카드)
#   - data/monsters.json         (몬스터)
#   - data/prey.json             (사냥감)
#   - data/buildings.json        (빌딩, cost는 파서로 구조화)
#   - data/items.json            (Notion 아이템 DB 스냅샷)
#
# 사용법:
#   python3 scripts/fetch_data.py              # 시트만
#   python3 scripts/fetch_data.py --with-notion-items  # 시트 + 아이템(오프라인 스냅샷 필요)
#
# Notion 아이템은 MCP/API 키 없이 로컬에서 동작해야 하므로, 이 스크립트는
# 이미 리포지토리에 커밋된 data/items.raw.json을 읽어 items.json을 생성한다.
# 최초 시드는 리사가 MCP로 수집해 items.raw.json에 저장해 두었고, 이후
# Notion에서 수정한 내용을 반영하고 싶을 때만 items.raw.json을 갱신하면 된다.
# (상세 절차는 README 하단 또는 '아이템 갱신 가이드' 문서 참고.)
#
# 디자인 메모 — 문자열 파서 방식 채택:
#   `cost`(빌딩), `attack_pattern`(몬스터) 등은 시트에서 자연어로 관리하도록 두고
#   이 파이프라인이 파싱해 구조화 필드를 추가한다. 실패해도 원문(_raw)을 병행
#   저장하므로 게임이 JSON을 읽을 때 폴백 가능.
# ────────────────────────────────────────────────────────────────────────

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

try:
    import openpyxl  # type: ignore
except ImportError:
    sys.stderr.write(
        "openpyxl이 필요합니다. 설치: pip3 install --user openpyxl\n"
    )
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SHEET_XLSX_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1iS4Lmjx32w0Mu527foFtc8pQn3pw6APcQYnvcKdVM9o/export?format=xlsx"
)

# 시트 탭 이름 → 산출 JSON 경로 매핑
# '드롭테이블'은 별도 2-탭 구조(지역×카테고리% + 지역↔아이템 풀)이므로 여기 넣지 않고
# 아래 export_drop_table()에서 개별 처리.
SHEET_TABS = {
    "베이스탐험카드": "base_cards.json",
    "1차_확정카드": "extra_cards.json",
    "전투카드": "combat_cards.json",
    "몬스터": "monsters.json",
    "사냥감": "prey.json",
    "빌딩": "buildings.json",
}

# 드롭테이블 전용 탭 이름
DROP_TABLE_SHEET = "드롭테이블"
REGION_POOL_SHEET = "드롭풀"


# ─── 파서 ───────────────────────────────────────────────────────────────


COST_RE = re.compile(r"([가-힣A-Za-z_][가-힣A-Za-z0-9_ ]*?)\s*x\s*(\d+)")


def parse_cost(raw: str) -> list[dict[str, Any]]:
    """'목재 x10, 끈 x5' → [{material:'목재', count:10}, ...]"""
    if not raw:
        return []
    parts = [p.strip() for p in str(raw).split(",") if p.strip()]
    out: list[dict[str, Any]] = []
    for part in parts:
        m = COST_RE.search(part)
        if not m:
            continue
        material = m.group(1).strip()
        count = int(m.group(2))
        out.append({"material": material, "count": count})
    return out


PATTERN_RE = re.compile(r"([가-힣A-Za-z_][가-힣A-Za-z0-9_ ]*?)\s*\((-?\d+)\)")


def parse_attack_pattern(raw: str) -> list[dict[str, Any]]:
    """'으르렁(0) → 물기(2) → 발톱(3)' → [{move:'으르렁', damage:0}, ...]"""
    if not raw:
        return []
    phases = re.split(r"→|->|→", str(raw))
    out: list[dict[str, Any]] = []
    for phase in phases:
        m = PATTERN_RE.search(phase)
        if not m:
            continue
        move = m.group(1).strip()
        dmg = int(m.group(2))
        out.append({"move": move, "damage": dmg})
    return out


# ─── 유틸 ───────────────────────────────────────────────────────────────


def normalize_cell(v: Any) -> Any:
    """xlsx 셀 값을 JSON 친화적으로 정규화.
    float인데 소수점이 0이면 int로, None은 None으로 유지."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        return v.strip()
    return v


def sheet_to_rows(ws) -> list[dict[str, Any]]:
    """첫 행을 키로 쓰는 dict 리스트로 변환."""
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header = next(rows_iter)
    except StopIteration:
        return []
    header = [normalize_cell(h) for h in header]
    out: list[dict[str, Any]] = []
    for row in rows_iter:
        if all(c is None for c in row):
            continue
        obj = {}
        for key, val in zip(header, row):
            if key is None:
                continue
            obj[str(key)] = normalize_cell(val)
        out.append(obj)
    return out


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ─── 엔드포인트 ─────────────────────────────────────────────────────────


def fetch_sheet(xlsx_url: str, out_path: Path) -> None:
    print(f"[fetch] downloading xlsx from google sheets...")
    req = urllib.request.Request(
        xlsx_url,
        headers={"User-Agent": "ttd-fetch-data/1.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(data)
    print(f"[fetch] saved {len(data)} bytes → {out_path}")


def export_sheets(xlsx_path: Path) -> None:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    existing = set(wb.sheetnames)
    for tab_name, out_file in SHEET_TABS.items():
        if tab_name not in existing:
            print(f"[warn] 탭 '{tab_name}' 이 시트에 없음 — 스킵")
            continue
        rows = sheet_to_rows(wb[tab_name])

        # 빌딩: cost 파서 + _raw
        if tab_name == "빌딩":
            for row in rows:
                raw_cost = row.get("cost", "")
                row["cost_raw"] = raw_cost
                row["cost"] = parse_cost(raw_cost or "")

        # 몬스터: attack_pattern 파서 + _raw
        if tab_name == "몬스터":
            for row in rows:
                raw = row.get("attack_pattern", "")
                row["attack_pattern_raw"] = raw
                row["attack_pattern"] = parse_attack_pattern(raw or "")

        out_path = DATA_DIR / out_file
        write_json(out_path, rows)
        print(f"[export] {tab_name:12s} → {out_path.name}  ({len(rows)} rows)")


# ─── 드롭테이블: 시트 2탭 → drop_table.json ───────────────────────────
#
# 기존 dropTable.js의 DROP_TABLE / REGION_ITEM_POOL 하드코딩 값을
# 시트로 옮기기 위한 파서. 시트에 아래 두 탭이 있어야 한다.
#
#   탭 '드롭테이블' (지역별 카테고리 확률)
#     region | env | food | none
#     숲     | 50  | 25   | 25
#     ...
#
#   탭 '드롭풀' (지역×카테고리 → 아이템 타입 CSV)
#     region | category | items
#     숲     | env      | branch
#     숲     | food     | mushroom
#     덤불   | env      | stem
#     ...
#
# 산출물: data/drop_table.json
#   {
#     "regions": { "숲": { "env":50, "food":25, "none":25 }, ... },
#     "pool":    { "숲": { "env":["branch"], "food":["mushroom"] }, ... }
#   }


def export_drop_table(xlsx_path: Path) -> None:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    existing = set(wb.sheetnames)

    regions: dict[str, dict[str, int]] = {}
    pool: dict[str, dict[str, list[str]]] = {}

    # 1) 확률 탭
    if DROP_TABLE_SHEET in existing:
        for row in sheet_to_rows(wb[DROP_TABLE_SHEET]):
            region = row.get("region") or row.get("지역")
            if not region:
                continue
            regions[str(region)] = {
                "env": int(row.get("env") or 0),
                "food": int(row.get("food") or 0),
                "none": int(row.get("none") or 0),
            }
    else:
        print(f"[warn] 탭 '{DROP_TABLE_SHEET}' 이 시트에 없음 — 스킵")

    # 2) 풀 탭
    if REGION_POOL_SHEET in existing:
        for row in sheet_to_rows(wb[REGION_POOL_SHEET]):
            region = row.get("region") or row.get("지역")
            category = row.get("category") or row.get("카테고리")
            items_raw = row.get("items") or row.get("아이템") or ""
            if not region or not category:
                continue
            items = [s.strip() for s in str(items_raw).split(",") if s.strip()]
            pool.setdefault(str(region), {}).setdefault(str(category), []).extend(items)
    else:
        print(f"[warn] 탭 '{REGION_POOL_SHEET}' 이 시트에 없음 — 스킵")

    if not regions and not pool:
        # 시트에 아직 탭이 없으면 drop_table.json을 만들지 않는다 (기존 dropTable.js 유지).
        print("[info] drop_table.json 생성 스킵 (시트 탭 없음)")
        return

    payload = {"regions": regions, "pool": pool}
    out_path = DATA_DIR / "drop_table.json"
    write_json(out_path, payload)
    print(f"[export] drop_table  → {out_path.name}  ({len(regions)} regions, {sum(len(v) for v in pool.values())} pool entries)")


# ─── Notion 아이템: raw → items.json ───────────────────────────────────


def parse_effect_dsl(raw: str) -> dict[str, Any]:
    """'사용 효과' DSL을 게임 런타임이 먹기 좋은 구조로 파싱.

    DSL은 effectParser.js의 문법과 동일:
        'hunger+1'                  → 스탯 +1
        'spawn_card:throw'          → 전투 카드 추가
        'hunger+1;health+1'         → 체인
        ''/'미정'/'효과 없음'/'-'   → usable=False

    반환: { usable: bool, actions: [...], raw: str }
    런타임 JS 파서와 입력 규약이 일치하므로 둘 중 어느 쪽을 써도 된다.
    """
    s = str(raw or "").strip()
    if not s or s in {"미정", "효과 없음", "효과없음", "tbd", "TBD", "-"}:
        return {"usable": False, "actions": [], "raw": s}

    tokens = [t.strip() for t in s.split(";") if t.strip()]
    actions: list[dict[str, Any]] = []
    for tok in tokens:
        m_spawn = re.fullmatch(r"spawn_card\s*:\s*([A-Za-z0-9_\-]+)", tok)
        if m_spawn:
            actions.append({"type": "spawn_card", "cardId": m_spawn.group(1)})
            continue
        m_stat = re.fullmatch(r"([a-zA-Z_]+)\s*([+\-])\s*(\d+)", tok)
        if m_stat:
            delta = int(m_stat.group(3))
            if m_stat.group(2) == "-":
                delta = -delta
            actions.append({"type": "stat", "stat": m_stat.group(1).lower(), "delta": delta})
            continue
        # 인식 못한 토큰은 조용히 무시 (UI에서 raw 노출은 유지)

    return {"usable": len(actions) > 0, "actions": actions, "raw": s}


# ─── id 매핑 (Notion 한글 이름 ↔ 런타임 영문 key) ──────────────────────
#
# D-24: 머지·조합 통합 시스템에서 런타임은 영문 id(`stone`, `branch` …)로
# 아이템을 다루고, Notion DB는 한글 title(`돌맹이`, `나뭇가지` …)을 쓴다.
# 이 테이블이 두 축을 잇는 단일 진실의 원천. `inventory.js::ITEMS` 키와 정확히 1:1.
# 신규 아이템 추가 시 양쪽에 함께 등록.

ITEM_NAME_TO_ID: dict[str, str] = {
    # 1단계 (파밍)
    "돌맹이": "stone",
    "나뭇가지": "branch",
    "질긴줄기": "stem",
    "버섯": "mushroom",
    "산딸기": "berry",
    # 2단계 (조합)
    "목재": "wood",
    "식물 섬유(끈)": "plant_fiber",
    "식물 섬유": "plant_fiber",  # 괄호 주석 스트립 후 동의어
    "깨끗한 천": "clean_cloth",
    "붕대": "bandage",
}


def lookup_item_id(name_or_url: str, by_url: dict[str, str]) -> str | None:
    """이름 또는 Notion URL로 런타임 id를 찾는다.
    relation이 URL 배열로 오므로 by_url 도움이 필요하다."""
    if not name_or_url:
        return None
    s = str(name_or_url).strip()
    # URL 형태면 by_url에서 역추적
    if s.startswith("http"):
        return by_url.get(s)
    # 이름이면 직접
    return ITEM_NAME_TO_ID.get(s)


# ─── 조합법 DSL 파서 ───────────────────────────────────────────────────
#
# 예시 입력: "나뭇가지 + 나뭇가지 → 목재 / 목재 + 목재 → 튼튼한 목재(고급)"
# 각 slash-분절에서 `재료 + 재료 [+ 재료…] → 결과물` 패턴을 추출.
# "x3"·"x5" 수량 표기(`억센 풀 x3 → 끈 x1`)는 이번 버전에서 **무시**하고
# 기본 N=2 머지/2종 조합만 다룬다 — 3종 이상 및 수량 파싱은 후속 확장.
#
# 반환: (ingredients_names: list[str], result_name: str) 튜플 리스트
#
# 괄호 주석("(고급)", "(치료소 1단계 이상)")은 결과물에서 벗겨낸다.

COMBO_SEGMENT_RE = re.compile(
    r"([^/]+?)\s*(?:→|->)\s*([^/]+?)(?:\s*/|\s*$)"
)
PAREN_TRAIL_RE = re.compile(r"\s*\([^)]*\)\s*$")
QUANTITY_RE = re.compile(r"\s*x\s*\d+\s*$", re.IGNORECASE)


def _strip_item_name(s: str) -> str:
    """'튼튼한 목재(고급)' → '튼튼한 목재', '끈 x1' → '끈'"""
    if not s:
        return ""
    s = str(s).strip()
    s = PAREN_TRAIL_RE.sub("", s)
    s = QUANTITY_RE.sub("", s)
    return s.strip()


def parse_combo_recipe(raw: str) -> list[tuple[list[str], str]]:
    """Notion `조합법` 텍스트를 (ingredients, result) 튜플 리스트로 파싱."""
    if not raw:
        return []
    out: list[tuple[list[str], str]] = []
    # slash 단위로 자른 뒤 각 분절에서 → 좌우를 추출
    for segment in str(raw).split("/"):
        seg = segment.strip()
        if "→" not in seg and "->" not in seg:
            continue
        # 정규식보단 단순 split이 안전
        left, _, right = seg.partition("→")
        if not right:
            left, _, right = seg.partition("->")
        if not left or not right:
            continue
        ingredients = [_strip_item_name(x) for x in left.split("+")]
        ingredients = [x for x in ingredients if x]
        result = _strip_item_name(right)
        if not ingredients or not result:
            continue
        out.append((ingredients, result))
    return out


def transform_notion_items(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """MCP notion-fetch 응답의 properties dict 배열을 게임이 쓰기 좋은 형태로 가공.

    Notion 체크박스는 '__YES__'/'__NO__' 문자열로 오고, 멀티셀렉트는 list[str].
    여기서 Boolean/lowercase 타입으로 정리하되, 원본 구조는 크게 깨지 않는다.
    '사용 효과' rich_text는 파싱해 effect 구조를 덧붙인다 (원본도 유지).
    D-24: 머지·조합 통합 시스템용 필드 추가.
    """
    # URL → id 역인덱스 (relation 해석용)
    by_url: dict[str, str] = {}
    for props in raw:
        url = props.get("url")
        name = props.get("이름") or props.get("name")
        if url and name:
            rid = ITEM_NAME_TO_ID.get(name)
            if rid:
                by_url[url] = rid

    out = []
    for props in raw:
        item = dict(props)

        # boolean 정규화
        for bkey in ("머지 가능", "일회용"):
            v = item.get(bkey)
            if v == "__YES__":
                item[bkey] = True
            elif v == "__NO__":
                item[bkey] = False
            elif v is None:
                item[bkey] = False

        # 이름을 id-ish 키 'name'으로도 노출 (영문 접근용)
        if "이름" in item and "name" not in item:
            item["name"] = item["이름"]

        # D-24: 런타임 id (영문 key) 노출
        name = item.get("이름") or item.get("name")
        rid = ITEM_NAME_TO_ID.get(name) if name else None
        if rid:
            item["id"] = rid

        # D-24: 머지 결과물 id (자기참조 relation[0] → 이름 → id)
        # Notion의 '결과물' relation은 자기참조 페이지 URL 배열. 첫 원소가 2단계 결과물.
        result_urls = item.get("결과물") or []
        merge_result_id: str | None = None
        if isinstance(result_urls, list) and result_urls:
            first = result_urls[0]
            merge_result_id = by_url.get(first)
        item["merge_result"] = merge_result_id
        # 편의: merge_enabled는 '머지 가능' + merge_result 유효 둘 다 요구
        item["merge_enabled"] = bool(item.get("머지 가능")) and merge_result_id is not None

        # 사용 효과 파싱 (Notion rich_text 원문 → 구조화)
        effect_raw = item.get("사용 효과", "")
        item["effect"] = parse_effect_dsl(effect_raw)

        out.append(item)

    # 아이템 ID(ITM-1 …) 순 정렬 시도
    def _key(it):
        raw = it.get("아이템 ID", "")
        m = re.search(r"(\d+)$", str(raw))
        return int(m.group(1)) if m else 9999

    out.sort(key=_key)
    return out


def build_combos_from_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """아이템들의 `조합법` 텍스트를 모두 파싱해 전역 combos 리스트 생성.

    D-24 정책:
    - 2종 이상 재료만 허용 (머지는 같은 재료 2개 = combos에도 등장 가능; 둘 다 지원).
    - 괄호 주석 · 수량 표기는 무시.
    - 재료/결과 이름이 ITEM_NAME_TO_ID에 없으면 스킵(경고).
    - 중복 레시피는 제거(ingredients sort + result 키).
    """
    seen: set[tuple[tuple[str, ...], str]] = set()
    combos: list[dict[str, Any]] = []
    for it in items:
        recipe_raw = it.get("조합법", "") or ""
        for ingredients, result in parse_combo_recipe(recipe_raw):
            ing_ids: list[str] = []
            bad = False
            for name in ingredients:
                rid = ITEM_NAME_TO_ID.get(name)
                if not rid:
                    print(f"[warn] 조합 재료 미매핑: '{name}' (from {it.get('이름')})")
                    bad = True
                    break
                ing_ids.append(rid)
            if bad:
                continue
            result_id = ITEM_NAME_TO_ID.get(result)
            if not result_id:
                print(f"[warn] 조합 결과 미매핑: '{result}' (from {it.get('이름')})")
                continue
            key = (tuple(sorted(ing_ids)), result_id)
            if key in seen:
                continue
            seen.add(key)
            combos.append({"ingredients": ing_ids, "result": result_id})
    return combos


def export_items() -> None:
    raw_path = DATA_DIR / "items.raw.json"
    if not raw_path.exists():
        print(
            f"[warn] {raw_path} 없음 — items.json 생성 스킵. "
            "Notion 아이템을 갱신하려면 리사/요한이 MCP로 items.raw.json을 업데이트해야 함."
        )
        return
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    items = transform_notion_items(raw)
    out_path = DATA_DIR / "items.json"
    write_json(out_path, items)
    print(f"[export] items       → {out_path.name}  ({len(items)} items)")

    # D-24: 조합 레시피 — Notion `조합법` 텍스트 전역 파싱 → combos.json
    combos = build_combos_from_items(items)
    combos_path = DATA_DIR / "combos.json"
    write_json(combos_path, combos)
    print(f"[export] combos      → {combos_path.name}  ({len(combos)} recipes)")


# ─── main ──────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--skip-sheet",
        action="store_true",
        help="시트 다운로드 건너뛰기 (오프라인 — 마지막 xlsx 캐시 사용)",
    )
    ap.add_argument(
        "--no-items",
        action="store_true",
        help="items.json 생성 건너뛰기",
    )
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    xlsx_cache = DATA_DIR / ".sheet_cache.xlsx"

    if not args.skip_sheet:
        try:
            fetch_sheet(SHEET_XLSX_URL, xlsx_cache)
        except Exception as e:
            print(f"[error] 시트 다운로드 실패: {e}")
            if not xlsx_cache.exists():
                return 1
            print("[warn] 기존 캐시로 진행")
    else:
        if not xlsx_cache.exists():
            print(f"[error] --skip-sheet 지정됐지만 캐시({xlsx_cache})가 없음")
            return 1

    export_sheets(xlsx_cache)
    export_drop_table(xlsx_cache)

    if not args.no_items:
        export_items()

    # 브라우저 로더용 data.js 생성 (file:// 환경에서 fetch 없이 사용)
    export_data_js()

    print("[ok] 완료")
    return 0


# ─── 브라우저 로더(data.js) ─────────────────────────────────────────────


BROWSER_BUNDLE_KEYS = {
    "base_cards.json": "BASE_CARDS",
    "extra_cards.json": "EXTRA_CARDS",
    "combat_cards.json": "COMBAT_CARDS",
    "monsters.json": "MONSTERS",
    "prey.json": "PREY",
    "buildings.json": "BUILDINGS",
    "items.json": "ITEMS",
    "drop_table.json": "DROP_TABLE",
    "combos.json": "COMBOS",  # D-24: 머지·조합 통합 시스템
}


def export_data_js() -> None:
    """data.js — 전역 객체 `TTD_DATA`를 심어 <script>로 로드 가능하게."""
    bundle: dict[str, Any] = {}
    for filename, key in BROWSER_BUNDLE_KEYS.items():
        path = DATA_DIR / filename
        if not path.exists():
            bundle[key] = []
            continue
        bundle[key] = json.loads(path.read_text(encoding="utf-8"))

    js_lines = [
        "// data/data.js — AUTO-GENERATED by scripts/fetch_data.py",
        "// 원본 편집 금지. 시트/Notion을 수정한 뒤 `make data`로 재생성할 것.",
        "window.TTD_DATA = " + json.dumps(bundle, ensure_ascii=False, indent=2) + ";",
        "",
    ]
    out = DATA_DIR / "data.js"
    out.write_text("\n".join(js_lines), encoding="utf-8")
    print(f"[export] browser bundle → {out.name}")


if __name__ == "__main__":
    raise SystemExit(main())
