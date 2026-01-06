# 역할별 메인화면 메뉴 분기 분석

## 1. 요구사항 정리

### 역할별 표시 메뉴

| 역할 | 한글명 | 표시 메뉴 |
|------|--------|-----------|
| `user` | 사용자 | 새 지출결의서 작성, 지출결의서 목록 |
| `team_leader` | 팀장 | 새 지출결의서 작성, 지출결의서 목록 |
| `accountant` | 회계 | 전체 메뉴 |
| `finance_head` | 재정팀장 | 전체 메뉴 |
| `admin_assistant` | 행정간사 | 전체 메뉴 |
| `admin` | 관리자 | 전체 메뉴 |

### 메뉴 분류

**기본 메뉴 (모든 역할)**
- 새 지출결의서 작성 (`/expenses/new`)
- 지출결의서 목록 (`/expenses`)

**확장 메뉴 (accountant, finance_head, admin_assistant, admin만)**
- 간편 지출결의서 작성 (`/expenses/simple/new`)
- 간편 지출결의서 목록 (`/expenses/simple`)
- 결재함 (`/approvals`) - 결재 권한 있는 역할만
- 관리 메뉴 (`/admin`) - admin만

---

## 2. 현재 시스템 구조 분석

### 2.1 역할 시스템 (이미 구현됨)

```typescript
// prisma/schema.prisma
enum UserRole {
  admin            // 시스템 관리자
  finance_head     // 재정팀장 (3차/최종 결재)
  accountant       // 회계 (2차 결재)
  team_leader      // 팀장 (1차 결재)
  admin_assistant  // 행정간사 (지출관리, 엑셀 다운로드)
  user             // 일반 사용자
}
```

### 2.2 인증 시스템 (이미 구현됨)

```typescript
// lib/auth.ts
export async function getCurrentUser(): Promise<UserInfo | null>
```

- 쿠키 기반 세션 관리
- `getCurrentUser()`로 로그인 사용자 정보 조회 가능
- `UserInfo`에 `role` 필드 포함

### 2.3 현재 메인 페이지 구조

**파일**: `app/page.tsx`

현재는 모든 메뉴를 무조건 표시:
- 기존 지출결의서 (Ver.4.1.3): 새 작성, 목록
- 간편 지출결의서 (Ver.4.1.4): 새 작성, 목록
- 통계 카드

**문제점**: 역할에 따른 메뉴 분기 없음

---

## 3. 구현 설계

### 3.1 메뉴 접근 권한 정의

```typescript
// lib/constants/menu-permissions.ts

import { UserRole } from '@prisma/client';

// 기본 메뉴 (모든 로그인 사용자)
export const BASIC_MENUS = [
  { href: '/expenses/new', label: '새 지출결의서 작성' },
  { href: '/expenses', label: '지출결의서 목록' },
];

// 확장 메뉴 접근 가능 역할
export const EXTENDED_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'admin_assistant',
];

// 결재함 접근 가능 역할
export const APPROVAL_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'team_leader',
];

// 관리 메뉴 접근 가능 역할
export const ADMIN_MENU_ROLES: UserRole[] = [
  'admin',
];

// 역할별 메뉴 접근 권한 체크 함수
export function canAccessExtendedMenu(role: UserRole): boolean {
  return EXTENDED_MENU_ROLES.includes(role);
}

export function canAccessApprovalMenu(role: UserRole): boolean {
  return APPROVAL_MENU_ROLES.includes(role);
}

export function canAccessAdminMenu(role: UserRole): boolean {
  return ADMIN_MENU_ROLES.includes(role);
}
```

### 3.2 메인 페이지 수정 방안

**옵션 A: Server Component로 구현 (권장)**

```typescript
// app/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HomeClient from '@/components/HomeClient';

export default async function Home() {
  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로
  if (!user) {
    redirect('/login');
  }

  return <HomeClient user={user} />;
}
```

```typescript
// components/HomeClient.tsx
'use client';

import { UserInfo } from '@/lib/users';
import { canAccessExtendedMenu, canAccessApprovalMenu, canAccessAdminMenu } from '@/lib/constants/menu-permissions';

interface Props {
  user: UserInfo;
}

export default function HomeClient({ user }: Props) {
  const showExtendedMenu = canAccessExtendedMenu(user.role);
  const showApprovalMenu = canAccessApprovalMenu(user.role);
  const showAdminMenu = canAccessAdminMenu(user.role);

  return (
    // 조건부 메뉴 렌더링
  );
}
```

**옵션 B: Client Component만으로 구현**

