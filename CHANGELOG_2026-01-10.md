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
| `app/admin/roles/page.tsx` | **신규** - 역할 관리 UI (CRUD, 권한 설정) |

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
└── roles/page.tsx             # 수정 (Role 테이블 기반 동적 관리 페이지)

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

hooks/
└── useRoles.ts                # 신규 (Role 테이블 조회 훅)

components/expense-form/
├── ItemsSection.tsx           # LocationPicker 주석 처리, 적요 툴팁 통합
└── MemoTooltip.tsx            # 신규 (적요 예제 툴팁 컴포넌트)

docs/
├── ACCOUNTING_MEMO_SPEC.md    # 적요 툴팁 설계 문서
└── CHANGELOG_2026-01-10.md    # 이 파일
```

---

## 11. Role 테이블 기반 프론트엔드 마이그레이션 (Phase 3)

### 배경
Role 테이블 도입(#10)에 따라 프론트엔드 컴포넌트에서 하드코딩된 역할 상수를 동적 Role 데이터로 교체합니다.

### 생성 파일
- `hooks/useRoles.ts` - Role 테이블 조회 훅 (1분 캐싱, 헬퍼 함수)

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `components/Header.tsx` | ROLE_NAMES 제거 → useRoles().getRoleName() 사용 |
| `app/admin/users/page.tsx` | ROLE_LABELS/ROLE_COLORS 제거 → useRoles() 사용 |
| `app/admin/users/[id]/edit/page.tsx` | ROLE_OPTIONS 제거 → getRoleOptions(roles) 사용 |
| `app/admin/year-roles/page.tsx` | YEAR_ROLE_OPTIONS 제거 → getYearRoleOptions(roles) 사용 |
| `app/admin/year-roles-summary/page.tsx` | ROLE_COLORS 제거 → getRoleColor() 사용 |
| `app/admin/roles/page.tsx` | ROLE_COLORS import 방식 변경 |

### useRoles 훅 제공 기능

```typescript
// 공개 상수
export const ROLE_COLORS: Record<string, { bg: string; text: string; border?: string }>;

// 훅 반환값
interface UseRolesResult {
  roles: Role[];
  loading: boolean;
  error: string | null;
  getRoleName: (code: string) => string;
  getRoleColor: (code: string) => { bg: string; text: string; border?: string };
  canAccessAdminMenu: (code: string) => boolean;
  canAccessExtendedMenu: (code: string) => boolean;
  refetch: () => void;
}

// 유틸리티 함수
export function getRoleOptions(roles: Role[], exclude?: string[]): { value: string; label: string }[];
export function getYearRoleOptions(roles: Role[]): { value: string; label: string }[];
```

### 결과
- 8개 파일에서 하드코딩된 역할 상수 제거
- 모든 역할 정보가 Role 테이블에서 동적으로 로드
- 빌드 검증 완료

---

## 12. 적요 예제 툴팁 기능 구현

### 배경
지출결의서 세목 선택 시 해당 세목에 맞는 적요 예제를 자동으로 보여주어 사용자 입력 편의성을 높입니다.

### 생성 파일
- `app/api/budget/memo-examples/route.ts` - 적요 예제 조회 API
- `components/expense-form/MemoTooltip.tsx` - 적요 예제 툴팁 컴포넌트

### 변경 파일
- `components/expense-form/ItemsSection.tsx` - MemoTooltip 통합

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/budget/memo-examples?budgetDetailId=xxx` | 세목 ID로 예제 조회 |
| GET | `/api/budget/memo-examples?budgetDetailName=xxx` | 세목 이름으로 예제 조회 |

### 응답 형식
```json
{
  "examples": ["출장 교통비", "택시비", "주차비"],
  "budgetDetail": {
    "id": "...",
    "name": "여비교통비"
  }
}
```

### MemoTooltip 컴포넌트 기능

