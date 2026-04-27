# SPEC.md - 관리자 페이지 IA 재설계

## 1. 목표 (Objective)

### 문제 정의
현재 관리자 페이지의 메뉴가 기능 중심으로 분산되어 있어, 재정 담당자의 업무 흐름(예산 편성 → 수입/지출 관리 → 결산)과 맞지 않음.

### 해결 목표
- 재정 업무 흐름에 맞춘 메뉴 구조 재편
- 조직 관리와 예산 관리의 명확한 분리
- 결산(월/분기/연) 프로세스 지원
- 전년도 결산 데이터 기반 차기 예산 편성 지원

### 대상 사용자
- **재정 담당자**: 예산 편성, 수입/지출 등록, 결산 업무 수행
- 회계년도: 1월~12월 (일반 회계년도)

---

## 2. 메뉴 구조 (Information Architecture)

### 2.1 1차 메뉴 (탑/사이드 네비게이션)

```
📊 대시보드
   └─ 재정 현황 요약 (예산 대비 집행률, 수입/지출 현황)

🏢 조직 관리
   ├─ 위원회 관리
   ├─ 사역팀(부) 관리
   └─ 사용자 관리
       ├─ 사용자 목록
       ├─ 역할 관리
       └─ 연도별 역할 배정

💰 예산 관리
   ├─ 예산 편성
   │   ├─ 항/목/세목 관리
   │   ├─ 예산 배정 (연도별)
   │   └─ 예산 마법사
   ├─ 예산 조회
   └─ 예산 담당자 관리

📈 수입 관리
   ├─ 헌금 등록/조회
   ├─ 수입 현황
   └─ 수입 항목 관리

📉 지출 관리
   ├─ 지출결의서 목록
   ├─ 결재 대기
   ├─ 지급 처리
   └─ 지출 현황

📋 결산 관리
   ├─ 월별 결산
   ├─ 분기별 결산
   ├─ 연간 결산
   └─ 재정보고서
       ├─ 수지개황
       ├─ 수입부
       ├─ 지출부
       └─ 위원회별 현황

⚙️ 시스템 설정
   ├─ 결재선 규칙
   ├─ 알림 설정
   └─ 시스템 설정
```

### 2.2 URL 구조

```
/admin                           # 대시보드
/admin/dashboard                 # 대시보드 (alias)

# 조직 관리
/admin/org/committees            # 위원회 관리
/admin/org/departments           # 사역팀(부) 관리
/admin/org/users                 # 사용자 목록
/admin/org/users/new             # 사용자 등록
/admin/org/users/[id]/edit       # 사용자 수정
/admin/org/roles                 # 역할 관리
/admin/org/year-roles            # 연도별 역할 배정

# 예산 관리
/admin/budget/items              # 항/목/세목 관리
/admin/budget/allocation         # 예산 배정 (연도별)
/admin/budget/wizard             # 예산 마법사
/admin/budget/view               # 예산 조회
/admin/budget/managers           # 예산 담당자 관리

# 수입 관리
/admin/income/offerings          # 헌금 등록/조회
/admin/income/status             # 수입 현황
/admin/income/items              # 수입 항목 관리

# 지출 관리
/admin/expense/list              # 지출결의서 목록
/admin/expense/pending           # 결재 대기
/admin/expense/payment           # 지급 처리
/admin/expense/status            # 지출 현황

# 결산 관리
/admin/settlement/monthly        # 월별 결산
/admin/settlement/quarterly      # 분기별 결산
/admin/settlement/annual         # 연간 결산
/admin/settlement/report         # 재정보고서

# 시스템 설정
/admin/settings/approval-rules   # 결재선 규칙
/admin/settings/notifications    # 알림 설정
/admin/settings/system           # 시스템 설정
```

---

## 3. 핵심 기능 및 수용 기준 (Features & Acceptance Criteria)

### 3.1 대시보드

| 기능 | 수용 기준 |
|------|-----------|
| 예산 집행률 표시 | 전체 예산 대비 지출 비율을 % 및 프로그레스 바로 표시 |
| 수입/지출 요약 | 당월, 당분기, 당해년도 수입/지출 합계 표시 |
| 결재 대기 현황 | 결재 대기 건수 및 최근 5건 목록 표시 |
| 예산 잔액 경고 | 예산 소진률 80% 이상 항목 하이라이트 |

### 3.2 조직 관리

| 기능 | 수용 기준 |
|------|-----------|
| 위원회 CRUD | 위원회 생성/조회/수정/비활성화 (삭제 불가) |
| 사역팀(부) CRUD | 사역팀 생성/조회/수정/비활성화, 위원회 소속 지정 |
| 사용자 관리 | 사용자 등록/수정/비활성화, 역할 배정 |
| 연도별 역할 | 연도별 팀장/회계/재정팀장 배정 |

