#!/bin/bash

# ============================================
# Ralph Loop — expense-saas 프론트 전면 전환(FastAPI 커토버) 자동 진행
# 사용법: ./ralph.sh [최대반복횟수]
# 예시:   ./ralph.sh 20
#
# aquavalley/ralph.sh 패턴 이식. RALPH_PRD / RALPH_PROMPT /
# RALPH_MODEL / RALPH_TAG / RALPH_BRANCH 환경변수로 다른 작업 셋에 재사용 가능.
# ============================================

MAX_ITERATIONS=${1:-20}
PRD_FILE="${RALPH_PRD:-PRD_FRONTEND_CUTOVER.md}"
CLAUDE_PROMPT="${RALPH_PROMPT:-scripts/ralph/CLAUDE_FRONTEND_CUTOVER.md}"
MODEL="${RALPH_MODEL:-claude-sonnet-5}"
RALPH_TAG="${RALPH_TAG:-cutover}"
WORK_BRANCH="${RALPH_BRANCH:-20260717-frontend-cutover}"
LOG_FILE="ralph_log_${RALPH_TAG}_$(date +%Y%m%d_%H%M%S).txt"
PID_FILE="ralph_${RALPH_TAG}.pid"

echo "$$" > "$PID_FILE"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Ralph Loop 시작 (최대 ${MAX_ITERATIONS}회 / model=${MODEL})"
log "📋 로그 파일: $LOG_FILE"
log "📌 PRD 파일: $PRD_FILE"
log "🛑 중단하려면: kill \$(cat ${PID_FILE})"
echo "---" | tee -a "$LOG_FILE"

# 작업 브랜치 보장 — main 직접 커밋 금지. 프롬프트에도 같은 지시가 있지만,
# 스크립트에서 선제로 옮겨 두면 iteration이 안전하게 시작한다.
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "$WORK_BRANCH" ]; then
  git checkout "$WORK_BRANCH" 2>/dev/null || git checkout -b "$WORK_BRANCH"
  log "🌿 브랜치 전환: $current_branch → $WORK_BRANCH"
fi

count=0

while [ $count -lt $MAX_ITERATIONS ]; do
  count=$((count+1))
  log "🔄 Iteration $count / $MAX_ITERATIONS"

  # 미완료 TASK 확인
  remaining=$(grep -c "\- \[ \]" "$PRD_FILE" 2>/dev/null || echo "0")
  log "📌 미완료 TASK: ${remaining}개"

  if [ "$remaining" -eq "0" ]; then
    log "✅ $PRD_FILE 에 미완료 항목 없음 - 종료"
    break
  fi

  # Claude Code 실행 (자율 진행: 모든 도구 자동 허용)
  output=$(unset CLAUDECODE; claude --print --model "$MODEL" --permission-mode bypassPermissions < "$CLAUDE_PROMPT" 2>&1)
  exit_code=$?

  echo "$output" >> "$LOG_FILE"

  # 완료 감지
  if echo "$output" | grep -q "<promise>COMPLETE</promise>"; then
    log "🎉 모든 TASK 완료! Ralph Loop 종료"
    break
  fi

  # 에러 감지
  if [ $exit_code -ne 0 ]; then
    log "⚠️  Claude 실행 오류 (exit: $exit_code) - 재시도"
  fi

  # API 레이트 리밋 방지 (10초 대기)
  log "⏳ 다음 반복까지 10초 대기..."
  sleep 10

done

if [ $count -ge $MAX_ITERATIONS ]; then
  log "⏰ 최대 반복 횟수 도달 ($MAX_ITERATIONS회) - 종료"
fi

log "📊 최종 결과:"
log "   완료 TASK: $(grep -c '\- \[x\]' "$PRD_FILE" 2>/dev/null || echo 0)개"
log "   미완료 TASK: $(grep -c '\- \[ \]' "$PRD_FILE" 2>/dev/null || echo 0)개"
log "   이번 세션 commits: $(git log --oneline main..$WORK_BRANCH 2>/dev/null | wc -l | tr -d ' ')개"

rm -f "$PID_FILE"
log "✨ Ralph Loop 종료"