```typescript
// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // 조건부 렌더링
}
```

### 3.3 권장 방안: 옵션 A (Server Component)

**장점:**
- 서버에서 권한 검증 (보안 강화)
- 초기 로딩 시 깜빡임 없음
- SEO 친화적

---

## 4. UI 설계

### 4.1 역할별 메인화면 레이아웃

**user, team_leader (기본 뷰)**
```
┌─────────────────────────────────────────┐
│         지출결의서 관리 시스템            │
│    교회 지출결의서를 간편하게 작성하세요     │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │ + 새 작성   │  │ 📄 목록    │       │
│  │             │  │             │       │
│  │지출결의서작성│  │지출결의서목록│       │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

**accountant, finance_head, admin_assistant, admin (확장 뷰)**
```
┌─────────────────────────────────────────┐
│         지출결의서 관리 시스템            │
├─────────────────────────────────────────┤
│  기존 지출결의서 (Ver.4.1.3)             │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ + 새 작성   │  │ 📄 목록    │       │
│  └─────────────┘  └─────────────┘      │
├─────────────────────────────────────────┤
│  간편 지출결의서 (Ver.4.1.4)             │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ + 간편 작성 │  │ 📄 간편목록│       │
│  └─────────────┘  └─────────────┘      │
├─────────────────────────────────────────┤
│  결재 & 관리                             │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ ✓ 결재함   │  │ ⚙️ 관리   │       │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

### 4.2 결재함 메뉴 표시 조건

- `team_leader`: 결재함 표시 (1차 결재)
- `accountant`: 결재함 표시 (2차 결재)
- `finance_head`: 결재함 표시 (3차 결재)
- `admin`: 결재함 표시 (전체 조회)
- `admin_assistant`: 결재함 미표시 (결재 권한 없음)
- `user`: 결재함 미표시

---

## 5. 구현 파일 목록

### 신규 생성

| 파일 | 설명 |
|------|------|
| `lib/constants/menu-permissions.ts` | 메뉴 접근 권한 상수/함수 |
| `components/HomeClient.tsx` | 역할별 메인화면 클라이언트 컴포넌트 |

### 수정

| 파일 | 수정 내용 |
|------|-----------|
| `app/page.tsx` | Server Component로 변경, 로그인 체크 추가 |

---

## 6. 추가 고려사항

### 6.1 미로그인 상태 처리

현재 메인 페이지는 로그인 없이 접근 가능. 역할별 메뉴를 표시하려면:
- 미로그인 시 `/login`으로 리다이렉트
- 또는 미로그인 시 로그인 버튼만 표시

**권장**: 미로그인 시 로그인 페이지로 리다이렉트

### 6.2 Header 컴포넌트 연동

`components/Header.tsx`에도 역할별 네비게이션 메뉴 적용 필요할 수 있음

### 6.3 URL 직접 접근 방어

메인 화면에서 메뉴를 숨겨도 URL 직접 접근은 가능.
각 페이지에서 별도로 권한 체크 필요:

```typescript
// app/admin/page.tsx
const user = await getCurrentUser();
if (!user || !canAccessAdminMenu(user.role)) {
  redirect('/');
}
```

### 6.4 연도별 역할 고려

현재 `UserYearRole` 테이블로 연도별 역할 관리 중.
메뉴 표시 시 현재 연도의 역할을 조회해야 할 수도 있음.

```typescript
// 예: 2025년 기준 역할 조회
const currentYear = new Date().getFullYear();
const yearRole = await prisma.userYearRole.findUnique({
  where: { userId_year: { userId: user.id, year: currentYear } }
});
const effectiveRole = yearRole?.role ?? user.role;
```

---

## 7. 테스트 시나리오

| 역할 | 기대 결과 |
|------|-----------|
| 미로그인 | 로그인 페이지로 리다이렉트 |
| user | 기본 메뉴 2개만 표시 |
| team_leader | 기본 메뉴 2개 + 결재함 |
| accountant | 전체 메뉴 (관리 제외) |
| finance_head | 전체 메뉴 (관리 제외) |
| admin_assistant | 전체 메뉴 (관리 제외, 결재함 제외) |
| admin | 전체 메뉴 (관리 포함) |

---

## 8. 구현 우선순위

1. **Phase 1**: 메인 페이지 역할별 메뉴 분기
   - `lib/constants/menu-permissions.ts` 생성
   - `app/page.tsx` 수정

2. **Phase 2**: Header 네비게이션 연동 (필요시)

3. **Phase 3**: 각 페이지 권한 방어 (필요시)