| 기능 | 설명 |
|------|------|
| 예제 목록 표시 | BudgetDetail.description을 콤마로 분리하여 표시 |
| 키보드 탐색 | ↑↓ 방향키로 선택 이동 |
| 선택 입력 | Enter 또는 클릭으로 적요 필드에 입력 |
| 닫기 | ESC 또는 외부 클릭 시 닫기 |
| 로딩 표시 | 예제 로드 중 스피너 표시 |

### 사용 흐름
1. 세목(budgetDetail) 선택 → 예제 자동 로드
2. 적요 필드 포커스 → 예제 툴팁 표시
3. 예제 선택 → 적요 필드에 자동 입력

### UI 미리보기
```
┌──────────────────────┐
│ 적요 예제            │
├──────────────────────┤
│ ▸ 출장 교통비       │ ← 선택됨 (Enter로 입력)
│   택시비            │
│   주차비            │
└──────────────────────┘
↑↓ 이동, Enter 선택, ESC 닫기
```

### 결과
- 빌드 검증 완료
- `/expenses/new` 페이지에서 사용 가능

---

## 13. Role 마이그레이션 Phase 4 - UserRole enum 제거

### 배경
Prisma `UserRole` enum을 제거하고 `role` 필드를 `String` 타입으로 변경합니다. 이로써 역할 관리가 완전히 Role 테이블 기반으로 전환됩니다.

### 스키마 변경
```prisma
// Before
enum UserRole {
  admin
  finance_head
  accountant
  team_leader
  admin_assistant
  user
}

model User {
  role UserRole @default(user)
}

// After
model User {
  role String @default("user")
}
```

### 변경 파일 (18개)

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | UserRole enum 제거, role 필드 String 타입으로 변경 |
| `prisma/seed.ts` | UserRole 타입 로컬 정의 |
| `lib/types/index.ts` | UserRole 타입 업데이트 |
| `lib/users.ts` | UserRole import 제거, 로컬 정의, ROLE_STEP_MAP/ROLE_NAMES Record<string,...> |
| `lib/constants/menu-permissions.ts` | 함수 시그니처 string 타입으로 변경 |
| `lib/services/user-service.ts` | 모든 UserRole 참조 string으로 변경 |
| `lib/services/approval-line-service.ts` | UserRole 로컬 정의 |
| `app/api/users/route.ts` | UserRole import 경로 변경 |
| `app/api/users/[id]/route.ts` | UserRole import 경로 변경 |
| `app/api/users/by-role/[role]/route.ts` | UserRole import 경로 변경 |
| `app/api/users/upload/route.ts` | UserRole 로컬 정의 |
| `app/api/users/year-roles/route.ts` | UserRole import 경로 변경 |
| `components/HomeClient.tsx` | UserRole 로컬 정의, UserInfo.role string 타입 |
| `lib/services/__tests__/user-service.test.ts` | UserRole import 경로 변경 |

### 타입 변경 요약

| 항목 | Before | After |
|------|--------|-------|
| `User.role` | `UserRole` (enum) | `string` |
| `UserYearRole.role` | `UserRole` (enum) | `string` |
| `UserInfo.role` | `UserRole` | `string` |
| `ROLE_STEP_MAP` | `Record<UserRole, number \| null>` | `Record<string, number \| null>` |
| `ROLE_NAMES` | `Record<UserRole, string>` | `Record<string, string>` |

### 결과
- 빌드 검증 완료
- 18개 파일 수정
- 역할 관리가 완전히 Role 테이블 기반으로 전환됨
- 새 역할 추가 시 스키마 마이그레이션 불필요

---

## 14. 적요 관리 UI (Phase 2)

### 배경
관리자가 세목별 적요 예제를 편집할 수 있는 UI를 제공합니다.

### 생성 파일
- `app/admin/memo-examples/page.tsx` - 적요 예제 관리 페이지
- `app/api/budget-details/[id]/description/route.ts` - 적요 수정 API

