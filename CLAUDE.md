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
├── layout.tsx                    # Root layout
├── page.tsx                      # Home page
├── expenses/
│   ├── page.tsx                 # List view with filters & pagination
│   ├── new/page.tsx             # Create form
│   └── [id]/
│       ├── page.tsx             # Detail view with PDF download
│       └── edit/page.tsx        # Edit form
└── api/
    ├── expenses/
    │   ├── route.ts             # GET (list), POST (create)
    │   └── [id]/route.ts        # GET (detail), PUT (update), DELETE
    └── budget/
        └── route.ts             # GET (all), POST (hierarchical filter)

components/
├── BudgetSelector.tsx           # Cascading 5-level dropdown selector
├── ExpenseForm.tsx              # Shared create/edit form
└── PDFDocument.tsx              # PDF template using @react-pdf/renderer

lib/
├── prisma.ts                    # Singleton Prisma client
├── validators.ts                # Zod schemas & calculation functions
└── utils.ts                     # Utility functions (cn for Tailwind)

prisma/
├── schema.prisma                # Database schema definition
└── seed.ts                      # Seeds 204 budget master items
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
5. **No mobile optimization** - Tablet/desktop focused (basic responsive support)
6. **No email notifications** - Manual process tracking
7. **Home page minimal** - Simple landing page, main entry is expenses list

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
- **README**: See `README.md` for Korean installation guide
