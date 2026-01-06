# 어드민 페이지 사이드바 IA 설계

## 1. 현재 구조 분석

### 현재 메뉴 (카드 그리드 방식)

| 메뉴 | 경로 | 설명 |
|------|------|------|
| 사용자 관리 | `/admin/users` | 사용자 목록 조회, 추가, 수정, 비활성화 |
| 사용자 일괄 등록 | `/admin/users-upload` | Excel 파일로 사용자 일괄 등록/수정 |
| 연도별 역할 관리 | `/admin/year-roles` | 연도별 결재 역할 일괄 설정 |
| 연도별 팀장 현황 | `/admin/year-roles-summary` | 위원회/사역팀별 팀장 현황 조회 |
| 세목별 담당자 관리 | `/admin/budget-managers` | 연도별 예산 세목 담당자 및 예산금액 설정 |
| 예산 마스터 관리 | `/admin/budget-upload` | Excel 파일로 예산 항목 일괄 등록/수정 |

### 기존 DB 모델 (조직)

```prisma
model Committee {
  id          String       @id
  name        String       @unique  // "기획위원회", "선교위원회"
  sortOrder   Int
  isActive    Boolean
  departments Department[]
}

model Department {
  id           String
  committeeId  String
  committee    Committee
  name         String       // "재정팀", "공간사역팀"
  sortOrder    Int
  isActive     Boolean
}
```

### 하위 페이지

| 페이지 | 경로 | 부모 메뉴 |
|--------|------|-----------|
| 사용자 추가 | `/admin/users/new` | 사용자 관리 |
| 사용자 수정 | `/admin/users/[id]/edit` | 사용자 관리 |

---

## 2. 사이드바 IA 설계

### 2.1 메뉴 그룹화

```
┌─────────────────────────────────────────┐
│  관리자                                  │
├─────────────────────────────────────────┤
│                                         │
│  조직                                    │
│  ├─ 위원회 관리                          │
│  └─ 사역팀(부) 관리                       │
│                                         │
│  사용자                                  │
│  ├─ 사용자 관리                          │
│  ├─ 사용자 일괄 등록                      │
│  ├─ 연도별 역할 관리                      │
│  └─ 역할 안내                            │
│                                         │
│  예산                                    │
│  ├─ 예산 마스터 관리                      │
│  └─ 세목별 담당자 관리                    │
│                                         │
│  현황                                    │
│  └─ 연도별 팀장 현황                      │
│                                         │
└─────────────────────────────────────────┘
```

### 2.2 메뉴 구조 정의

```typescript
interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_SIDEBAR_MENU: SidebarGroup[] = [
  {
    title: '조직',
    items: [
      { href: '/admin/committees', label: '위원회 관리', icon: Building2 },
      { href: '/admin/departments', label: '사역팀(부) 관리', icon: Users2 },
    ],
  },
  {
    title: '사용자',
    items: [
      { href: '/admin/users', label: '사용자 관리', icon: Users },
      { href: '/admin/users-upload', label: '사용자 일괄 등록', icon: Upload },
      { href: '/admin/year-roles', label: '연도별 역할 관리', icon: CalendarCog },
      { href: '/admin/roles', label: '역할 안내', icon: Shield },
    ],
  },
  {
    title: '예산',
    items: [
      { href: '/admin/budget-upload', label: '예산 마스터 관리', icon: FileSpreadsheet },
      { href: '/admin/budget-managers', label: '세목별 담당자 관리', icon: UserCog },
    ],
  },
  {
    title: '현황',
    items: [
      { href: '/admin/year-roles-summary', label: '연도별 팀장 현황', icon: BarChart3 },
    ],
  },
];
```

### 2.3 신규 페이지 정의

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 위원회 관리 | `/admin/committees` | 위원회 목록, 추가, 수정, 순서 변경, 활성/비활성 |
| 사역팀(부) 관리 | `/admin/departments` | 사역팀 목록, 추가, 수정, 순서 변경, 활성/비활성 |
| 역할 안내 | `/admin/roles` | 6개 역할별 권한 설명 (읽기 전용) |

---

## 3. UI 레이아웃 설계

