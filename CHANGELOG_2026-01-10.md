# 작업 내역 (2026-01-10)

## 1. 모바일 위치 입력 기능 비활성화

### 변경 파일
- `components/expense-form/ItemsSection.tsx`

### 변경 내용
모바일에서 "현재 위치로 지출 장소 입력" 기능을 임시로 주석 처리하여 숨김

```tsx
{/* 모바일 위치 입력 - 임시 비활성화
{index === 0 && (
  <div className="mt-2">
    <LocationPicker ... />
  </div>
)}
*/}
```

---

## 2. 적요 예제 툴팁 기능 설계 문서 작성

### 생성 파일
- `ACCOUNTING_MEMO_SPEC.md`

### 내용 요약
- 세목별 적요 예제 관리 및 툴팁 기능 설계
- 기존 BudgetMaster의 `description` 필드 활용 (새 테이블 불필요)
- 콤마로 구분된 항목 내역을 파싱하여 툴팁으로 표시
- 구현 예정 파일:
  - `app/api/budget/memo-examples/route.ts`
  - `components/expense-form/MemoTooltip.tsx`
  - `components/expense-form/ItemsSection.tsx` (수정)

---

## 3. 사역팀 팀장 연결 기능 추가

### 문제
`/admin/departments` 페이지에서 모든 사역팀의 팀장이 "미지정"으로 표시됨

### 원인
`prisma/seed.ts`에서 Department 생성 시 `leaderId`를 설정하지 않음

### 해결
`seed.ts`에 `updateDepartmentLeaders()` 함수 추가

```typescript
async function updateDepartmentLeaders() {
  // UserYearRole에서 team_leader 역할 사용자 조회
  const teamLeaders = await prisma.userYearRole.findMany({
    where: { role: 'team_leader', year: CURRENT_YEAR },
    include: { user: true },
  });

  for (const yearRole of teamLeaders) {
    // department 형식: '기획위원회/홍보팀'
    const [committeeName, departmentName] = yearRole.department.split('/');

    // Department.leaderId 업데이트
    await prisma.department.updateMany({
      where: { committeeId: committee.id, name: departmentName },
      data: { leaderId: yearRole.userId },
    });
  }
}
```

### 결과
```
✓ 교육훈련위원회/새가족팀 → 장태규
✓ 예배위원회/방송팀 → 김예찬
✓ 기획위원회/홍보팀 → 서주형
... (20개 팀 연결 완료)
```

---

## 4. 사용자 역할 검증에 admin_assistant 추가

### 문제
사용자 역할을 `admin_assistant`로 변경 시 "Invalid role" 에러 발생

### 원인
`validRoles` 배열에 `admin_assistant`가 누락됨

### 수정 파일

| 파일 | 수정 전 | 수정 후 |
|------|---------|---------|
| `app/api/users/[id]/route.ts` | `['admin', 'finance_head', 'accountant', 'team_leader', 'user']` | `['admin', 'finance_head', 'accountant', 'team_leader', 'admin_assistant', 'user']` |
| `app/api/users/route.ts` | 동일 | 동일 |
| `app/api/users/by-role/[role]/route.ts` | 동일 | 동일 |

---

## 배포 후 필요 작업

1. `npm run db:seed` 실행 (팀장 연결 적용)
2. 사용자 역할 변경 테스트

---

## 관련 파일 요약

```
prisma/
└── seed.ts                    # updateDepartmentLeaders() 추가

app/api/users/
├── route.ts                   # validRoles 수정
├── [id]/route.ts              # validRoles 수정
└── by-role/[role]/route.ts    # validRoles 수정

components/expense-form/
└── ItemsSection.tsx           # LocationPicker 주석 처리

docs/
├── ACCOUNTING_MEMO_SPEC.md    # 적요 툴팁 설계 문서
└── CHANGELOG_2026-01-10.md    # 이 파일
```

---

## 5. 예산 등록 마법사 연도 선택 기능 추가

### 변경 파일
- `app/admin/budget-wizard/page.tsx`

### 변경 내용
- Step 5(세목 등록)에 연도 선택 드롭다운 추가
- 현재 연도 ±2년 범위 선택 가능
- 완료 화면에 선택한 연도 표시
- 담당자/예산금액이 선택한 연도에 적용됨

```tsx
// 연도 선택 UI 추가
<select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
    <option key={year} value={year}>{year}년</option>
  ))}
</select>
```

---

