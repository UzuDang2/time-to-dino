# time-to-dino

카드 기반 서바이벌 모험 게임.

## 데이터 편집 & 반영

**SSOT(원본) 위치**
- 게임 수치(카드/몬스터/사냥감/빌딩/전투): 구글 시트
  https://docs.google.com/spreadsheets/d/1iS4Lmjx32w0Mu527foFtc8pQn3pw6APcQYnvcKdVM9o/edit
- 아이템 DB: Notion
  https://www.notion.so/8c76219106854ea58b6817e6d9bd8042

시트의 6개 탭(`베이스탐험카드`, `1차_확정카드`, `전투카드`, `몬스터`, `사냥감`, `빌딩`)과
Notion 아이템 DB는 각각 `data/*.json`으로 스냅샷되며, 게임은 `data/data.js` 번들을 통해 이를 읽는다.

### 시트를 고쳤을 때 (공통)
```
make data
```
→ 구글에서 시트 xlsx를 받아 `data/base_cards.json` 등 6개를 덮어쓰고,
   브라우저 번들 `data/data.js`도 재생성한다. 브라우저에서 새로고침하면 반영됨.

### Notion 아이템 DB를 고쳤을 때
Notion은 로컬에서 직접 당겨올 수 없으므로 2단계다:

1. 리사(Claude)에게 "아이템 DB 스냅샷 갱신"을 요청 → `data/items.raw.json` 업데이트
2. `make data`

### 오프라인(네트워크 없음)
```
make data-offline
```
→ 시트 다운로드는 건너뛰고, 마지막 캐시(`data/.sheet_cache.xlsx`)로만 JSON을 다시 생성한다.

## 파일 구조 요약
- `index.html` — 게임 진입점. `data/data.js`를 스크립트로 로드.
- `mapGenerator.js` / `boss.js` / `inventory.js` / `dropTable.js` — 게임 로직 모듈.
- `scripts/fetch_data.py` — 데이터 파이프라인 (시트 xlsx → JSON → data.js 번들).
- `data/` — 파이프라인이 쓰는 출력물. 사람이 직접 편집하지 않는다(`items.raw.json` 제외).
- `Makefile` — `make data` / `make data-offline` 바로가기.

## 디자인 메모
- 시트의 `cost`(빌딩), `attack_pattern`(몬스터) 같은 자연어 필드는 파이썬 파서가
  구조화(`[{material, count}]`, `[{move, damage}]`)해 JSON에 실어 준다.
  실패에 대비해 원문은 `*_raw` 필드로 병행 저장한다.
- `data/data.js`는 브라우저 전역 `window.TTD_DATA`에 모든 번들(`BASE_CARDS`, `EXTRA_CARDS`,
  `COMBAT_CARDS`, `MONSTERS`, `PREY`, `BUILDINGS`, `ITEMS`)을 주입한다.
- Notion 아이템 DB(카드/몬스터 DB 포함)는 Notion에서 계속 문서로 유지하지만, 게임은 시트와
  `items.raw.json`만 읽는다. Notion은 레퍼런스 역할.