### 3.3 예산 관리

| 기능 | 수용 기준 |
|------|-----------|
| 항/목/세목 관리 | 예산 계층 구조(항→목→세목) CRUD |
| 예산 배정 | 연도별 세목당 예산 금액 및 담당자 배정 |
| 예산 조회 | 위원회/사역팀/항목별 필터링, 예산 vs 집행 비교 |
| 예산 복사 | 전년도 예산을 다음 연도로 복사 |

### 3.4 수입 관리

| 기능 | 수용 기준 |
|------|-----------|
| 헌금 등록 | 헌금 종류, 헌금자, 금액, 날짜 등록 |
| 수입 조회 | 기간별/종류별/헌금자별 필터링 |
| 수입 현황 | 예산 대비 수입 달성률, 월별 추이 차트 |

### 3.5 지출 관리

| 기능 | 수용 기준 |
|------|-----------|
| 지출결의서 목록 | 전체 지출결의서 조회, 상태별 필터링 |
| 결재 대기 | 나에게 결재 대기 중인 건 목록 |
| 지급 처리 | 최종 승인 건 지급완료/보류/취소 처리 |
| 지출 현황 | 예산 항목별, 위원회별, 기간별 집행 현황 |

### 3.6 결산 관리

| 기능 | 수용 기준 |
|------|-----------|
| 월별 결산 | 월별 수입/지출 집계, 전월 대비 |
| 분기별 결산 | 분기별 수입/지출 집계, 예산 대비 |
| 연간 결산 | 연간 총 수입/지출, 예산 소진률 |
| 결산 확정 | 결산 확정 시 확인 절차 필수 |
| 재정보고서 | 수지개황, 수입부, 지출부, 위원회별 지출 차트 |

---

## 4. 프로젝트 구조 (Project Structure)

```
app/admin/
├── page.tsx                      # 대시보드 (리다이렉트 또는 메인)
├── layout.tsx                    # 관리자 레이아웃 (사이드바)
│
├── org/                          # 조직 관리
│   ├── committees/
│   │   └── page.tsx
│   ├── departments/
│   │   └── page.tsx
│   ├── users/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/edit/page.tsx
│   ├── roles/
│   │   └── page.tsx
│   └── year-roles/
│       └── page.tsx
│
├── budget/                       # 예산 관리
│   ├── items/
│   │   └── page.tsx
│   ├── allocation/
│   │   └── page.tsx
│   ├── wizard/
│   │   └── page.tsx
│   ├── view/
│   │   └── page.tsx
│   └── managers/
│       └── page.tsx
│
├── income/                       # 수입 관리
│   ├── offerings/
│   │   └── page.tsx
│   ├── status/
│   │   └── page.tsx
│   └── items/
│       └── page.tsx
│
├── expense/                      # 지출 관리
│   ├── list/
│   │   └── page.tsx
│   ├── pending/
│   │   └── page.tsx
│   ├── payment/
│   │   └── page.tsx
│   └── status/
│       └── page.tsx
│
├── settlement/                   # 결산 관리
│   ├── monthly/
│   │   └── page.tsx
│   ├── quarterly/
│   │   └── page.tsx
│   ├── annual/
│   │   └── page.tsx
│   └── report/
│       └── page.tsx
│
└── settings/                     # 시스템 설정
    ├── approval-rules/
    │   └── page.tsx
    ├── notifications/
    │   └── page.tsx
    └── system/
        └── page.tsx

components/admin/
├── AdminLayout.tsx               # 관리자 전체 레이아웃
├── AdminSidebar.tsx              # 사이드바 네비게이션
├── AdminHeader.tsx               # 상단 헤더
├── Dashboard/                    # 대시보드 컴포넌트
│   ├── BudgetSummaryCard.tsx
│   ├── IncomeExpenseChart.tsx
│   └── PendingApprovalList.tsx
├── Settlement/                   # 결산 컴포넌트
│   ├── MonthlySettlementTable.tsx
│   ├── QuarterlyReport.tsx
│   └── SettlementConfirmModal.tsx
└── shared/                       # 공용 컴포넌트
    ├── DataTable.tsx
    ├── FilterBar.tsx
    └── DateRangePicker.tsx

app/api/admin/
├── dashboard/
│   └── route.ts                  # 대시보드 데이터 API
├── settlement/
│   ├── monthly/route.ts
│   ├── quarterly/route.ts
│   └── annual/route.ts
└── income/
    └── route.ts
```

---

## 5. 코드 스타일 (Code Style)

