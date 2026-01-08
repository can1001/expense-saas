# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean expense management system (지출결의서 관리 시스템) built with Next.js. This is an MVP application for managing expense requests with hierarchical budget categories, automatic calculations, PDF generation, and full CRUD operations. The system is deployed on Render with a Neon PostgreSQL database.

## Development Commands

### Core Commands
```bash
# Development
npm run dev                    # Start development server on http://localhost:3000

# Build & Production
npm run build                  # Build production bundle
npm run start                  # Start production server (uses $PORT env var)

# Database
npm run db:push               # Push schema changes to database (no migrations)
npm run db:seed               # Seed database with 204 budget master items
npm run db:studio             # Open Prisma Studio GUI for database management
npm run db:migrate            # Create and apply migrations (dev)

# Code Quality
npm run lint                  # Run ESLint
```

### Database Reset
```bash
npx prisma migrate reset      # Reset database and re-run seed
npx prisma generate           # Regenerate Prisma Client types
```

### Testing API (Browser Console)
```javascript
// Fetch budget hierarchy
fetch('/api/budget').then(r => r.json()).then(console.log);

// Create expense
fetch('/api/expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    committee: '기획위원회',
    department: '재정팀',
    budgetCategory: '사무행정비',
    budgetSubcategory: '사무_회의및접대비',
    items: [{
      budgetDetail: '아웃팅비_재정팀',
      description: '재정팀 회의 후 식사',
      unitPrice: 10000,
      quantity: 5,
      amount: 50000,
      order: 1,
    }],
    requestDate: new Date().toISOString(),
    applicantName: '홍길동',
    bankName: '우리은행',
    accountNumber: '123-456-789',
    accountHolder: '홍길동',
  })
}).then(r => r.json()).then(console.log);
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16.0.5 (App Router, React 19)
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (Neon) with Prisma 7.0.1
- **Styling**: Tailwind CSS 4
- **Forms**: React Hook Form 7.67.0 + Zod 4.1.13 validation
- **PDF**: @react-pdf/renderer 4.3.1
- **PWA**: next-pwa 5.6.0 (오프라인 지원, 서비스 워커)
- **Gestures**: react-swipeable 7.0.2 (스와이프 제스처)
- **Icons**: lucide-react (아이콘 라이브러리)
- **Deployment**: Render (serverless) + Neon PostgreSQL

### Key Design Patterns

#### 1. Hierarchical Budget Selection
The system implements a 5-level cascading selection system:
- **위원회** (Committee) → **사역팀/부** (Department) → **예산(항)** (Category) → **예산(목)** (Subcategory) → **예산(세목)** (Detail)
- Implemented in `components/BudgetSelector.tsx`
- Each level filters the next using the `/api/budget` POST endpoint
- Budget master data (204 items) seeded from `prisma/seed.ts`

#### 2. Automatic Amount Calculation
- **Formula**: `Math.floor((unitPrice × quantity) / 10) * 10`
- Rounds down to nearest 10 won (Korean currency)
- Implemented in `lib/validators.ts`:
  - `calculateAmount()`: per-item calculation
  - `calculateTotal()`: sum all items
- Calculation happens on both client and server for validation

#### 3. Form State Management
- Uses React Hook Form with Zod schema validation
- Shared `ExpenseForm.tsx` component for both Create and Update operations
- Form distinguishes mode via `initialData` prop (undefined = create, present = update)
- Real-time amount calculation with `watch()` hook

#### 4. API Route Structure
```
/api/expenses
  ├── GET     - List with pagination (default: 10 per page)
  ├── POST    - Create new expense
  └── /[id]
      ├── GET    - Get single expense with items
      ├── PUT    - Update expense (full replacement)
      └── DELETE - Hard delete with cascade to items

/api/budget
  ├── GET  - Fetch all budget items with filters
  └── POST - Hierarchical filtering (returns next level options)
