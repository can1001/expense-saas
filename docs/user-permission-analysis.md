# 사용자/권한 관리 시스템 분석

## 1. 현재 시스템 현황

### 1.1 기존 구현

| 구분 | 현재 상태 |
|------|-----------|
| 역할(Role) | 6개 고정 enum (admin, finance_head, accountant, team_leader, admin_assistant, user) |
| 연도별 역할 | UserYearRole 테이블로 연도별 역할 관리 |
| 사용자 상태 | isActive (활성/비활성) |
| 권한 체크 | 하드코딩 (menu-permissions.ts) |
| 감사 로그 | ApprovalLog (결재 액션만) |

### 1.2 현재 역할별 권한 (하드코딩)

```typescript
// 현재 구현된 권한 체크
- canAccessExtendedMenu: admin, finance_head, accountant, admin_assistant
- canAccessApprovalMenu: admin, finance_head, accountant, team_leader
- canAccessAdminMenu: admin
```

---

## 2. 제안된 기능 분석

### 2.1 사용자 관리

| 기능 | 현재 | 제안 | 판정 |
|------|------|------|------|
| 사용자 목록/검색 | O | O | **유지** |
| 필터(활성/비활성) | O | O | **유지** |
| 필터(잠금) | X | O | **적정** |
| 필터(초대대기) | X | O | 오버스펙 |
| 기본정보 조회 | O | O | **유지** |
| 소속(위원회·팀) | △ (department만) | O | **적정** |
| 역할(roles) 조회 | O | O | **유지** |
| 권한(permissions) 조회 | X | O | 오버스펙 |
| 로그인 이력 | X | O | **적정** |
| 활동 이력 | △ (ApprovalLog) | O | **적정** (확장) |
| 사용자 초대 | X | O | 오버스펙 |
| 비활성화 | O | O | **유지** |
| 비번 초기화 | X | O | **적정** |
| 강제 로그아웃 | X | O | 오버스펙 |

### 2.2 역할 관리(Roles)

| 기능 | 현재 | 제안 | 판정 |
|------|------|------|------|
| 역할 목록 | O (고정 enum) | O | **유지** |
| 시스템 기본 역할 | O | O | **유지** |
| 커스텀 역할 | X | O | **오버스펙** |
| 역할 상세/설명 | X | O | **적정** |
| 부여된 권한 조회 | X | O | **적정** |
| 역할별 사용자 목록 | O | O | **유지** |
| 역할 생성/복제/수정/삭제 | X | O | **오버스펙** |

### 2.3 권한 관리(Permissions)

| 기능 | 현재 | 제안 | 판정 |
|------|------|------|------|
| 권한 목록 | X (하드코딩) | O | **적정** (상수화) |
| 권한-메뉴 매핑 | X | O | **적정** |
| 정책(Policy) 관리 | X | O | **오버스펙** |
| 조건부 권한 | X | O | **오버스펙** |

---

## 3. 범위 분류

### 3.1 적정 범위 (MVP+)

교회 지출결의서 시스템에 **실제 필요한** 기능

#### A. 사용자 관리 개선

```
현재 → 개선
────────────────────────────────────────
[사용자 목록]
├── 검색 (이름, 아이디)          ✓ 있음
├── 필터: 활성/비활성            ✓ 있음
├── 필터: 역할별                 ✓ 있음
└── 필터: 잠금 상태              ★ 추가

[사용자 상세]
├── 기본 정보                    ✓ 있음
├── 소속 (위원회/팀)             ★ 개선 (정규화된 구조 연결)
├── 현재 역할                    ✓ 있음
├── 연도별 역할 이력             ✓ 있음
├── 최근 로그인 일시             ★ 추가
└── 활동 이력 (지출결의서 작성 등) ★ 추가

[사용자 작업]
├── 추가/수정                    ✓ 있음
├── 비활성화                     ✓ 있음
├── 비밀번호 초기화              ★ 추가
└── 계정 잠금/해제               ★ 추가
```

#### B. 역할 관리 (읽기 전용 + 설명)

```
[역할 목록] (고정 6개, 수정 불가)
├── admin: 시스템 관리자
│   └── 권한: 모든 메뉴 접근, 사용자 관리, 예산 관리
├── finance_head: 재정팀장
│   └── 권한: 3차 결재, 지출관리, 확장 메뉴
├── accountant: 회계
│   └── 권한: 2차 결재, 지출관리, 확장 메뉴
├── team_leader: 팀장
│   └── 권한: 1차 결재, 결재함
├── admin_assistant: 행정간사
│   └── 권한: 지출관리, 엑셀 다운로드, 확장 메뉴
└── user: 일반 사용자
    └── 권한: 지출결의서 작성/조회
```

#### C. 권한 상수화

