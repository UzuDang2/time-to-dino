---
name: ttd-commit-push
description: Commit and push time-to-dino changes with Korean commit message template + Claude co-author trailer + origin/main push. Use when a game-director iteration completes and changes are ready. Main push is pre-approved via .claude/settings.json. Triggered by "커밋 푸시", "변경사항 반영", "origin에 올려", or at the end of a directing turn.
---

# ttd-commit-push — 커밋 + push 템플릿

time-to-dino 변경사항을 한국어 커밋 메시지로 기록하고 origin/main에 push.

## 실행 절차

1. **상태 확인**:
   ```
   cd "/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino" && git status --short
   ```

2. **분할 판단**:
   - 논리적으로 한 덩어리면 단일 커밋
   - 이질적이면 2~3개로 분할 (예: "데이터 파이프라인 변경" / "게임 로직 변경" / "UI 변경")
   - 애매하면 단일 커밋 + 본문에 소제목으로 정리

3. **민감 파일 필터 (안전장치)**:
   다음 패턴은 **절대 add 금지** (이미 `.gitignore`지만 이중 방어):
   - `.secrets/`, `*.sa.json`, `*-sa.json`, `service-account*.json`, `google-credentials*.json`
   - `.DS_Store`, `data/.sheet_cache.xlsx`
   - `.claude/game-director/` (디렉터 개인 메모리)

4. **파일 add**:
   ```
   git add <구체 파일명 나열>
   ```
   ⚠️ **`git add -A`·`git add .` 금지** — 서비스 계정 키 실수 방지.

5. **커밋 (HEREDOC 포맷)**:
   ```
   git commit -m "$(cat <<'EOF'
   <prefix>: <짧은 요약>

   - 변경 사항 1
   - 변경 사항 2

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```
   - prefix 관례: `feat` / `fix` / `refactor` / `chore` / `docs` / `build`
   - 제목은 한국어 간결, 본문은 불릿
   - 여러 커밋이면 각 단위 명확히

6. **Push**:
   ```
   git push origin main 2>&1 | tail -3
   ```
   (main push는 `.claude/settings.json`에서 자동 허용됨)

7. **결과 한 줄 보고**: `abc..def  main -> main` 성공 또는 실패 사유

## 메모리 갱신 (커밋 전에 먼저 할 것)

변경과 함께 `.claude/game-director/` 메모리도 동기화:

- **`project-state.md`**: 변경점 반영 + 마지막 검증 날짜 갱신
- **`design-decisions.md`**: 새 결정이 있으면 **D-XX append** (기존 번호 중복 금지, 최근 번호 확인 후 +1)
- **`pending.md`**: 완료 항목 이동, 신규 대기 추가

이 메모리 파일들은 `.gitignore`에 의해 git 제외됨 — 커밋 stage에 자동으로 안 들어감 (확인만 하면 됨).

## 제약

- Force push·rebase·amend 금지 (자율 불가)
- 다른 리모트(origin 외)·다른 브랜치 push는 여전히 승인 필요
- 커밋 훅 실패 시 **amend 말고 새 커밋** 만들기 (CLAUDE.md 원칙)
