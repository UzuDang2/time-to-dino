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
→ Google Sheets API(서비스 계정)로 읽어 `data/base_cards.json` 등을 덮어쓰고,
   브라우저 번들 `data/data.js`도 재생성한다. API 키가 없거나 실패하면 공개 xlsx export로 자동 폴백.

### Google Sheets API 세팅 (1회)
D-25부터 primary 경로. Chrome MCP 의존을 줄이고 쓰기까지 지원.

1. GCP 콘솔 → 프로젝트 선택/생성
2. `APIs & Services` → `Enable APIs` → **Google Sheets API** 활성화
3. `IAM & Admin` → `Service Accounts` → 계정 생성 (이름 자유, 역할 없음이어도 됨)
4. 생성된 계정 → `Keys` → `Add Key` → JSON 발급 → `.secrets/sheets-sa.json`에 저장
   - 기본 경로: `.secrets/sheets-sa.json` (이미 `.gitignore` 처리됨)
   - 다른 경로면 `export GOOGLE_SHEETS_SA_KEY=/절대경로.json`
5. 시트 공유: 서비스 계정 이메일(예: `xxx@proj.iam.gserviceaccount.com`)을 시트 공유 메뉴에 **편집자**로 추가
6. 의존성 설치: `make install-deps`
7. 테스트: `make data`

### 시트 쓰기 (API 전용)
```
# 탭 생성
python3 scripts/fetch_data.py --sheet-op=ensure-tab --tab=베이스탐험카드 \
    --headers="id,name,count,effect,detection"

# row 추가 (헤더에 맞춰 매핑)
python3 scripts/fetch_data.py --sheet-op=append-row --tab=베이스탐험카드 \
    --row-json='{"id":"rest","name":"휴식","count":1,"effect":"체력/배고픔 소폭 회복, 소음 최소","detection":-3}'

# row 삭제 (id 매칭 첫 행)
python3 scripts/fetch_data.py --sheet-op=delete-row --tab=베이스탐험카드 \
    --match-col=id --match-val=find_weapon

# 셀 편집
python3 scripts/fetch_data.py --sheet-op=update-cell --tab=베이스탐험카드 \
    --match-col=id --match-val=rest --set-col=detection --set-val=-5
```

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
