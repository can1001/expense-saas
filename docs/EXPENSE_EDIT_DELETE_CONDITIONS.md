# 지출결의서 수정/삭제 권한 관리

## 1. 지출결의서 상태 체계

| 상태코드 | 한글명 | 설명 |
|---------|--------|------|
| `DRAFT` | 작성중 | 제출 전 초안 상태 |
| `PENDING` | 결재 대기 | 제출됨, 1차 결재자(팀장) 대기 중 |
| `APPROVED_STEP_1` | 1차 승인 | 팀장 승인 완료, 2차 결재자(회계) 대기 중 |
| `APPROVED_STEP_2` | 2차 승인 | 회계 승인 완료, 3차 결재자(재정팀장) 대기 중 |
| `APPROVED_FINAL` | 최종 승인 | 재정팀장 승인 완료, 지급 관리 단계 |
| `REJECTED` | 반려됨 | 결재 반려, 재제출 가능 |
| `WITHDRAWN` | 회수됨 | 작성자가 철회, 재제출 가능 |

---

## 2. 상태별 수정/삭제 권한

| 상태 | 설명 | 수정 | 삭제 | 비고 |
|------|------|:----:|:----:|------|
| `DRAFT` | 작성중 (제출 전) | ✅ | ✅ | |
| `PENDING` | 결재 대기 중 | ❌ | ❌ | 결재자 검토 중 |
| `APPROVED_STEP_1` | 1차 승인 완료 | ❌ | ❌ | 다음 결재자 대기 중 |
| `APPROVED_STEP_2` | 2차 승인 완료 | ❌ | ❌ | 최종 결재자 대기 중 |
| `APPROVED_FINAL` | 최종 승인 완료 | ⚠️ | ❌ | **지급대기 상태에서만 수정 가능** |
| `REJECTED` | 반려됨 | ✅ | ✅ | 재작성/재제출 가능 |
| `WITHDRAWN` | 회수됨 | ✅ | ✅ | 재제출 가능 |

> ⚠️ `APPROVED_FINAL` 상태에서는 `paymentStatus === 'PENDING'`(아직 지급되지 않음)인 경우에만 수정 가능

---

## 3. 사용자 역할별 권한

### 역할 목록

| 역할코드 | 한글명 | 설명 |
|---------|--------|------|
| `admin` | 관리자 | 시스템 관리자 |
| `finance_head` | 재정팀장 | 최종 결재자 (3차) |
| `accountant` | 회계 | 2차 결재자 |
| `team_leader` | 팀장 | 1차 결재자 |
| `admin_assistant` | 행정간사 | 행정 업무 담당 |
| `user` | 사용자 | 일반 사용자 |

### 역할별 권한 매트릭스

| 역할 | 수정/삭제 | 지급상태 변경 | 엑셀 내보내기 | 알림 발송 |
|------|:--------:|:------------:|:------------:|:--------:|
| 관리자 | ✅ | ✅ | ✅ | ✅ |
| 재정팀장 | ✅ | ✅ | ✅ | ✅ |
| 회계 | ✅ | ✅ | ✅ | ✅ |
| 행정간사 | ✅ | ✅ | ✅ | ✅ |
| 팀장 | ✅ | ❌ | ❌ | ❌ |
| 일반사용자 | ✅ | ❌ | ❌ | ❌ |

> **참고**: 수정/삭제 권한은 **문서 상태**에 따라 결정됩니다. 역할에 관계없이 위 상태 조건을 충족하면 자신의 문서를 수정/삭제할 수 있습니다.

---

## 4. 지급상태 체계

최종 승인(`APPROVED_FINAL`) 후 관리되는 지급 상태:

| 상태코드 | 한글명 | 설명 |
|---------|--------|------|
| `PENDING` | 지급 대기 | 기본값, 지급 대기 중 |
| `HOLD` | 지급 보류 | 보류 사유 기록 |
| `CANCELLED` | 지급 취소 | 취소 사유 기록 |
| `COMPLETED` | 지급 완료 | 지급 완료 처리 |

---

## 5. 코드 로직

### 프론트엔드 (버튼 표시)

```typescript
// 기본 편집 가능 상태
const basicEditable = ['DRAFT', 'REJECTED', 'WITHDRAWN'].includes(expense.status);

// 최종승인 + 지급대기 상태
const approvedPending = expense.status === 'APPROVED_FINAL' && expense.paymentStatus === 'PENDING';

// 수정 버튼: 기본 편집 가능 OR 최종승인+지급대기
const canEdit = basicEditable || approvedPending;

// 삭제 버튼: 기본 편집 가능 상태만
const canDelete = basicEditable;

// 지급상태 변경 권한
const paymentStatusRoles = ['admin', 'finance_head', 'accountant', 'admin_assistant'];
const canChangePaymentStatus = currentUser && paymentStatusRoles.includes(currentUser.role);
```

### API 레벨 검증

```typescript
// PUT (수정) - 상태 검증
const BASIC_EDITABLE = ['DRAFT', 'REJECTED', 'WITHDRAWN'];
const isBasicEditable = BASIC_EDITABLE.includes(existing.status);
const isApprovedPending = existing.status === 'APPROVED_FINAL' && existing.paymentStatus === 'PENDING';

if (!isBasicEditable && !isApprovedPending) {
  throw new ApiError('이 상태에서는 수정할 수 없습니다.', 403);
}

// DELETE (삭제) - 상태 검증
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED', 'WITHDRAWN'];
if (!EDITABLE_STATUSES.includes(expense.status)) {
  throw new ApiError('제출된 지출결의서는 삭제할 수 없습니다.', 403);
}
```

---

## 6. 감사 로그

최종승인 + 지급대기 상태에서 수정 시 `ApprovalLog` 테이블에 기록:

```typescript
await prisma.approvalLog.create({
  data: {
    expenseId: id,
    action: 'MODIFY_CONTENT',
    actorName: validatedData.applicantName,
    previousStatus: existing.status,
    newStatus: existing.status,
    comment: '최종승인 후 내용 수정',
  },
});
```

---

## 7. 요약

### 수정 가능
- `DRAFT` (작성중)
- `REJECTED` (반려됨)
- `WITHDRAWN` (회수됨)
- `APPROVED_FINAL` + `paymentStatus=PENDING` (최종승인 후 지급 전)

### 삭제 가능
- `DRAFT` (작성중)
- `REJECTED` (반려됨)
- `WITHDRAWN` (회수됨)

### 수정/삭제 불가
- 결재 진행 중 (`PENDING`, `APPROVED_STEP_1`, `APPROVED_STEP_2`)
- 최종승인 후 지급됨 (`APPROVED_FINAL` + 지급상태가 `PENDING` 아님)

---

## 8. 관련 파일

| 파일 경로 | 용도 |
|----------|------|
| `/app/expenses/[id]/page.tsx` | 상세 페이지, 버튼 표시 로직 |
| `/app/expenses/[id]/edit/page.tsx` | 수정 페이지 |
| `/app/api/expenses/[id]/route.ts` | API, 수정/삭제 권한 검증 |
| `/prisma/schema.prisma` | DB 스키마, 상태 정의 |
| `/lib/types/index.ts` | 타입 정의, 역할 정의 |
