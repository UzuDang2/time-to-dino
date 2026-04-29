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

1.5. **🚧 디렉터 메모리 동기화 — 블로킹 체크포인트** (코드 변경이 있다면):
   - `tail -3 .claude/game-director/design-decisions.md` 로 마지막 D-XX 확인.
   - 이번 세션에서 새 D 결정이 생겼는데 메모리에 없으면 **여기서 멈추고** append.
     - `design-decisions.md` 끝에 새 D-XX 한 단락(결정/구현/검증/파일).
     - `pending.md` 완료 항목 이동, 신규 대기 추가.
     - `project-state.md` 마지막 검증 날짜 갱신.
   - 메모리 갱신 안 한 채로 push까지 가면 다음 세션의 `ttd-brief`가 **stale 상태로 출발**한다 — 회피 필수.
   - 메모리 파일은 `.gitignore`라 git stage엔 안 올라감 — 커밋과 무관하게 갱신만 하면 됨.

2. **분할 판단**:
   - **D-XX 단위가 1차 분할 기준** — 1 D = 1 commit이 가장 깔끔 (D-162~D-168 사례).
   - 작은 데이터 튜닝(예: D-164 밸런스)은 단독 `chore(data):` 커밋 OK.
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

6. **Push 단계 — 호출자 구분**:
   - **메인(최상위) 에이전트에서 호출**: `git push origin main` 실행.
     `.claude/settings.json`의 `Bash(git push origin main:*)` 허용 규칙으로 자동 통과.
   - **서브 에이전트(game-director 등) 내부에서 호출**: **push 시도 말 것.**
     서브 에이전트의 main 직접 push는 permission 규칙과 별개의 상위 보안 레이어(SubagentDefaultBranchPush)가 막는다. 시도하면 SECURITY WARNING 뜨고 실패.
     대신 커밋 해시만 보고에 포함 → 메인이 후속 push. 메인은 서브 응답에서 "커밋 완료 + push 대기" 신호를 받으면 자동으로 `git push origin main`을 실행하도록 이미 학습되어 있다 (`~/.claude/projects/.../memory/policy_ttd_subagent_push.md`).

7. **결과 한 줄 보고**: 메인이면 `abc..def  main -> main`, 서브면 "커밋 `abc1234` 로컬에 있음, push는 메인이 후속".

## 메모리 갱신

→ 절차 **1.5단계**(블로킹 체크포인트)에서 처리. 그 단계를 건너뛰면 안 된다.

## 제약

- Force push·rebase·amend 금지 (자율 불가)
- 다른 리모트(origin 외)·다른 브랜치 push는 여전히 승인 필요
- 커밋 훅 실패 시 **amend 말고 새 커밋** 만들기 (CLAUDE.md 원칙)
