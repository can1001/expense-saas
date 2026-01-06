# 남은 작업 목록 (TODO)

> 최종 업데이트: 2026-01-06

## 완료된 작업

- [x] 역할별 메인화면 메뉴 분기 (`app/page.tsx`, `components/HomeClient.tsx`)
- [x] 회원가입 기능 (`/signup`, `/api/auth/signup`)
- [x] 어드민 사이드바 레이아웃 (`components/admin/AdminSidebar.tsx`)
- [x] 위원회 관리 (`/admin/committees`, `/api/committees`)
- [x] 사역팀(부) 관리 (`/admin/departments`, `/api/departments`)
- [x] 역할 안내 페이지 (`/admin/roles`)

---

## 남은 작업

### 1. 사용자 관리 개선 (우선순위: 높음)

#### 1.1 스키마 변경
```prisma
// prisma/schema.prisma - User 모델에 추가
model User {
  // ... 기존 필드 ...

  lockedAt        DateTime?   // 계정 잠금 일시
  lockedReason    String?     // 잠금 사유
  lastLoginAt     DateTime?   // 최근 로그인 일시
  loginFailCount  Int         @default(0)  // 로그인 실패 횟수
}
```

- [ ] User 모델에 잠금 관련 필드 추가
- [ ] `npm run db:push` 실행

#### 1.2 비밀번호 초기화 기능
- [ ] API: `POST /api/users/[id]/reset-password`
- [ ] 관리자가 사용자 비밀번호를 기본값으로 리셋
- [ ] 사용자 관리 페이지에 "비밀번호 초기화" 버튼 추가

#### 1.3 계정 잠금/해제 기능
- [ ] API: `POST /api/users/[id]/lock` (잠금)
- [ ] API: `POST /api/users/[id]/unlock` (해제)
- [ ] 사용자 관리 페이지에 잠금/해제 버튼 추가
- [ ] 잠금된 사용자 로그인 시 에러 메시지 표시

#### 1.4 로그인 보안 강화
- [ ] 로그인 성공 시 `lastLoginAt` 업데이트
- [ ] 로그인 실패 시 `loginFailCount` 증가
- [ ] 5회 실패 시 자동 잠금 (`lockedAt`, `lockedReason` 설정)
- [ ] 로그인 API (`/api/auth/login`) 수정

#### 1.5 사용자 목록 개선
- [ ] 잠금 상태 필터 추가
- [ ] 최근 로그인 일시 표시
- [ ] 잠금 상태 배지 표시

---

### 2. 권한 상수화 (우선순위: 중간)

#### 2.1 권한 상수 파일 생성
- [ ] `lib/constants/permissions.ts` 생성

```typescript
export const PERMISSIONS = {
  // 메뉴 접근
  MENU_EXPENSES: 'menu.expenses',
  MENU_EXPENSES_SIMPLE: 'menu.expenses.simple',
  MENU_APPROVALS: 'menu.approvals',
  MENU_ADMIN: 'menu.admin',

  // 기능
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_EDIT_OWN: 'expense.edit.own',
  EXPENSE_VIEW_ALL: 'expense.view.all',
  APPROVAL_STEP_1: 'approval.step.1',
  APPROVAL_STEP_2: 'approval.step.2',
  APPROVAL_STEP_3: 'approval.step.3',
  EXPORT_EXCEL: 'export.excel',
  USER_MANAGE: 'user.manage',
  BUDGET_MANAGE: 'budget.manage',
} as const;
```

#### 2.2 역할-권한 매핑
- [ ] `ROLE_PERMISSIONS` 상수 정의
- [ ] `hasPermission(role, permission)` 함수 구현

#### 2.3 기존 코드 리팩토링
- [ ] `menu-permissions.ts` → `permissions.ts` 통합
- [ ] 권한 체크 로직 일원화

---

### 3. 사용자 소속 연결 (우선순위: 중간)

#### 3.1 User-Department 연결
- [ ] User 모델에 `departmentId` 추가 (선택)
- [ ] 또는 별도 매핑 테이블 생성

```prisma
model UserDepartment {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])
  departmentId  String
  department    Department @relation(fields: [departmentId], references: [id])
  isPrimary     Boolean    @default(true)  // 주 소속 여부

  @@unique([userId, departmentId])
}
```

#### 3.2 사용자 폼 개선
- [ ] 사용자 추가/수정 시 위원회/사역팀 선택 UI
- [ ] 기존 `department` 텍스트 필드 → 드롭다운 선택

---

### 4. 활동 이력 표시 (우선순위: 낮음)

#### 4.1 사용자 상세 페이지
- [ ] `/admin/users/[id]` 상세 페이지 생성
- [ ] 작성한 지출결의서 목록 표시
- [ ] 결재 이력 표시 (ApprovalLog 활용)

#### 4.2 대시보드 통계 (선택)
- [ ] 사용자별 지출결의서 통계
- [ ] 월별 작성 건수

---

### 5. 기타 개선사항 (우선순위: 낮음)

#### 5.1 어드민 페이지 접근 제어
- [ ] `/admin` 하위 페이지 권한 체크
- [ ] 비관리자 접근 시 리다이렉트

#### 5.2 반응형 사이드바
- [ ] 모바일: 햄버거 메뉴로 토글
- [ ] 태블릿: 접히는 사이드바 (아이콘만)

#### 5.3 Header 네비게이션 연동
- [ ] Header에 역할별 메뉴 표시 (선택)

---

## 우선순위 요약

| 우선순위 | 작업 | 예상 복잡도 |
|----------|------|-------------|
| **높음** | 비밀번호 초기화 | 낮음 |
| **높음** | 계정 잠금/해제 | 중간 |
| **높음** | 로그인 보안 (자동 잠금) | 중간 |
| 중간 | 권한 상수화 | 낮음 |
| 중간 | 사용자 소속 연결 | 중간 |
| 낮음 | 활동 이력 표시 | 중간 |
| 낮음 | 어드민 접근 제어 | 낮음 |
| 낮음 | 반응형 사이드바 | 중간 |

---

## 제외된 기능 (오버스펙)

다음 기능은 현재 시스템 규모(사용자 30~50명)에 비해 과잉 설계로 판단되어 제외:

- ❌ 커스텀 역할 생성/수정/삭제
- ❌ 동적 권한 관리 (DB 기반)
- ❌ 정책(Policy) 엔진
- ❌ 사용자 초대 시스템
- ❌ 강제 로그아웃 (세션 무효화)
- ❌ 권한-메뉴 동적 매핑

---

## 참고 문서

- `docs/role-based-home-analysis.md` - 역할별 메뉴 분기 설계
- `docs/signup-feature-analysis.md` - 회원가입 기능 설계
- `docs/admin-sidebar-ia.md` - 어드민 사이드바 IA
- `docs/user-permission-analysis.md` - 사용자/권한 관리 분석