## 6. 연도별 설정 현황 대시보드 신규 개발

### 생성 파일
- `app/admin/year-setup-status/page.tsx` (UI 페이지)
- `app/api/admin/year-setup-status/route.ts` (API)
- `app/admin/page.tsx` (링크 추가)

### 기능
| 항목 | 설명 |
|------|------|
| 역할 설정 완료율 | 활성 사용자 중 연도별 역할이 설정된 비율 |
| 담당자 지정 완료율 | 세목 중 담당자가 지정된 비율 |
| 예산 입력 완료율 | 세목 중 예산금액이 입력된 비율 |
| 미완료 목록 | 역할/담당자/예산 미지정 항목 표시 (상위 10개) |
| 데이터 초기화 | 특정 연도 역할/예산 일괄 삭제 기능 |

### 접근 경로
`/admin/year-setup-status`

---

## 7. 예산 현황 Excel 내보내기 기능 추가

### 변경 파일
- `app/admin/budget-view/page.tsx` (다운로드 버튼 추가)

### 생성 파일
- `app/api/budget/hierarchy/export/route.ts`

### 기능
- 예산 현황 데이터를 Excel 파일로 다운로드
- 컬럼: 위원회, 사역팀, 예산(항), 예산(목), 예산(세목), 담당자, 예산금액
- 헤더 스타일, 자동 필터, 합계 행 포함
- 파일명: `예산현황_{연도}년.xlsx`

---

## 8. 연도별 데이터 초기화 API 개발

### 생성 파일
- `app/api/admin/year-config/[year]/route.ts`

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/year-config/{year}` | 해당 연도 설정 데이터 개수 조회 |
| DELETE | `/api/admin/year-config/{year}?target=all` | 전체 삭제 (역할 + 예산) |
| DELETE | `/api/admin/year-config/{year}?target=roles` | 역할만 삭제 |
| DELETE | `/api/admin/year-config/{year}?target=budgets` | 예산만 삭제 |

---

## 9. 변경 이력 추적 테이블 추가

### 변경 파일
- `prisma/schema.prisma`

### 생성 파일
- `lib/change-history.ts` (헬퍼 함수)
- `app/api/admin/change-history/route.ts` (조회 API)

### 새 Prisma 모델

```prisma
model UserYearRoleHistory {
  id              String    @id @default(cuid())
  userYearRoleId  String?
  userId          String
  year            Int
  action          String    // CREATE, UPDATE, DELETE
  changedBy       String
  changedById     String?
  previousRole    String?
  previousDept    String?
  newRole         String?
  newDept         String?
  changedAt       DateTime  @default(now())
}

model BudgetDetailYearHistory {
  id                  String    @id @default(cuid())
  budgetDetailYearId  String?
  budgetDetailId      String
  budgetDetailName    String?
  year                Int
  action              String    // CREATE, UPDATE, DELETE
  changedBy           String
  changedById         String?
  previousManagerId   String?
  previousManagerName String?
  previousBudgetAmt   Int?
  newManagerId        String?
  newManagerName      String?
  newBudgetAmt        Int?
  changedAt           DateTime  @default(now())
}
```

### 적용 완료
```bash
npx prisma db push
# ✓ Your database is now in sync with your Prisma schema
```

---

## 배포 후 필요 작업 (업데이트)

1. `npm run db:seed` 실행 (팀장 연결 적용)
2. 사용자 역할 변경 테스트
3. ~~`npx prisma db push` 실행 (변경 이력 테이블 생성)~~ ✅ 완료

---

## 10. 역할(Role) 테이블 기반 관리 시스템 구축

### 배경
기존 Prisma Enum(`UserRole`)으로 관리되던 역할을 독립 테이블(`Role`)로 전환하여 확장성과 유연성을 확보합니다.

### 새 Prisma 모델

```prisma
model Role {
  id           String   @id @default(cuid())
  code         String   @unique    // admin, finance_head, accountant, team_leader, admin_assistant, user
  name         String              // 관리자, 재정팀장, 회계, 팀장, 행정간사, 사용자
  description  String?             // 역할 설명
  stepNumber   Int?                // 결재 단계 (1, 2, 3, null)
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)

  // 권한 플래그
  canApprove       Boolean @default(false)  // 결재 권한
  canManageExpense Boolean @default(false)  // 지출 관리 권한
  canAccessAdmin   Boolean @default(false)  // 관리자 메뉴 접근
  canExportData    Boolean @default(false)  // 데이터 내보내기 권한

  // 관계
  users         User[]          @relation("UserRole")
  userYearRoles UserYearRole[]  @relation("YearRole")
}
```

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | Role 모델 추가, User/UserYearRole에 roleId 필드 추가 |
| `prisma/seed.ts` | seedRoles() 함수 추가, 사용자 시드에 roleId 설정 |
| `lib/services/user-service.ts` | Role 테이블 조회 함수 추가 (getAllRoles, getRoleByCode 등) |
| `app/api/admin/roles/route.ts` | **신규** - Role CRUD API (GET, POST) |
| `app/api/admin/roles/[id]/route.ts` | **신규** - Role 개별 API (GET, PUT, DELETE) |
| `app/api/users/route.ts` | roleId 지원, includeRoleRef 옵션 추가 |
| `app/api/users/[id]/route.ts` | roleId 지원, includeRoleRef 옵션 추가 |

### 초기 역할 데이터

| code | name | stepNumber | canApprove | canAccessAdmin | canExportData |
|------|------|-----------|------------|----------------|---------------|
| admin | 관리자 | null | false | true | true |
| finance_head | 재정팀장 | 3 | true | false | true |
| accountant | 회계 | 2 | true | false | true |
| team_leader | 팀장 | 1 | true | false | false |
| admin_assistant | 행정간사 | null | false | false | true |
| user | 사용자 | null | false | false | false |

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/roles` | 역할 목록 조회 |
| POST | `/api/admin/roles` | 역할 생성 |
| GET | `/api/admin/roles/[id]` | 역할 상세 조회 |
| PUT | `/api/admin/roles/[id]` | 역할 수정 |
| DELETE | `/api/admin/roles/[id]` | 역할 비활성화 |