```

### Database Schema

#### Core Tables
1. **Expense** - Main expense request record
   - Stores budget hierarchy selections (committee, department, category, subcategory)
   - Includes applicant info, bank details, request/expense dates
   - `requestAmount` is auto-calculated from items
   - Soft versioning with `version` field (default: "4.1.3")

2. **ExpenseItem** - Line items for each expense
   - Links to Expense via `expenseId` (cascade delete)
   - Contains: budgetDetail, description, unitPrice, quantity, amount, order
   - Order field (1-10) for display sequence

3. **BudgetMaster** - Hierarchical budget reference data
   - 204 seeded items defining valid budget paths
   - Unique constraint on full hierarchy path
   - Includes optional manager, accountCode, description fields
   - `isActive` flag for soft deletion

#### Indexes
- Expense: `[committee]`, `[department]`, `[budgetCategory, budgetSubcategory]`, `[requestDate]`, `[createdAt]`
- ExpenseItem: `[expenseId]`
- BudgetMaster: `[committee]`, `[department]`, `[category, subcategory, detail]`

### File Structure
```
app/
├── layout.tsx                    # Root layout (PWA 메타데이터 포함)
├── page.tsx                      # Home page
├── offline/page.tsx              # PWA 오프라인 폴백 페이지
├── expenses/
│   ├── page.tsx                 # List view (무한스크롤 + 스켈레톤)
│   ├── new/page.tsx             # Create form
│   └── [id]/
│       ├── page.tsx             # Detail view (아코디언 UI)
│       └── edit/page.tsx        # Edit form
└── api/
    ├── expenses/
    │   ├── route.ts             # GET (list), POST (create)
    │   └── [id]/route.ts        # GET (detail), PUT (update), DELETE
    └── budget/
        └── route.ts             # GET (all), POST (hierarchical filter)

components/
├── mobile/                      # 모바일 전용 컴포넌트
│   ├── CameraCapture.tsx       # 카메라 영수증 촬영
│   ├── LocationPicker.tsx      # GPS 위치 입력
│   ├── VoiceInput.tsx          # 음성 텍스트 입력
│   └── index.ts
├── ui/                          # 공통 UI 컴포넌트
│   ├── Skeleton.tsx            # 스켈레톤 로딩
│   ├── LoadingIndicator.tsx    # 로딩 인디케이터
│   └── Accordion.tsx           # 접이식 섹션
├── MobileNavBar.tsx            # 모바일 하단 탭 네비게이션
├── MobileHeader.tsx            # 모바일 상단 헤더
├── MobileFilterPanel.tsx       # 모바일 바텀시트 필터
├── ExpenseCard.tsx             # 스와이프 지원 카드 (모바일 목록)
├── BudgetSelector.tsx          # Cascading 5-level dropdown selector
├── ExpenseForm.tsx             # Shared create/edit form
└── PDFDocument.tsx             # PDF template using @react-pdf/renderer

hooks/
├── useInfiniteScroll.ts        # 무한 스크롤 훅

lib/
├── prisma.ts                    # Singleton Prisma client
├── validators.ts                # Zod schemas & calculation functions
└── utils.ts                     # Utility functions (cn for Tailwind)

types/
├── next-pwa.d.ts               # next-pwa 타입 정의

prisma/
├── schema.prisma                # Database schema definition
└── seed.ts                      # Seeds 204 budget master items

