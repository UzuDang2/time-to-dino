# notion-index.md

타임투다이노 Notion 워크스페이스 페이지·DB 인덱스. 자연어 지시("사냥감 DB 봐줘", "보스 페이지 수정") → 여기서 ID 조회 → 즉시 fetch/update.

> Notion 한국어 페이지명을 기준으로 정렬. 같은 자료의 page id(`https://www.notion.so/<id>` 형태)와, DB의 경우 `data_source_url`(검색·쿼리 시 필요)을 함께 적어둔다.
> page id 32자는 dash 없이 표기(URL 그대로 fetch 가능). data source는 `collection://` prefix 그대로.

---

## 메인 기획 페이지

| 페이지 | page id |
|---|---|
| 🕹️ 타임투다이노 (루트) | `8b5bf9e1c942403faa905f7bccd29a00` |
| 구현기록 | `34cadc7c6970808ba958f09950e14c3c` |

## 서브 페이지

| 페이지 | page id |
|---|---|
| 🎒 가방 시스템 (인벤토리) | `347adc7c697081b08d17f286497f4581` |
| 전투 | `34badc7c697080349de0e1799560de04` |
| 베이스캠프 | `34fadc7c697080379b78f153799ed0e0` |

## 데이터베이스 (DB)

| DB 이름 | page id | data_source_url |
|---|---|---|
| 베이스 카드목록 | `b211f71d62b34526a1f9a6a52ad14a91` | `collection://f9e2eee2-4b0b-4ab7-933b-2667848ccd97` |
| 1차 확장 카드 | `6819364554104bb4a2ed8a28be075f41` | `collection://f1e0b908-1c3f-4ac7-bd0f-8b5c12f30740` |
| 전투 카드 | `4f40a088ae044bd0be6b8fa13535d135` | `collection://b56b300c-aa22-445c-91ef-bf90cccd206a` |
| 몬스터 | `876c475a9bc64917bfde4d9e4a0b117c` | `collection://2e7331c3-35f3-48ab-a554-8255da46c835` |
| 사냥감 | `3cf3ae8c73264fff8a37c3af11bf165b` | `collection://31956230-61e5-4deb-be23-9a98ac745d8e` |
| 🎒 아이템 (레거시 SSOT) | `8c76219106854ea58b6817e6d9bd8042` | `collection://83c97925-dcba-405f-8e9d-83488270028d` |
| 건축물 | `61057e4b7c41458eb49270935e39d199` | `collection://e34970dd-8218-4e8e-94ea-cbd765eb79d3` |
| 퀘스트 | `65d1a25a10ba4be898fcc13924997a21` | `collection://dd2140df-5852-432f-b5ac-dbd9caf6bf23` |
| 타일 | `9e6ef274d35d428481fc7e34760fb1af` | `collection://e3fa2d2b-d142-4bbf-a184-80a9d539efaa` |
| 개념 | `a1bd487bc2554f26a63572385fb54ef7` | `collection://184dfd71-846c-4e72-a979-a703aab28252` |

---

## 데이터 흐름·SSOT 위치 (수정 시 주의)

| 영역 | 런타임 SSOT | 비고 |
|---|---|---|
| 아이템 수치(크기/효과/카테고리) | **구글 시트 `아이템마스터`** → `data/items.json` | D-30부터 시트 SSOT. Notion 🎒 아이템 DB는 **서사·레퍼런스 보관용 레거시**. |
| 사냥감 수치(hp/공격/방어/회피/턴 행동) | **구글 시트 `사냥감`** → `data/prey.json` | Notion 사냥감 DB도 같이 운영 중이지만 시트가 SSOT. |
| 무기 | **구글 시트 `무기`** → `data/weapons.json` | |
| 방어구 | **구글 시트 `방어구`** → `data/armors.json` | D-72 신설. |
| 전투 카드 | **구글 시트 `전투카드`** → `data/combat_cards.json` | |
| 조합 레시피 | **구글 시트 `조합레시피`** → `data/combos.json` | |
| 사냥감 행동 풀 | **구글 시트 `사냥감행동`** → 합쳐서 `data/data.js` | D-108 신설. |

> 시트→json 추출은 `scripts/fetch_data.py` (`make data` 한 번에 실행). Notion DB는 `items.raw.legacy.json`만 과거 스냅샷이 있고, 그 외 DB(사냥감/카드/몬스터 등)는 시트 도입 후 직접 동기화 안 됨.

---

## 자주 쓰는 도구 호출 패턴

- 페이지 읽기: `mcp__notion__notion-fetch`에 page id 또는 URL 통째로.
- DB 검색: `mcp__notion__notion-search`에 `data_source_url` 지정하면 그 DB 안에서만 검색.
- 페이지 수정: `mcp__notion__notion-update-page` (개별 property 갱신).
- 댓글 달기: `mcp__notion__notion-create-comment`.
- 신규 row 추가: `mcp__notion__notion-create-pages` (parent를 data source로).
