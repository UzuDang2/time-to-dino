---
name: ttd-make-data
description: Run time-to-dino data pipeline (`make data`) and verify output. Use after editing the Google Sheet or Notion data, or to regenerate `data/*.json` and `data/data.js` browser bundle. Detects whether Sheets API path ([api]) or xlsx fallback ([xlsx]) was used. Triggered by "데이터 동기화", "make data", "파이프라인 돌려", "시트 변경 반영" phrases.
---

# ttd-make-data — 데이터 파이프라인 실행 + 검증

time-to-dino `make data` 실행 + 결과 판독.

## 실행 절차

1. **Bash 실행** (기본 online 경로):
   ```
   cd "/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino" && make data 2>&1 | tail -20
   ```

2. **출력 판독**:
   - `[api]` prefix → Sheets API 경로 정상 (SSOT 동기 성공)
   - `[xlsx]` prefix → 공개 xlsx 폴백 경로 (서비스 계정 인증 이슈 의심. 보통 `make data` 로그에 `API 실패 → xlsx 폴백 전환` 노출됨)
   - `[export] ... → *.json` 라인들 → 생성된 JSON과 row 수
   - 마지막에 `[ok] 완료`가 나오면 파이프라인 성공
   - `Exception`·`Traceback`·`Error`는 실패 징후, 전체 로그를 다시 뽑아서 원인 파악

3. **한 줄 요약 보고**:
   - 성공/실패
   - `[api]`/`[xlsx]` 중 어느 경로
   - 주요 파일 row 수 (있다면)

## 옵션

- **오프라인**: 네트워크 없거나 시트 접근 불가 시
  ```
  make data-offline
  ```
  `.sheet_cache.xlsx` 캐시로 재생성. 실제 시트 변경은 반영 안 됨.

- **의존성 재설치 필요시** (드묾):
  ```
  make install-deps
  ```

## 사후 작업

- `data/data.js` 브라우저 번들이 재생성되므로, 브라우저 탭은 새로고침 필요
- Git에는 `data/*.json`·`data.js` 변경분이 남음 — 의미 있는 변화면 후속 커밋 대상

## 제약

- 이 스킬은 **읽기·실행·검증까지**. 커밋은 별도 (`ttd-commit-push`).
- 서비스 계정 키 경로: `.secrets/sheets-sa.json` — 없거나 깨졌으면 `[xlsx]`로 자동 폴백. 확인만 하고 진행.
