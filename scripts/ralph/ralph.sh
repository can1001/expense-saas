#!/bin/bash

# ============================================
# Ralph Loop - expense-system 자동 구현
# 사용법: ./scripts/ralph/ralph.sh [최대반복횟수]
# 예시:   ./scripts/ralph/ralph.sh 20
# ============================================

MAX_ITERATIONS=${1:-20}
LOG_FILE="ralph_log_$(date +%Y%m%d_%H%M%S).txt"
PID_FILE="ralph.pid"
CLAUDE_PROMPT="scripts/ralph/CLAUDE.md"

echo "$$" > $PID_FILE

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Ralph Loop 시작 (최대 ${MAX_ITERATIONS}회)"
log "로그 파일: $LOG_FILE"
log "중단하려면: kill \$(cat ralph.pid)"
echo "---" | tee -a "$LOG_FILE"

# progress.txt 초기화 (첫 실행 시)
if [ ! -f "progress.txt" ]; then
  echo "# Ralph Loop Progress" > progress.txt
  echo "시작: $(date)" >> progress.txt
  echo "---" >> progress.txt
fi

count=0

while [ $count -lt $MAX_ITERATIONS ]; do
  count=$((count+1))
  log "Iteration $count / $MAX_ITERATIONS"

  # 미완료 TASK 확인
  remaining=$(grep -c "\- \[ \]" PRD.md 2>/dev/null || echo "0")
  log "미완료 TASK: ${remaining}개"

  if [ "$remaining" -eq "0" ]; then
    log "PRD.md에 미완료 항목 없음 - 종료"
    break
  fi

  # Claude Code 실행 (--dangerously-skip-permissions: 파일 수정 권한 자동 부여)
  output=$(unset CLAUDECODE; claude --print --model claude-sonnet-4-20250514 --dangerously-skip-permissions < "$CLAUDE_PROMPT" 2>&1)
  exit_code=$?

  echo "$output" >> "$LOG_FILE"

  # 완료 감지
  if echo "$output" | grep -q "<promise>COMPLETE</promise>"; then
    log "모든 TASK 완료! Ralph Loop 종료"
    echo "" >> progress.txt
    echo "완료: $(date)" >> progress.txt
    break
  fi

  # 에러 감지
  if [ $exit_code -ne 0 ]; then
    log "Claude 실행 오류 (exit: $exit_code) - 재시도"
  fi

  # API 레이트 리밋 방지 (10초 대기)
  log "다음 반복까지 10초 대기..."
  sleep 10

done

if [ $count -ge $MAX_ITERATIONS ]; then
  log "최대 반복 횟수 도달 ($MAX_ITERATIONS회) - 종료"
fi

log "최종 결과:"
log "   완료 TASK: $(grep -c '\- \[x\]' PRD.md 2>/dev/null || echo 0)개"
log "   미완료 TASK: $(grep -c '\- \[ \]' PRD.md 2>/dev/null || echo 0)개"
log "   총 git commits: $(git log --oneline | head -$count | wc -l)개"

rm -f $PID_FILE
log "Ralph Loop 종료"