### 변경 파일
- `lib/constants/admin-menu.ts` - 사이드바 메뉴에 "적요 예제 관리" 추가

### 기능

| 기능 | 설명 |
|------|------|
| 세목 목록 표시 | 카테고리/서브카테고리별 계층 구조 |
| 필터링 | 위원회/부서별 필터 |
| 검색 | 세목명, 적요 예제 검색 |
| 인라인 편집 | 텍스트 필드에서 직접 수정 |
| 개별/전체 저장 | Enter로 개별 저장, 버튼으로 전체 저장 |
| 변경 표시 | 수정된 항목 노란색 하이라이트 |

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| PATCH | `/api/budget-details/[id]/description` | 적요 예제 수정 |

### 접근 경로
`/admin` → 예산 → 적요 예제 관리

---

## 15. 팀장 일괄 업로드 기능

### 배경
Excel 파일을 통해 사역팀장을 일괄 설정할 수 있는 기능입니다.

### 생성 파일
- `app/admin/leaders-upload/page.tsx` - 팀장 일괄 업로드 페이지
- `app/api/departments/leaders-upload/route.ts` - 업로드 API

### 변경 파일
- `lib/constants/admin-menu.ts` - 사이드바 "조직" 그룹에 메뉴 추가

### Excel 형식

| 위원회 | 사역팀 | 팀장 |
|--------|--------|------|
| 교육위원회 | 유년부 | 정혜종 |
| 선교위원회 | 해외선교부 | (비워두면 해제) |

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/departments/leaders-upload` | 현재 팀장 목록 템플릿 다운로드 |
| POST | `/api/departments/leaders-upload` | Excel 업로드로 팀장 설정 |

### 기능
- 템플릿 다운로드 (현재 팀장 정보 포함)
- Dry-run 미리보기 모드
- 검증 → 실행 2단계 업로드
- 오류 상세 표시

### 접근 경로
`/admin` → 조직 → 팀장 일괄 등록

---

## 16. 테스트 수정 (user-service.test.ts)

### 문제
Role 테이블 도입 후 `createUser`, `updateUser`, `setYearRole` 테스트 실패

### 원인
`prisma.role` mock이 누락되어 `getAllRoles()` 호출 시 에러 발생

### 수정 내용

```typescript
// Mock Prisma에 role 추가
vi.mock('../../prisma', () => ({
  prisma: {
    user: { ... },
    userYearRole: { ... },
    role: {
      findMany: vi.fn(),  // 추가
    },
  },
}));

// Mock 데이터 추가
const mockRoles = [
  { id: 'role-1', code: 'admin', ... },
  { id: 'role-6', code: 'user', ... },
];

beforeEach(() => {
  vi.mocked(prisma.role.findMany).mockResolvedValue(mockRoles);
});

// 테스트 기대값에 roleId 추가
expect(prisma.user.create).toHaveBeenCalledWith({
  data: {
    ...
    roleId: 'role-6',  // 추가
  },
});
```

### 결과
- 519개 테스트 모두 통과

---

## 17. db:seed 프로덕션 실행 차단

### 배경
프로덕션 환경에서 실수로 `npm run db:seed` 실행을 방지합니다.

### 변경 파일
- `prisma/seed.ts`

### 구현

```typescript
// 파일 최상단에 추가
if (process.env.NODE_ENV !== 'development') {
  console.error('❌ 오류: db:seed는 development 환경에서만 실행할 수 있습니다.');
  console.error('   현재 NODE_ENV:', process.env.NODE_ENV || '(설정되지 않음)');
  console.error('   실행 방법: NODE_ENV=development npm run db:seed');
  process.exit(1);
}
```

### 동작

| 명령어 | 결과 |
|--------|------|
| `npm run db:seed` | ❌ 차단 (NODE_ENV 미설정) |
| `NODE_ENV=production npm run db:seed` | ❌ 차단 |
| `NODE_ENV=development npm run db:seed` | ✅ 실행 허용 |

---

## 18. 환경 설정 파일 분리

### 배경
Development, Test, Production 환경별 설정 분리를 위한 구조 정리

### 생성 파일
- `.env.example` - 환경 변수 템플릿 (Git 커밋 가능)

### 변경 파일
- `.gitignore` - `.env.example` 커밋 허용

### .env.example 내용

```bash
# 환경 구분
NODE_ENV=development

