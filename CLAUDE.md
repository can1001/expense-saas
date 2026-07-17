# CLAUDE.md

Korean expense management system (지출결의서 관리 시스템) built with Next.js 16, React 19, TypeScript, Prisma, PostgreSQL (Neon).

## Quick Start

```bash
pnpm run dev          # Development server (localhost:3000)
pnpm run build        # Production build (--webpack for PWA)
pnpm run db:push      # Push schema to database
pnpm run db:seed      # Seed 204 budget items
pnpm run db:studio    # Open Prisma Studio
```

## Tech Stack

- **Framework**: Next.js 16.0.5 (App Router), React 19, TypeScript
- **Database**: PostgreSQL (Neon) + Prisma 7.0.1
- **Styling**: Tailwind CSS 4
- **Forms**: React Hook Form + Zod validation
- **PDF**: @react-pdf/renderer
- **PWA**: next-pwa (webpack mode required)
- **Mobile**: react-swipeable, lucide-react

## Key Patterns

### 1. Budget Hierarchy (5-level cascade)
위원회 → 사역팀/부 → 예산(항) → 예산(목) → 예산(세목)
- `components/BudgetSelector.tsx` handles cascading selection
- `/api/budget` POST endpoint for hierarchical filtering

### 2. Amount Calculation
```javascript
Math.floor((unitPrice × quantity) / 10) * 10  // Round down to 10 won
```
- Client-side for UX, server-side for validation
- Implemented in `lib/validators.ts`

### 3. API Structure
```
/api/expenses     GET (list), POST (create)
/api/expenses/[id] GET, PUT (full replace), DELETE
/api/budget       GET (all), POST (filter by level)
```

## Database Schema

1. **Expense** - Main record (budget hierarchy, applicant, bank info, requestAmount)
2. **ExpenseItem** - Line items (budgetDetail, unitPrice, quantity, amount)
3. **BudgetMaster** - Reference data (204 items, 5-level hierarchy)

## File Structure

```
app/               # Pages (expenses/, offline/, api/)
components/        # UI components
  ├── mobile/      # Camera, GPS, Voice input
  ├── ui/          # Skeleton, Loading, Accordion
  ├── expense-form/# Form sections
  └── *.tsx        # NavBar, Header, Card, etc.
hooks/             # useInfiniteScroll
lib/               # prisma.ts, validators.ts, utils.ts
prisma/            # schema.prisma, seed.ts
public/            # manifest.json, logo.png
```

## Mobile Features

- **Navigation**: `MobileNavBar.tsx` (bottom tabs), `MobileHeader.tsx`
- **Lists**: `ExpenseCard.tsx` (swipe gestures), infinite scroll
- **Input**: Camera (`CameraCapture.tsx`), GPS (`LocationPicker.tsx`), Voice (`VoiceInput.tsx`)
- **Loading**: Skeleton components, LoadingIndicator

### Responsive Classes
```
md:hidden         → Mobile only (< 768px)
hidden md:block   → Desktop only (≥ 768px)
min-h-[44px]      → Touch target (WCAG)
```

## PWA

- Config: `next.config.ts` (next-pwa with webpack mode)
- Offline: `app/offline/page.tsx`
- Manifest: `public/manifest.json`
- Caching: CacheFirst (fonts, static), NetworkFirst (API), StaleWhileRevalidate (images)
- Build generates: `public/sw.js`, `public/workbox-*.js`

## Development Patterns

### Adding Budget Field
1. Update `prisma/schema.prisma`
2. `pnpm run db:push`
3. Update `prisma/seed.ts`
4. Modify `components/BudgetSelector.tsx`
5. Update `/api/budget/route.ts`

### Adding Mobile Feature
1. Create in `components/mobile/`
2. Check browser API support in `useEffect`
3. Use `md:hidden` for mobile-only display
4. Export from `components/mobile/index.ts`

### Skeleton Loading
```tsx
import { ExpenseListSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
// Mobile: <ExpenseListSkeleton count={5} />
// Desktop: <TableSkeleton rows={10} />
```

## Environment Variables

```bash
DATABASE_URL="postgresql://..."           # Neon connection
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Deployment (Render)

- Build: `pnpm install && pnpm exec prisma generate && pnpm run build`
- Start: `pnpm start`
- Node: 24.x
- First deploy: `pnpm run db:push && pnpm run db:seed`

## Known Limitations

1. No authentication - open access
2. No approval workflow - direct CRUD
3. Korean PDF font - uses default (web font commented out)
4. Voice input - Chrome/Safari only (Web Speech API)
5. Camera - HTTPS required (except localhost)
6. PWA - offline caching only, no push notifications

## References

- `PRD.md` - Detailed requirements
- `MOBILE_UI_IMPROVEMENT.md` - Mobile optimization details
- `README.md` - Korean installation guide

## Claude 설정

- **언어**: 모든 설명과 응답은 한글로 작성
- **커밋 메시지**: 한글로 작성
- **코드 주석**: 한글 사용 가능
