# 결재라인 규칙 정리

## 기본 결재라인 구조

| 단계 | 역할 | 결재자 | 비고 |
|------|------|--------|------|
| 1차 | 팀장 | BudgetMaster.manager | 세목별 담당자 |
| 2차 | 회계 | 정혜종 | 고정 |
| 3차 | 재정팀장 | 윤운문 | 최종 결재 |

---

## 1차 결재자 결정 규칙

**우선순위:**
1. **BudgetMaster.manager** (세목에 지정된 담당자)
2. 위원회별 기본 팀장 (fallback)

```
예시:
- 세목 "건물관리비" → manager: "신창국"
- 세목 "전기료" → manager: "이문희"
- 세목 "방송장비" → manager: "김예찬"
```

---

## 전결 규칙

> **핵심**: 제출자와 결재자가 동일한 경우, 해당 단계는 **자동 승인(전결)** 처리

### 시나리오별 결재 흐름

| 제출자 | 1차 결재 | 2차 결재 | 3차 결재 | 결과 상태 |
|--------|----------|----------|----------|-----------|
| 일반 사용자 | 팀장 대기 | 회계 대기 | 재정팀장 대기 | PENDING |
| 팀장 (1차 결재자) | **전결** | 회계 대기 | 재정팀장 대기 | APPROVED_STEP_1 |
| 정혜종 (회계) | 팀장 대기 | **전결** | 재정팀장 대기 | PENDING |
| 윤운문 (재정팀장) | **전결** (manager일 때) | 회계 대기 | **본인 승인** | APPROVED_STEP_1 |

### 전결 처리 플로우

```
[제출]
  ↓
[1차 결재자 확인]
  ├── 제출자 = 팀장 → 자동 승인 (전결) → 2차로 이동
  └── 제출자 ≠ 팀장 → 팀장 결재 대기
        ↓
[2차 결재자 확인]
  ├── 제출자 = 회계 → 자동 승인 (전결) → 3차로 이동
  └── 제출자 ≠ 회계 → 회계 결재 대기
        ↓
[3차 결재자 확인]
  └── 제출자 = 재정팀장 → 본인 승인 허용
  └── 제출자 ≠ 재정팀장 → 재정팀장 결재 대기
        ↓
[최종 승인]
```

---

## 건물관리비 케이스 (신창국 작성 시)

**지출결의서 정보:**
- 위원회: (가칭)행정위
- 세목: 건물관리비
- 청구인: 신창국 (재정팀장)

**BudgetMaster.manager가 "신창국"인 경우:**

| 단계 | 결재자 | 상태 | 설명 |
|------|--------|------|------|
| 1차 | 윤운문 | **전결** | 제출자=팀장(manager)이므로 자동 승인 |
| 2차 | 정혜종 | 대기 | 회계 승인 필요 |
| 3차 | 윤운문 | 대기 | 본인 승인 허용 (옵션 C) |

**제출 시 상태:** `APPROVED_STEP_1` (1차 전결 완료)

---

## 구현 상세

### approval-engine.ts

```typescript
// 1차 결재자: BudgetMaster.manager 우선, 없으면 위원회 기본 팀장
const teamManager = budgetManager || approvers.teamManager;

// 전결 처리
const steps = allApprovers.map((approver, index) => ({
  ...approver,
  isAutoApproved: approver.name === applicantName,
  autoApprovalReason: approver.name === applicantName
    ? `${approver.role} 전결 (본인 작성)`
    : undefined,
}));
```

### submit/route.ts

```typescript
// BudgetMaster에서 manager 조회
const budgetMaster = await prisma.budgetMaster.findFirst({
  where: {
    category: expense.budgetCategory,
    subcategory: expense.budgetSubcategory,
    detail: firstItem.budgetDetail,
    isActive: true,
  },
  select: { manager: true },
});
const budgetManager = budgetMaster?.manager || null;

// 결재선 생성 시 manager 전달
const approvalLineData = generateApprovalLine({
  ...expenseData,
  budgetManager,
});

// 전결 단계 자동 승인 처리
const autoApprovedSteps = approvalLineData.steps.filter(
  (step) => step.isAutoApproved
);

// 전결 단계는 APPROVED 상태로 생성
steps: {
  create: approvalLineData.steps.map((step) => ({
    ...step,
    status: step.isAutoApproved ? 'APPROVED' : 'PENDING',
    approvedAt: step.isAutoApproved ? now : null,
    comment: step.autoApprovalReason || null,
  })),
}
```

---

## 상태 전이

```
DRAFT (작성중)
  ↓ [제출]
PENDING (1차 결재 대기)
  ↓ [1차 승인 또는 전결]
APPROVED_STEP_1 (2차 결재 대기)
  ↓ [2차 승인 또는 전결]
APPROVED_STEP_2 (3차 결재 대기)
  ↓ [3차 승인 또는 전결]
APPROVED_FINAL (최종 승인)
```

---

## 감사 로그

전결 처리 시 감사 로그에 다음 정보 기록:
- `action`: `APPROVE`
- `comment`: `{역할} 전결 (본인 작성)`
- `metadata.autoApproved`: `true`

---

## 관련 파일

- `lib/approval-engine.ts`: 결재선 생성 로직
- `app/api/expenses/[id]/submit/route.ts`: 제출 및 전결 처리
- `app/api/expenses/[id]/approve/route.ts`: 수동 승인 처리
- `lib/users.ts`: 사용자 및 역할 정의