# 데이터베이스
DATABASE_URL="postgresql://..."

# 애플리케이션 URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cloudinary
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

### .gitignore 변경

```diff
- .env*
+ .env
+ .env.local
+ .env.development
+ .env.test
+ .env.production
+ # .env.example은 커밋 허용 (템플릿)
```

### 환경 파일 구조

| 파일 | 용도 | Git |
|------|------|-----|
| `.env.example` | 템플릿 | ✅ 커밋 |
| `.env` | 실제 설정 | ❌ 제외 |
| `.env.local` | 로컬 개발용 | ❌ 제외 |

### 새 개발자 설정 방법
```bash
cp .env.example .env.local
# .env.local 파일에 실제 값 입력
```

---

## 19. DB 초기화 스크립트 추가

### 배경
User, Role 테이블을 제외한 모든 데이터를 초기화하는 스크립트

### 생성 파일
- `scripts/reset-db-keep-users.ts`
- `scripts/reset-db-keep-users.sql`

### 실행 방법
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reset-db-keep-users.ts
```

### 삭제 대상 테이블 (순서대로)
1. ApprovalLog, ApprovalStep, ApprovalLine
2. ExpenseAttachment, ExpenseItem, Expense
3. SimpleExpenseAttachment, SimpleExpenseItem, SimpleExpense
4. BudgetDetailYearHistory, DepartmentBudgetDetail, BudgetDetailYear
5. BudgetDetail, BudgetSubcategory, BudgetCategory
6. Department, Committee
7. BudgetMaster
8. UserYearRoleHistory, UserYearRole
9. SavedBankAccount

### 유지 테이블
- User
- Role

---

## 20. Admin IA 최적화 (업무 흐름 기반)

### 배경
Admin 사이드바 메뉴를 업무 흐름 기반으로 재구성하여 사용성을 향상시킵니다.

### 변경 파일
- `lib/constants/admin-menu.ts`

### 변경 전 (4개 그룹)

```
조직: 위원회, 사역팀, 팀장 일괄 등록
사용자: 사용자 관리, 일괄 등록, 연도별 역할, 역할 안내
예산: 마스터 관리, 담당자, 적요 예제, 현황 조회
현황: 연도별 팀장 현황
```

### 변경 후 (5개 그룹)

```
대시보드
└─ 홈

연도 설정
├─ 설정 마법사
├─ 위원회 관리
├─ 사역팀(부) 관리
└─ 예산 마스터 업로드

인원 관리
├─ 사용자 관리
├─ 사용자 일괄 등록
├─ 팀장 일괄 등록
└─ 연도별 역할 관리

예산 관리
├─ 세목별 담당자 관리
├─ 적요 예제 관리
└─ 예산 현황 조회

현황/리포트
├─ 연도별 설정 현황
├─ 연도별 팀장 현황
└─ 역할 안내
```

### 개선 사항

| 항목 | 설명 |
|------|------|
| 대시보드 추가 | 홈 페이지 빠른 접근 |
| 연도 설정 워크플로우 | 매년 초 설정 작업을 순서대로 진행 가능 |
| 인원 관리 통합 | 사용자 + 역할 관련 기능을 한 곳에 배치 |
| 숨겨진 페이지 노출 | 설정 마법사, 연도별 설정 현황 메뉴에 추가 |
| 일괄 등록 접근성 | 관련 관리 화면과 같은 그룹에 배치 |

### 추가 아이콘

```typescript
import { LayoutDashboard, Wand2, CheckCircle } from 'lucide-react';
```