public/
├── manifest.json               # PWA 매니페스트
├── logo.png                    # 앱 아이콘
└── sw.js                       # 서비스 워커 (빌드 시 생성)
```

## Important Implementation Details

### Amount Calculation Rules
- **10 won rounding**: All amounts rounded down to nearest 10 won
- Client-side calculation for UX (immediate feedback)
- Server-side recalculation for security (never trust client)
- Validation in API ensures calculated amounts match

### PDF Generation
- Client-side generation using @react-pdf/renderer
- Template in `components/PDFDocument.tsx`
- Filename format: `지출결의서_[청구인]_[날짜].pdf`
- Korean font support commented out (uses default fonts in MVP)
- A4 size, blue theme (#3B82F6)

### Form Validation
- Zod schemas in `lib/validators.ts`
- Required fields: committee, department, budgetCategory, budgetSubcategory, applicantName, bankName, accountNumber, accountHolder
- Date fields: auto-converted from string to Date objects
- Items: minimum 1, maximum 10 (UI enforced)
- Positive integers required for unitPrice and quantity

### Cascading Updates
- When changing any budget level, all child levels reset
- BudgetSelector manages this in `handleChange()` method
- State arrays cleared for dependent levels
- Prevents invalid selections (e.g., wrong subcategory for category)

### Transaction Handling
- Expense creation uses Prisma nested create (atomic)
- Updates replace all items (delete old, create new - handled in transaction)
- No partial updates - full replacement strategy

## Mobile UI Components

### Navigation
- `MobileNavBar.tsx` - 하단 탭 네비게이션 (홈, 목록, 신규작성, 마이페이지)
- `MobileHeader.tsx` - 모바일 상단 헤더 (뒤로가기, 제목, 액션)
- `MobileFilterPanel.tsx` - 바텀시트 필터 패널

### Cards & Lists
- `ExpenseCard.tsx` - 스와이프 지원 카드 (왼쪽 스와이프로 액션 버튼 노출)
- `ui/Accordion.tsx` - 접이식 섹션 (상세 페이지용)

### Mobile-specific Features
- `mobile/CameraCapture.tsx` - 카메라로 영수증 촬영 (MediaDevices API)
- `mobile/LocationPicker.tsx` - GPS 위치 입력 (Geolocation API + OpenStreetMap)
- `mobile/VoiceInput.tsx` - 음성 텍스트 입력 (Web Speech API)

### Loading States
- `ui/Skeleton.tsx` - 스켈레톤 로딩 (카드, 테이블, 폼 등)
- `ui/LoadingIndicator.tsx` - 로딩 인디케이터 (스피너, 에러, 빈 상태)

### Responsive Patterns
```
모바일 전용:     md:hidden         (768px 미만에서 표시)
데스크톱 전용:   hidden md:block   (768px 이상에서 표시)
터치 타겟:       min-h-[44px]      (WCAG 권장 최소 크기)
```

## PWA (Progressive Web App)

### Configuration
- `next.config.ts` - next-pwa 설정 (webpack 모드 필수)
- `public/manifest.json` - 앱 메타데이터, 아이콘, 바로가기
- `app/offline/page.tsx` - 오프라인 폴백 페이지
- `app/layout.tsx` - viewport, appleWebApp 메타데이터

### Caching Strategy
| 리소스 | 전략 | 만료 |
|--------|------|------|
| Google Fonts | CacheFirst | 1년 |
| 이미지 | StaleWhileRevalidate | 24시간 |
| API | NetworkFirst | 24시간 (10초 타임아웃) |
| 정적 자산 (JS/CSS) | CacheFirst | 24시간 |

### Build Note
```bash
npm run build  # package.json에 --webpack 플래그 포함
```
- PWA 서비스 워커는 프로덕션 빌드에서만 생성됨
- 개발 모드에서는 `disable: true`로 비활성화

### Generated Files (gitignore)
```
public/sw.js
public/sw.js.map
public/workbox-*.js
```

## Performance Optimization

### Skeleton Loading
초기 로딩 시 레이아웃 유지를 위한 스켈레톤 UI:
```tsx
import { ExpenseListSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

if (loading) {
  return (
    <>
      <div className="md:hidden"><ExpenseListSkeleton count={5} /></div>
      <div className="hidden md:block"><TableSkeleton rows={10} /></div>
    </>
  );
}
```

### Infinite Scroll (Mobile)
- `hooks/useInfiniteScroll.ts` - Intersection Observer 기반
- 모바일에서 10개씩 점진적 로드
- 데스크톱은 기존 페이지네이션 유지

```tsx
// 사용 예시
const [visibleCount, setVisibleCount] = useState(10);
const loadMoreRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      setVisibleCount(prev => prev + 10);
    }
  });
  if (loadMoreRef.current) observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, []);
