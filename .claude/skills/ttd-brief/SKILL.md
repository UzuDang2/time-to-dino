---
name: ttd-brief
description: Load time-to-dino game-director session context — 5 memory files + git status + recent commits. Use at the start of any time-to-dino work to restore context before deciding or implementing. Triggered by phrases like "TTD 컨텍스트 로드", "프로젝트 상태 파악", "이어서 작업", or when game-director is invoked without prior context.
---

# ttd-brief — game-director 세션 시작 루틴

time-to-dino 프로젝트 작업 전 컨텍스트 복원.

## 실행 절차

1. **메모리 5파일 병렬 로드** (Read tool):
   - `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino/.claude/game-director/README.md`
   - `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino/.claude/game-director/project-state.md`
   - `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino/.claude/game-director/design-decisions.md`
   - `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino/.claude/game-director/pending.md`
   - `/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino/.claude/game-director/notion-index.md`

2. **git 상태** (Bash, 한 번에):
   ```
   cd "/Users/yohanoh/Library/Mobile Documents/com~apple~CloudDocs/time-to-dino" && git status --short && echo "---" && git log --oneline -5
   ```

3. **한 줄 요약을 메인 응답에 포함**:
   - 진행 중·in-progress 항목 (pending.md)
   - 마지막 커밋 해시 + 제목
   - 요한 측 대기 작업 개수
   - 최근 결정(design-decisions 마지막 D-XX)

4. 이후 요한 지시에 따라 작업 진입. 이 스킬은 **컨텍스트 로드만** 담당. 실제 구현은 호출한 쪽에서 진행.

## 주의

- 메모리 파일 없을 수 있음 (`pending.md`/`design-decisions.md` 미생성 등) → 해당 파일 Read 실패는 무시하고 나머지 진행
- 메모리 읽기 이후 "의심스러우면 실물 재확인" 원칙 유지 (`data/items.json`, `git log`, `notion-fetch` 등)
- 이 스킬은 read-only. 파일 수정·커밋 금지