### 3.1 전체 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  Header (기존 유지)                                       │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  Sidebar   │  Main Content                               │
│  (240px)   │  (flex-1)                                   │
│            │                                             │
│  ┌──────┐  │  ┌─────────────────────────────────────┐   │
│  │사용자│  │  │                                     │   │
│  ├──────┤  │  │  현재 페이지 콘텐츠                  │   │
│  │ 관리 │  │  │                                     │   │
│  │ 등록 │  │  │                                     │   │
│  │ 역할 │  │  │                                     │   │
│  ├──────┤  │  │                                     │   │
│  │예산  │  │  │                                     │   │
│  ├──────┤  │  │                                     │   │
│  │ 마스터│  │  │                                     │   │
│  │ 담당자│  │  │                                     │   │
│  ├──────┤  │  │                                     │   │
│  │현황  │  │  │                                     │   │
│  ├──────┤  │  │                                     │   │
│  │ 팀장 │  │  └─────────────────────────────────────┘   │
│  └──────┘  │                                             │
│            │                                             │
└────────────┴─────────────────────────────────────────────┘
```

### 3.2 사이드바 상세 디자인

```
┌─────────────────────┐
│  ← 홈으로           │  ← 홈 링크
├─────────────────────┤
│                     │
│  사용자             │  ← 그룹 타이틀 (text-xs, uppercase)
│  ─────────────────  │
│  👤 사용자 관리     │  ← 메뉴 아이템 (활성화 시 bg-blue-50)
│  📤 사용자 일괄 등록│
│  📅 연도별 역할 관리│
│                     │
│  예산               │
│  ─────────────────  │
│  📊 예산 마스터 관리│
│  👥 세목별 담당자   │
│                     │
│  현황               │
│  ─────────────────  │
│  📈 연도별 팀장 현황│
│                     │
└─────────────────────┘
```

### 3.3 반응형 처리

| 화면 크기 | 사이드바 동작 |
|-----------|---------------|
| Desktop (≥1024px) | 고정 표시, 240px 너비 |
| Tablet (768-1023px) | 접히는 사이드바 (아이콘만 표시, 호버 시 확장) |
| Mobile (<768px) | 햄버거 메뉴로 토글 |

---

## 4. 구현 파일 구조

### 4.1 신규 생성 파일

```
components/
└── admin/
    ├── AdminSidebar.tsx      # 사이드바 컴포넌트
    └── AdminLayout.tsx       # 어드민 레이아웃 (사이드바 + 콘텐츠)

lib/
└── constants/
    └── admin-menu.ts         # 메뉴 구조 정의

app/
└── admin/
    └── layout.tsx            # 어드민 레이아웃 적용
```

### 4.2 수정 파일

| 파일 | 수정 내용 |
|------|-----------|
| `app/admin/page.tsx` | 대시보드 형태로 변경 (카드 그리드 유지 또는 제거) |
| `app/admin/*/page.tsx` | 개별 페이지 헤더 조정 (뒤로가기 버튼 제거 등) |

---

## 5. 컴포넌트 설계

### 5.1 AdminSidebar.tsx

```tsx
interface AdminSidebarProps {
  currentPath: string;
}

export default function AdminSidebar({ currentPath }: AdminSidebarProps) {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 min-h-screen">
      {/* 홈 링크 */}
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          홈으로
        </Link>
      </div>

      {/* 메뉴 그룹 */}
      <nav className="p-4">
        {ADMIN_SIDEBAR_MENU.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                      currentPath === item.href
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

### 5.2 AdminLayout.tsx

```tsx
interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar currentPath={pathname} />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
```

### 5.3 app/admin/layout.tsx

```tsx
import AdminLayout from '@/components/admin/AdminLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
```

---

## 6. 스타일 가이드

### 6.1 사이드바 스타일

```typescript
// lib/constants/styles.ts 에 추가

// 사이드바
export const SIDEBAR_BASE = 'w-60 bg-white border-r border-gray-200 min-h-screen';
export const SIDEBAR_GROUP_TITLE = 'text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2';
export const SIDEBAR_ITEM = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50';
export const SIDEBAR_ITEM_ACTIVE = 'bg-blue-50 text-blue-700 font-medium';
```

### 6.2 색상 팔레트

| 요소 | 색상 |
|------|------|
| 사이드바 배경 | `bg-white` |
| 경계선 | `border-gray-200` |
| 그룹 타이틀 | `text-gray-400` |
| 메뉴 아이템 | `text-gray-700` |
| 활성 메뉴 배경 | `bg-blue-50` |
| 활성 메뉴 텍스트 | `text-blue-700` |
| 호버 배경 | `bg-gray-50` |

---

## 7. 구현 순서

1. **Phase 1**: 기본 구조
   - `lib/constants/admin-menu.ts` 생성
   - `components/admin/AdminSidebar.tsx` 생성
   - `components/admin/AdminLayout.tsx` 생성

2. **Phase 2**: 레이아웃 적용
   - `app/admin/layout.tsx` 생성/수정
   - 각 페이지 헤더 조정

3. **Phase 3**: 반응형 처리 (선택)
   - 모바일 햄버거 메뉴
   - 태블릿 접히는 사이드바

---

## 8. 추가 고려사항

### 8.1 현재 위치 표시
- URL 기반 활성 메뉴 하이라이트
- 하위 페이지(`/admin/users/new`)도 부모 메뉴(`/admin/users`) 활성화

### 8.2 접근성
- 키보드 네비게이션 지원
- ARIA 레이블 추가
- 포커스 스타일 유지

### 8.3 홈 페이지(/admin) 처리
- 옵션 A: 대시보드로 유지 (통계, 빠른 링크)
- 옵션 B: 첫 번째 메뉴로 리다이렉트 (`/admin/users`)
- **권장**: 옵션 A (대시보드 유지)

### 8.4 Header와의 통합
- 기존 Header 컴포넌트 유지
- 어드민 영역에서도 동일한 Header 사용
- 로그아웃, 사용자 정보 등 Header에서 처리