```typescript
// lib/constants/permissions.ts

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

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: Object.values(PERMISSIONS),
  finance_head: [
    PERMISSIONS.MENU_EXPENSES,
    PERMISSIONS.MENU_EXPENSES_SIMPLE,
    PERMISSIONS.MENU_APPROVALS,
    PERMISSIONS.APPROVAL_STEP_3,
    PERMISSIONS.EXPENSE_VIEW_ALL,
    PERMISSIONS.EXPORT_EXCEL,
  ],
  // ...
};
```

### 3.2 오버스펙 (과잉 설계)

교회 시스템 규모에 **불필요한** 엔터프라이즈 기능

| 기능 | 불필요 이유 |
|------|-------------|
| **커스텀 역할 생성** | 6개 고정 역할로 충분. 교회 조직 구조가 단순함 |
| **역할 CRUD** | 역할 변경 시 코드 수정 필요 (enum 기반). DB 동적 역할 불필요 |
| **세분화된 권한 관리** | 메뉴 단위 권한으로 충분. 필드 단위 권한 불필요 |
| **정책(Policy) 관리** | "본인 위원회만 수정" 같은 조건은 코드로 처리 가능 |
| **ABAC (속성 기반 접근 제어)** | 사용자 50명 이하 시스템에 과잉 |
| **사용자 초대 시스템** | 관리자가 직접 계정 생성. 이메일 초대 불필요 |
| **초대대기 상태** | 초대 시스템 없으므로 불필요 |
| **강제 로그아웃** | 세션 만료(7일)로 충분. JWT 블랙리스트 불필요 |
| **권한-메뉴 동적 매핑** | 상수로 충분. DB 관리 불필요 |

### 3.3 판단 기준

```
시스템 규모 분석
────────────────────────────────────────
예상 사용자 수: 30~50명
역할 종류: 6개 (고정)
메뉴 수: 10개 미만
연간 지출결의서: 500~1000건

결론: 소규모 내부 시스템
→ 엔터프라이즈급 RBAC/ABAC 불필요
→ 하드코딩 + 상수화로 충분
→ 유지보수 용이성 > 유연성
```

---

## 4. 권장 구현 범위

### Phase 1: 사용자 관리 개선 (적정)

```
[스키마 변경]
User 모델에 추가:
- lockedAt: DateTime?      // 계정 잠금 일시
- lockedReason: String?    // 잠금 사유
- lastLoginAt: DateTime?   // 최근 로그인
- loginFailCount: Int      // 로그인 실패 횟수

[기능 추가]
- 비밀번호 초기화 API
- 계정 잠금/해제 API
- 로그인 시 lastLoginAt 업데이트
- 로그인 5회 실패 시 자동 잠금
```

### Phase 2: 권한 상수화 (적정)

```
[파일 생성]
lib/constants/permissions.ts
- PERMISSIONS 상수
- ROLE_PERMISSIONS 매핑
- hasPermission(role, permission) 함수

[기존 코드 리팩토링]
menu-permissions.ts → permissions.ts 통합
```

### Phase 3: 역할 설명 페이지 (적정)

```
[페이지]
/admin/roles (읽기 전용)
- 6개 역할 목록
- 각 역할별 권한 설명
- 역할별 사용자 수
- 역할별 사용자 목록 링크
```

### 구현 제외 (오버스펙)

```
❌ Role 테이블 (동적 역할)
❌ Permission 테이블 (동적 권한)
❌ RolePermission 매핑 테이블
❌ 정책(Policy) 엔진
❌ 사용자 초대 시스템
❌ 강제 로그아웃 (세션 무효화)
```

---

## 5. 결론

### 적정 범위 요약

| 영역 | 구현 내용 |
|------|-----------|
| 사용자 관리 | 잠금/해제, 비번 초기화, 로그인 이력 |
| 역할 관리 | 읽기 전용 설명 페이지 |
| 권한 관리 | 상수화 + hasPermission 함수 |

### 오버스펙 요약

| 영역 | 제외 이유 |
|------|-----------|
| 동적 역할/권한 | 소규모 시스템, 고정 역할로 충분 |
| 정책 엔진 | 코드로 처리 가능 |
| 초대 시스템 | 관리자 직접 생성으로 충분 |
| 강제 로그아웃 | 세션 만료로 충분 |

### 개발 우선순위

1. **높음**: 비밀번호 초기화, 계정 잠금
2. **중간**: 권한 상수화, 역할 설명 페이지
3. **낮음**: 로그인 이력, 활동 이력

---

## 6. 사이드바 반영

제안된 IA를 적정 범위로 수정:

```
관리자
├── 사용자
│   ├── 사용자 관리        (기존)
│   ├── 사용자 일괄 등록    (기존)
│   ├── 연도별 역할 관리    (기존)
│   └── 역할 안내          ★ 신규 (읽기 전용)
├── 예산
│   ├── 예산 마스터 관리    (기존)
│   └── 세목별 담당자 관리  (기존)
└── 현황
    └── 연도별 팀장 현황    (기존)
```