### 컴포넌트 패턴
```tsx
// Server Component 기본 (데이터 페칭)
// app/admin/settlement/monthly/page.tsx
export default async function MonthlySettlementPage() {
  const data = await getMonthlySettlement();
  return <MonthlySettlementTable data={data} />;
}

// Client Component (인터랙션 필요 시)
// 'use client' 선언 필수
```

### API 패턴
```typescript
// app/api/admin/settlement/monthly/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || new Date().getFullYear();
  const month = searchParams.get('month');

  // Prisma 쿼리
  const data = await prisma.$queryRaw`...`;

  return NextResponse.json(data);
}
```

### 금액 계산 규칙
```typescript
// 10원 단위 절사
Math.floor((unitPrice * quantity) / 10) * 10
```

### 날짜 처리
```typescript
// 회계년도: 1월~12월
const fiscalYearStart = new Date(year, 0, 1);  // 1월 1일
const fiscalYearEnd = new Date(year, 11, 31);  // 12월 31일
```

---

## 6. 테스트 전략 (Testing Strategy)

### 단위 테스트
- 금액 계산 함수
- 예산 집행률 계산
- 결산 집계 로직

### 통합 테스트
- 결산 확정 플로우
- 예산 복사 기능
- 수입/지출 등록 API

### E2E 테스트
- 대시보드 데이터 표시
- 메뉴 네비게이션
- 결산 확정 프로세스

---

## 7. 경계 조건 (Boundaries)

### 항상 해야 하는 것 (ALWAYS)
- [ ] 삭제 대신 `isActive: false` 처리 (소프트 삭제)
- [ ] 금액 변경 시 감사 로그 기록
- [ ] 결산 데이터 변경 시 변경 이력 저장
- [ ] 예산 초과 시 경고 표시

### 확인이 필요한 것 (ASK FIRST)
- [ ] 결산 확정 전 확인 모달 표시
- [ ] 대량 데이터 수정 전 확인
- [ ] 연도 변경 작업 전 확인

### 절대 하면 안 되는 것 (NEVER)
- [ ] 확정된 데이터 물리적 삭제
- [ ] 결산 확정 후 데이터 수정 (새 버전 생성만 허용)
- [ ] 권한 없는 사용자의 결산 접근

---

## 8. 마이그레이션 계획 (Migration Plan)

### Phase 1: 디렉토리 구조 변경
1. 새 디렉토리 구조 생성 (`org/`, `budget/`, `income/`, `expense/`, `settlement/`)
2. 기존 페이지를 새 위치로 이동
3. 리다이렉트 설정 (기존 URL → 새 URL)

### Phase 2: 레이아웃 업데이트
1. `AdminSidebar.tsx` 메뉴 구조 변경
2. 새 메뉴 그룹 및 아이콘 적용

### Phase 3: 새 기능 구현
1. 대시보드 (재정 현황 요약)
2. 월별/분기별/연간 결산 페이지
3. 결산 확정 기능

### Phase 4: 기존 페이지 정리
1. 사용하지 않는 기존 페이지 제거
2. 리다이렉트 정리

---

## 9. 구현 현황

### 완료된 항목 ✅

| 구분 | 항목 | 상태 |
|------|------|------|
| 메뉴 구조 | 7개 대분류로 재편 | ✅ 완료 |
| 조직 관리 | /admin/org/* | ✅ 완료 |
| 예산 관리 | /admin/budget/* | ✅ 완료 |
| 수입 관리 | /admin/income/* | ✅ 완료 |
| 지출 관리 | /admin/expense/* | ✅ 완료 |
| 결산 관리 | /admin/settlement/* | ✅ 완료 |
| 시스템 설정 | /admin/settings/* | ✅ 완료 |
| 대시보드 빠른 링크 | 새 URL로 업데이트 | ✅ 완료 |

### 새로 생성된 페이지

- `/admin/income/status` - 수입 현황
- `/admin/expense/list` - 지출결의서 목록
- `/admin/expense/pending` - 결재 대기
- `/admin/expense/payment` - 지급 처리
- `/admin/expense/status` - 지출 현황
- `/admin/settlement/monthly` - 월별 결산
- `/admin/settlement/quarterly` - 분기별 결산
- `/admin/settlement/annual` - 연간 결산
- `/admin/settlement/report` - 재정보고서

### 후속 작업 (API 구현 필요)

1. `/api/admin/income/status` - 수입 현황 API
2. `/api/admin/expense/status` - 지출 현황 API
3. `/api/admin/settlement/monthly` - 월별 결산 API
4. `/api/admin/settlement/quarterly` - 분기별 결산 API
5. `/api/admin/settlement/annual` - 연간 결산 API
6. `/api/admin/settlement/report` - 재정보고서 API