### 마이그레이션 전략

1. **1단계 (완료)**: Role 테이블 생성, User/UserYearRole에 roleId 필드 추가
2. **2단계 (완료)**: Seed에서 역할 데이터 삽입, 사용자에 roleId 매핑
3. **3단계 (향후)**: 프론트엔드 컴포넌트 업데이트
4. **4단계 (향후)**: 기존 UserRole enum 및 role 필드 제거

### 사용 예시

```typescript
// 역할 목록 조회
const roles = await fetch('/api/admin/roles');

// 사용자 조회 시 roleRef 포함
const users = await fetch('/api/users?includeRoleRef=true');

// 역할 코드로 Role 조회
import { getRoleByCode } from '@/lib/services/user-service';
const role = await getRoleByCode('team_leader');
```

---

## 관련 파일 요약 (업데이트)

```
prisma/
├── schema.prisma              # Role 모델, UserYearRoleHistory, BudgetDetailYearHistory 추가
└── seed.ts                    # seedRoles(), updateDepartmentLeaders() 추가

app/admin/
├── page.tsx                   # 연도별 설정 현황 링크 추가
├── budget-wizard/page.tsx     # 연도 선택 기능 추가
├── budget-view/page.tsx       # Excel 다운로드 버튼 추가
├── year-setup-status/page.tsx # 신규 (설정 현황 대시보드)
└── roles/page.tsx             # 신규 (역할 관리 페이지 - 향후 구현)

app/api/
├── admin/
│   ├── roles/route.ts              # 신규 (역할 CRUD API)
│   ├── roles/[id]/route.ts         # 신규 (역할 개별 API)
│   ├── year-setup-status/route.ts  # 신규 (설정 현황 API)
│   ├── year-config/[year]/route.ts # 신규 (데이터 초기화 API)
│   └── change-history/route.ts     # 신규 (변경 이력 조회 API)
├── budget/
│   └── hierarchy/export/route.ts   # 신규 (Excel 내보내기 API)
└── users/
    ├── route.ts                    # roleId, includeRoleRef 지원 추가
    ├── [id]/route.ts               # roleId, includeRoleRef 지원 추가
    └── by-role/[role]/route.ts     # validRoles 수정

lib/
├── change-history.ts          # 신규 (변경 이력 헬퍼 함수)
└── services/user-service.ts   # Role 테이블 조회 함수 추가

components/expense-form/
└── ItemsSection.tsx           # LocationPicker 주석 처리

docs/
├── ACCOUNTING_MEMO_SPEC.md    # 적요 툴팁 설계 문서
└── CHANGELOG_2026-01-10.md    # 이 파일
```