```

## Common Development Patterns

### Adding a New Budget Hierarchy Field
1. Update `prisma/schema.prisma` BudgetMaster model
2. Run `npm run db:push` to sync schema
3. Update `prisma/seed.ts` with new field data
4. Modify `components/BudgetSelector.tsx` to include new level
5. Update API `/api/budget/route.ts` POST handler
6. Update Zod schemas in `lib/validators.ts`

### Adding Search/Filter Features
- Expense list page has search/filter patterns in `app/expenses/page.tsx`
- Uses URL search params for state management
- Backend: construct Prisma `where` object from query params
- Frontend: controlled inputs + `useRouter()` for URL updates

### Modifying PDF Layout
- Edit `components/PDFDocument.tsx`
- Uses @react-pdf/renderer components (View, Text, Document, Page)
- Styles via `StyleSheet.create()`
- Korean font requires web font setup (currently commented out)

### Adding Mobile-specific Features
1. `components/mobile/` 디렉토리에 컴포넌트 생성
2. `md:hidden` 클래스로 모바일에서만 표시
3. 브라우저 API 지원 여부 확인 (예: `navigator.mediaDevices`)
4. `components/mobile/index.ts`에 export 추가

```tsx
// 브라우저 API 지원 확인 패턴
const [isSupported, setIsSupported] = useState(false);

useEffect(() => {
  setIsSupported('mediaDevices' in navigator);
}, []);

if (!isSupported) return null;
```

### Using Skeleton Loading
```tsx
import { ExpenseCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

// 카드 목록
<ExpenseListSkeleton count={5} />

// 테이블
<TableSkeleton rows={10} columns={8} />

// 폼
<FormSkeleton />
```

### Adding Swipe Gestures
```tsx
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => setIsOpen(true),
  onSwipedRight: () => setIsOpen(false),
  trackTouch: true,
  preventScrollOnSwipe: true,
});

return <div {...handlers}>...</div>;
```

## Environment Variables

Required in `.env`:
```bash
DATABASE_URL="postgresql://..."          # Neon PostgreSQL connection string
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Base URL for app
```

For production (Render):
- Set `DATABASE_URL` in dashboard
- Set `NEXT_PUBLIC_APP_URL` to Render domain
- `PORT` env var automatically provided by Render

## Known Limitations (MVP)

1. **No authentication/authorization** - Open access to all functions
2. **Hard delete only** - No soft delete or audit trail
3. **No approval workflow** - Expenses directly created/edited
4. **Korean font in PDF** - Uses default fonts (web font implementation commented out)
5. **Basic PWA** - 오프라인 캐싱만 지원, 푸시 알림 미구현
6. **No email notifications** - Manual process tracking
7. **Home page minimal** - Simple landing page, main entry is expenses list
8. **Voice Input** - Chrome/Safari만 지원 (Firefox 미지원, Web Speech API)
9. **Camera API** - HTTPS 필수 (localhost 제외), 일부 브라우저 제한

## Deployment

### Render Configuration
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Start Command**: `npm start` (uses `PORT` env var)
- **Node Version**: 24.x (specified in package.json engines)
- Auto-deploy from main branch

### Post-Deployment
```bash
# First deployment only - seed database
npm run db:push    # Apply schema
npm run db:seed    # Insert 204 budget items
```

## References

- **PRD**: See `PRD.md` for detailed requirements
- **Implementation Status**: See `IMPLEMENTATION_CHECKLIST.md` for 95% completion checklist
- **Mobile UI**: See `MOBILE_UI_IMPROVEMENT.md` for mobile optimization details
- **README**: See `README.md` for Korean installation guide
