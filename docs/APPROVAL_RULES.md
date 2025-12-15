# 결재 시스템 규칙 (Approval Rules)

## 1. 개요

지출결의서의 고정 3단계 결재 프로세스를 정의합니다.

## 2. 결재 단계

| 단계 | 역할 | 설명 |
|------|------|------|
| 1차 | 팀장 | 해당 부서의 팀장이 1차 승인 |
| 2차 | 회계 | 회계 담당자가 2차 승인 |
| 3차 | 재정팀장 | 재정팀장이 최종 승인 |

### 부서별 결재자 매핑

```
재정팀: 김재정(팀장) → 박회계(회계) → 이재무(재정팀장)
교육팀: 최교육(팀장) → 박회계(회계) → 이재무(재정팀장)
선교팀: 강선교(팀장) → 박회계(회계) → 이재무(재정팀장)
기본:   팀장 → 박회계(회계) → 이재무(재정팀장)
```

## 3. 결재 프로세스

### 3.1 상태 전이 (State Machine)

```
DRAFT (작성중)
  ↓ [제출]
PENDING (결재 대기 - 1차 팀장 결재 대기)
  ↓ [1차 승인]
APPROVED_STEP_1 (1차 승인 완료 - 2차 회계 결재 대기)
  ↓ [2차 승인]
APPROVED_STEP_2 (2차 승인 완료 - 3차 재정팀장 결재 대기)
  ↓ [3차 승인]
APPROVED_FINAL (최종 승인)

또는

PENDING/APPROVED_STEP_1/APPROVED_STEP_2 → REJECTED (반려)
  ↓ [재제출]
PENDING (다시 1차 결재 대기)
```

### 3.2 상태 설명

| 상태 | 설명 | 다음 액션 |
|------|------|-----------|
| DRAFT | 작성중 (제출 전) | 제출 |
| PENDING | 1차 팀장 결재 대기 | 1차 승인/반려 |
| APPROVED_STEP_1 | 2차 회계 결재 대기 | 2차 승인/반려 |
| APPROVED_STEP_2 | 3차 재정팀장 결재 대기 | 3차 승인/반려 |
| APPROVED_FINAL | 최종 승인 완료 | - |
| REJECTED | 반려됨 | 수정 후 재제출 |
| WITHDRAWN | 작성자가 회수함 | 수정 후 재제출 |

## 4. 결재 권한

### 4.1 결재자별 권한

- **팀장**: 1차 결재 권한 (PENDING 상태에서 승인/반려 가능)
- **회계**: 2차 결재 권한 (APPROVED_STEP_1 상태에서 승인/반려 가능)
- **재정팀장**: 3차/최종 결재 권한 (APPROVED_STEP_2 상태에서 승인/반려 가능)

### 4.2 작성자 권한

- **제출**: DRAFT 상태에서만 가능
- **회수**: PENDING, APPROVED_STEP_1, APPROVED_STEP_2 상태에서 가능
- **수정**: DRAFT, WITHDRAWN, REJECTED 상태에서 가능

## 5. 제약 사항

### 5.1 자기결재 방지

작성자는 결재선에 포함될 수 없습니다. 작성자가 결재자인 경우 에러가 발생합니다.

### 5.2 결재 순서

반드시 1차 → 2차 → 3차 순서로 결재해야 합니다. 건너뛰기 불가.

### 5.3 스냅샷 고정

제출 시점에 결재선이 JSON으로 스냅샷 저장됩니다. 제출 후에는 결재선 변경 불가.

## 6. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/expenses/[id]/submit` | 제출 (DRAFT → PENDING) |
| POST | `/api/expenses/[id]/approve` | 승인 |
| POST | `/api/expenses/[id]/reject` | 반려 |
| POST | `/api/expenses/[id]/withdraw` | 회수 |
| GET | `/api/expenses/[id]/approval` | 결재 정보 조회 |
| GET | `/api/approvals` | 결재함 목록 조회 |

## 7. 변경 이력

- 2025-12-15: 금액 기반 단계 제거, 고정 3단계로 변경
- 2025-12-15: 상태값 변경 (IN_PROGRESS, APPROVED → APPROVED_STEP_1, APPROVED_STEP_2, APPROVED_FINAL)
