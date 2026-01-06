# 일일 작업 보고 - 2026-01-06

## 완료된 작업 요약

### 1. 역할별 메인화면 메뉴 분기 구현

#### 요구사항
- `user`, `team_leader` 역할: 기본 메뉴만 표시 (새 지출결의서 작성, 지출결의서 목록)
- 나머지 역할(`admin`, `finance_head`, `accountant`, `admin_assistant`): 전체 메뉴 표시

#### 구현 내용
| 파일 | 작업 |
|------|------|
| `lib/constants/menu-permissions.ts` | 역할별 메뉴 접근 권한 상수 정의 |
| `components/HomeClient.tsx` | 클라이언트 컴포넌트로 조건부 메뉴 렌더링 |
| `app/page.tsx` | 서버 컴포넌트로 변경, 로그인 체크 추가 |

#### 주요 코드
```typescript
// menu-permissions.ts
export const EXTENDED_MENU_ROLES: UserRole[] = ['admin', 'finance_head', 'accountant', 'admin_assistant'];
export const APPROVAL_MENU_ROLES: UserRole[] = ['admin', 'finance_head', 'accountant', 'team_leader'];
export const ADMIN_MENU_ROLES: UserRole[] = ['admin'];
```

---

### 2. 회원가입 기능 구현

#### 요구사항
- 로그인 페이지에서 회원가입 링크 제공
- 회원가입 시 역할은 `user`로 고정 (보안)

#### 구현 내용
| 파일 | 작업 |
|------|------|
| `app/api/auth/signup/route.ts` | 회원가입 API (POST) |
| `app/signup/page.tsx` | 회원가입 폼 페이지 |
| `app/login/page.tsx` | 회원가입 링크 및 성공 메시지 추가 |

#### API 스펙
- **Endpoint**: `POST /api/auth/signup`
- **Request Body**: `{ userid, username, password }`
- **Validation**: 아이디/이름/비밀번호 4자 이상

---

### 3. 어드민 사이드바 레이아웃 구현

#### 요구사항
- `/admin` 하위 페이지에 공통 사이드바 적용
- 그룹별 메뉴 구성 (조직, 사용자, 예산, 현황)

#### 구현 내용
| 파일 | 작업 |
|------|------|
| `lib/constants/admin-menu.ts` | 사이드바 메뉴 구조 정의 |
| `components/admin/AdminSidebar.tsx` | 사이드바 컴포넌트 |
| `components/admin/AdminLayout.tsx` | 어드민 레이아웃 (Header + Sidebar) |
| `app/admin/layout.tsx` | Next.js 레이아웃 적용 |

#### 메뉴 구조
```
조직
├── 위원회 관리
└── 사역팀(부) 관리

사용자
├── 사용자 관리
├── 사용자 일괄 등록
├── 연도별 역할 관리
└── 역할 안내

예산
├── 예산 마스터 관리
└── 세목별 담당자 관리

현황
└── 연도별 팀장 현황
```

---

### 4. 위원회/사역팀 관리 기능 구현

#### 구현 내용

##### 위원회 관리 (`/admin/committees`)
| 파일 | 작업 |
|------|------|
| `app/admin/committees/page.tsx` | 위원회 목록/추가/수정/삭제 UI |
| `app/api/committees/route.ts` | GET (목록), POST (추가) |
| `app/api/committees/[id]/route.ts` | PATCH (수정), DELETE (삭제) |

##### 사역팀 관리 (`/admin/departments`)
| 파일 | 작업 |
|------|------|
| `app/admin/departments/page.tsx` | 위원회별 그룹핑, 접기/펼치기 UI |
| `app/api/departments/route.ts` | GET (목록), POST (추가) |
| `app/api/departments/[id]/route.ts` | PATCH (수정), DELETE (삭제) |

#### 주요 기능
- 인라인 편집 (이름 수정)
- 활성/비활성 토글
- 삭제 시 연관 데이터 체크 (하위 사역팀, 예산 세목)

---

### 5. 역할 안내 페이지 구현

#### 구현 내용
| 파일 | 작업 |
|------|------|
| `app/admin/roles/page.tsx` | 6개 역할별 권한 정보 표시 (읽기 전용) |

#### 표시 내용
- 역할명 (한글)
- 접근 가능 메뉴
- 주요 권한
- 비고 (역할 특징)

---

### 6. 분석 문서 작성

| 파일 | 내용 |
|------|------|
| `docs/role-based-home-analysis.md` | 역할별 메인화면 분기 설계 |
| `docs/signup-feature-analysis.md` | 회원가입 기능 설계 |
| `docs/admin-sidebar-ia.md` | 어드민 사이드바 IA 설계 |
| `docs/user-permission-analysis.md` | 사용자/권한 관리 적정 범위 분석 |
| `docs/remaining-tasks.md` | 남은 작업 TODO 목록 |

---

## 해결한 이슈

### 1. Prisma 클라이언트 모듈 에러
- **문제**: `HomeClient.tsx`에서 Prisma 모듈을 간접 import하여 클라이언트 컴포넌트 에러 발생
- **해결**: `ROLE_NAMES`를 `menu-permissions.ts`로 이동 (클라이언트 안전 파일)

### 2. 개발 서버 락 파일 이슈
- **문제**: `.next/dev/lock` 파일로 인한 서버 시작 실패
- **해결**: 락 파일 삭제 (`rm -f .next/dev/lock`)

---

## 생성된 파일 목록

### 새로 생성
```
lib/constants/menu-permissions.ts
lib/constants/admin-menu.ts
components/HomeClient.tsx
components/admin/AdminSidebar.tsx
components/admin/AdminLayout.tsx
app/admin/layout.tsx
app/admin/committees/page.tsx
app/admin/departments/page.tsx
app/admin/roles/page.tsx
app/api/auth/signup/route.ts
app/api/committees/route.ts
app/api/committees/[id]/route.ts
app/api/departments/route.ts
app/api/departments/[id]/route.ts
app/signup/page.tsx
docs/role-based-home-analysis.md
docs/signup-feature-analysis.md
docs/admin-sidebar-ia.md
docs/user-permission-analysis.md
docs/remaining-tasks.md
```

### 수정됨
```
app/page.tsx
app/login/page.tsx
app/admin/page.tsx
```

---

## 남은 작업 (요약)

| 우선순위 | 작업 |
|----------|------|
| 높음 | 비밀번호 초기화 기능 |
| 높음 | 계정 잠금/해제 기능 |
| 높음 | 로그인 보안 강화 (자동 잠금) |
| 중간 | 권한 상수화 (permissions.ts) |
| 중간 | 사용자-사역팀 연결 |
| 낮음 | 활동 이력 표시 |
| 낮음 | 어드민 접근 제어 |
| 낮음 | 반응형 사이드바 |

자세한 내용은 `docs/remaining-tasks.md` 참조

---

## 참고

- 빌드 테스트: `npm run build` ✅ 성공
- 개발 서버: `npm run dev` ✅ 정상 동작
