# 지출결의서 시스템 소프트웨어 아키텍처

## 1. 시스템 개요

### 1.1 프로젝트 소개
한국어 기반 지출결의서 관리 시스템으로, 예산 항목 선택부터 결재 프로세스까지 전체 지출 관리 워크플로우를 지원합니다.

### 1.2 주요 기능
- 지출결의서 작성 및 관리 (CRUD)
- 계층형 예산 선택 시스템 (5단계)
- 3단계 결재 프로세스 (팀장 → 회계 → 재정팀장)
- 첨부파일 관리 (Cloudinary 연동)
- PDF 출력 기능
- 사용자 인증 시스템

---

## 2. 기술 스택

### 2.1 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.0.5 | React 프레임워크 (App Router) |
| React | 19 | UI 라이브러리 |
| TypeScript | 5.x | 정적 타입 |
| Tailwind CSS | 4 | 스타일링 |
| React Hook Form | 7.67.0 | 폼 관리 |
| Zod | 4.1.13 | 스키마 검증 |
| Lucide React | - | 아이콘 |

### 2.2 백엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js API Routes | 16.0.5 | REST API |
| Prisma | 7.0.1 | ORM |
| PostgreSQL | - | 데이터베이스 (Neon) |

### 2.3 외부 서비스
| 서비스 | 용도 |
|--------|------|
| Neon | PostgreSQL 호스팅 |
| Cloudinary | 이미지/파일 저장 |
| Render | 애플리케이션 호스팅 |

---

## 3. 시스템 아키텍처

### 3.1 전체 구조도

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              클라이언트 (Browser)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   로그인     │  │  지출결의서  │  │   결재함    │  │   간편양식   │        │
│  │   /login    │  │  /expenses  │  │  /approvals │  │ /expenses/  │        │
│  │             │  │             │  │             │  │   simple    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js 서버 (Render)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          Middleware (인증)                            │  │
│  │                        - 세션 확인                                    │  │
│  │                        - 보호된 라우트 처리                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌─────────────────────────────┐    │    ┌─────────────────────────────┐   │
│  │      Server Components      │    │    │        API Routes           │   │
│  │                             │    │    │                             │   │
│  │  - app/page.tsx             │    │    │  /api/auth/*                │   │
│  │  - app/expenses/page.tsx    │◄───┼───►│  /api/expenses/*            │   │
│  │  - app/approvals/page.tsx   │    │    │  /api/budget/*              │   │
│  │  - app/login/page.tsx       │    │    │  /api/approvals/*           │   │
│  │                             │    │    │  /api/upload/*              │   │
│  └─────────────────────────────┘    │    └─────────────────────────────┘   │
│                                      │                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          Prisma ORM                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
          ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
          │   PostgreSQL    │ │  Cloudinary │ │   External      │
          │     (Neon)      │ │   (이미지)   │ │   Services      │
          │                 │ │             │ │                 │
          │  - Expense      │ │  - 영수증   │ │                 │
          │  - ExpenseItem  │ │  - 첨부파일 │ │                 │
          │  - BudgetMaster │ │             │ │                 │
          │  - ApprovalLine │ └─────────────┘ └─────────────────┘
          │  - ApprovalStep │
          │  - ApprovalLog  │
          └─────────────────┘
```

### 3.2 레이어 아키텍처

```
┌───────────────────────────────────────────────────────────────┐
│                    Presentation Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Pages     │  │ Components  │  │    Hooks            │   │
│  │  (app/)     │  │             │  │  (useForm, etc.)    │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├───────────────────────────────────────────────────────────────┤
│                     Business Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ API Routes  │  │ Validators  │  │    Auth Utils       │   │
│  │ (app/api/)  │  │ (lib/)      │  │    (lib/auth.ts)    │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├───────────────────────────────────────────────────────────────┤
│                      Data Layer                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Prisma Client                        │  │
│  │                    (lib/prisma.ts)                      │  │
│  └─────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ PostgreSQL  │  │ Cloudinary  │  │    Middleware       │   │
│  │   (Neon)    │  │             │  │                     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. 디렉토리 구조

```
expense-system/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # 루트 레이아웃
│   ├── page.tsx                 # 홈페이지
│   ├── globals.css              # 글로벌 스타일
│   │
│   ├── login/                   # 로그인 페이지
│   │   └── page.tsx
│   │
│   ├── expenses/                # 지출결의서 (Ver.4.1.3)
│   │   ├── page.tsx            # 목록
│   │   ├── new/page.tsx        # 작성
│   │   ├── [id]/page.tsx       # 상세
│   │   ├── [id]/edit/page.tsx  # 수정
│   │   └── simple/             # 간편 양식 (Ver.4.1.4)
│   │       ├── page.tsx
│   │       ├── new/page.tsx
│   │       └── [id]/...
│   │
│   ├── approvals/               # 결재함
│   │   ├── page.tsx            # 결재 목록
│   │   └── [id]/page.tsx       # 결재 상세
│   │
│   └── api/                     # API 라우트
│       ├── auth/               # 인증 API
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── me/route.ts
│       ├── expenses/           # 지출결의서 API
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── submit/route.ts
│       │       ├── approve/route.ts
│       │       ├── reject/route.ts
│       │       ├── withdraw/route.ts
│       │       └── attachments/route.ts
│       ├── budget/             # 예산 API
│       │   ├── route.ts
│       │   └── simple/route.ts
│       ├── approvals/route.ts  # 결재 조회 API
│       └── upload/             # 파일 업로드 API
│           ├── route.ts
│           └── delete/route.ts
│
├── components/                  # React 컴포넌트
│   ├── Header.tsx              # 헤더 (네비게이션 + 사용자 정보)
│   ├── ExpenseForm.tsx         # 지출결의서 폼
│   ├── SimpleExpenseForm.tsx   # 간편 양식 폼
│   ├── BudgetSelector.tsx      # 계층형 예산 선택기
│   ├── FileUpload.tsx          # 파일 업로드
│   ├── PDFDocument.tsx         # PDF 템플릿
│   ├── PrintableExpense.tsx    # 인쇄용 컴포넌트
│   │
│   ├── expense-form/           # 폼 섹션 컴포넌트
│   │   ├── BudgetSection.tsx
│   │   ├── ItemsSection.tsx
│   │   ├── ApplicantSection.tsx
│   │   ├── BankSection.tsx
│   │   └── BankAccountSelector.tsx
│   │
│   ├── print/                  # 인쇄 관련 컴포넌트
│   │   ├── PrintHeader.tsx
│   │   ├── PrintItems.tsx
│   │   └── PrintFooter.tsx
│   │
│   └── ui/                     # 공통 UI 컴포넌트
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── FormField.tsx
│       ├── LoadingState.tsx
│       └── ErrorState.tsx
│
├── lib/                         # 유틸리티 및 설정
│   ├── prisma.ts               # Prisma 클라이언트
│   ├── validators.ts           # Zod 스키마 및 검증
│   ├── utils.ts                # 유틸리티 함수
│   ├── auth.ts                 # 인증 유틸리티
│   └── users.ts                # 사용자 목록
│
├── prisma/                      # 데이터베이스
│   ├── schema.prisma           # 스키마 정의
│   └── seed.ts                 # 시드 데이터
│
├── docs/                        # 문서
│   ├── ARCHITECTURE.md         # 아키텍처 문서
│   ├── ARCHITECTURE.html       # 아키텍처 문서 (HTML)
│   └── LOGIN_FEATURE.md        # 로그인 기능 문서
│
├── middleware.ts               # Next.js 미들웨어 (인증)
├── next.config.ts              # Next.js 설정
├── tailwind.config.js          # Tailwind 설정
├── tsconfig.json               # TypeScript 설정
└── package.json                # 의존성 관리
```

---

## 5. 데이터베이스 설계

### 5.1 ERD (Entity Relationship Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   BudgetMaster  │         │     Expense     │         │   ExpenseItem   │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id              │         │ id              │◄───────┐│ id              │
│ committee       │         │ committee       │        ││ expenseId (FK)  │
│ department      │         │ department      │        │├─────────────────┤
│ category        │         │ budgetCategory  │        ││ budgetDetail    │
│ subcategory     │         │ budgetSubcategory        ││ description     │
│ detail          │         │ requestAmount   │        ││ unitPrice       │
│ manager         │         │ requestDate     │        ││ quantity        │
│ accountCode     │         │ applicantName   │        ││ amount          │
│ isActive        │         │ bankName        │        ││ order           │
└─────────────────┘         │ accountNumber   │        │└─────────────────┘
                            │ accountHolder   │        │
                            │ status          │────────┘
                            │ submittedAt     │
                            │ approvedAt      │
                            └────────┬────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
┌─────────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│ ExpenseAttachment   │  │  ApprovalLine   │  │    ApprovalLog      │
├─────────────────────┤  ├─────────────────┤  ├─────────────────────┤
│ id                  │  │ id              │  │ id                  │
│ expenseId (FK)      │  │ expenseId (FK)  │  │ expenseId           │
│ publicId            │  │ currentStep     │  │ action              │
│ url                 │  │ totalSteps      │  │ actorName           │
│ secureUrl           │  │ isUrgent        │  │ stepNumber          │
│ format              │  │ snapshot        │  │ previousStatus      │
│ fileName            │  └────────┬────────┘  │ newStatus           │
│ fileSize            │           │           │ comment             │
└─────────────────────┘           │           └─────────────────────┘
                                  │
                                  ▼
                       ┌─────────────────┐
                       │  ApprovalStep   │
                       ├─────────────────┤
                       │ id              │
                       │ approvalLineId  │
                       │ stepNumber      │
                       │ stepName        │
                       │ approverName    │
                       │ status          │
                       │ approvedAt      │
                       │ comment         │
                       └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                            SIMPLE EXPENSE TABLES                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────────┐
│  SimpleExpense  │◄───────┐│  SimpleExpenseItem  │
├─────────────────┤        │├─────────────────────┤
│ id              │        ││ id                  │
│ expenseDate     │        ││ expenseId (FK)      │
│ requestAmount   │        ││ budgetCategory      │
│ requestDate     │        ││ budgetSubcategory   │
│ applicantName   │        ││ budgetDetail        │
│ bankName        │        ││ description         │
│ accountNumber   │        ││ unitPrice           │
│ accountHolder   │        ││ quantity            │
│ version         │        ││ amount              │
└────────┬────────┘        │└─────────────────────┘
         │                 │
         │                 │
         ▼                 │
┌─────────────────────────┐│
│SimpleExpenseAttachment  │┘
├─────────────────────────┤
│ id                      │
│ expenseId (FK)          │
│ publicId                │
│ url, secureUrl          │
│ fileName, fileSize      │
└─────────────────────────┘


┌─────────────────┐
│SavedBankAccount │
├─────────────────┤
│ id              │
│ bankName        │
│ accountNumber   │
│ accountHolder   │
│ nickname        │
│ isDefault       │
└─────────────────┘
```

### 5.2 주요 테이블 설명

| 테이블 | 설명 |
|--------|------|
| **Expense** | 지출결의서 메인 테이블. 예산정보, 신청자정보, 은행정보, 결재상태 포함 |
| **ExpenseItem** | 지출 세부 항목. 예산세목, 적요, 단가, 수량, 금액 |
| **ExpenseAttachment** | 첨부파일 (Cloudinary 연동) |
| **BudgetMaster** | 예산 마스터 데이터 (204개 항목). 계층형 드롭다운 옵션 |
| **ApprovalLine** | 결재선. 지출결의서당 1개, 제출 시 스냅샷 저장 |
| **ApprovalStep** | 결재 단계. 결재선당 3개 (팀장/회계/재정팀장) |
| **ApprovalLog** | 감사 로그. 모든 결재 액션 기록 |
| **SimpleExpense** | 간편 지출결의서 (Ver.4.1.4). 항목별 예산 선택 |
| **SavedBankAccount** | 저장된 은행 계좌. 빠른 입력용 |

### 5.3 결재 상태 흐름

```
┌─────────┐    제출     ┌─────────┐   1차승인   ┌───────────────┐
│  DRAFT  │───────────▶│ PENDING │───────────▶│ APPROVED_STEP_1│
│ (작성중) │            │(결재대기)│            │  (팀장 승인)   │
└─────────┘            └────┬────┘            └───────┬───────┘
     ▲                      │                         │
     │         반려         │                         │ 2차승인
     │    ┌─────────────────┘                         ▼
     │    │                               ┌───────────────┐
     │    ▼                               │ APPROVED_STEP_2│
     │ ┌─────────┐                        │  (회계 승인)   │
     │ │REJECTED │                        └───────┬───────┘
     │ │ (반려)  │                                │
     │ └─────────┘                                │ 3차승인
     │                                            ▼
     │                                ┌─────────────────┐
     │        회수                    │ APPROVED_FINAL  │
     └────────────────────────────────│ (최종 승인)     │
                                      └─────────────────┘

┌───────────┐
│ WITHDRAWN │  ◄──── 작성자가 언제든 회수 가능
│  (회수)   │        (DRAFT 상태로 돌아감)
└───────────┘
```

---

## 6. API 설계

### 6.1 인증 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 조회 |

### 6.2 지출결의서 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/expenses` | 목록 조회 (페이지네이션) |
| POST | `/api/expenses` | 신규 생성 |
| GET | `/api/expenses/[id]` | 상세 조회 |
| PUT | `/api/expenses/[id]` | 수정 |
| DELETE | `/api/expenses/[id]` | 삭제 |

### 6.3 결재 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/expenses/[id]/submit` | 결재 제출 |
| POST | `/api/expenses/[id]/approve` | 승인 |
| POST | `/api/expenses/[id]/reject` | 반려 |
| POST | `/api/expenses/[id]/withdraw` | 회수 |
| GET | `/api/approvals` | 결재 대기 목록 |

### 6.4 예산 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/budget` | 전체 예산 항목 조회 |
| POST | `/api/budget` | 계층형 필터링 |
| GET | `/api/budget/simple` | 간편 양식용 예산 조회 |

### 6.5 파일 업로드 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/upload` | 파일 업로드 (Cloudinary) |
| POST | `/api/upload/delete` | 파일 삭제 |

---

## 7. 인증 시스템

### 7.1 인증 흐름

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            인증 시스템 흐름                               │
└──────────────────────────────────────────────────────────────────────────┘

1. 로그인 요청
   ┌────────┐     POST /api/auth/login      ┌────────────┐
   │ Client │  ─────────────────────────▶  │ API Server │
   │        │  { username: "청연정혜종" }   │            │
   └────────┘                               └─────┬──────┘
                                                  │
2. 사용자 검증 & 세션 생성                          │
   ┌────────────────────────────────────────────────┘
   │
   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ const user = findUserByUsername(username);                   │
   │ if (user) {                                                  │
   │   // 쿠키에 세션 저장 (httpOnly, 7일 유효)                    │
   │   cookies().set('session', user.id, { httpOnly: true, ... });│
   │   return { success: true, user };                            │
   │ }                                                            │
   └─────────────────────────────────────────────────────────────┘

3. 보호된 라우트 접근
   ┌────────┐     GET /expenses             ┌────────────┐
   │ Client │  ─────────────────────────▶  │ Middleware │
   │        │  Cookie: session=1            │            │
   └────────┘                               └─────┬──────┘
                                                  │
4. 미들웨어 세션 확인                               │
   ┌────────────────────────────────────────────────┘
   │
   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ const session = request.cookies.get('session');              │
   │                                                              │
   │ if (protectedPaths.includes(pathname) && !session) {         │
   │   return redirect('/login');  // 로그인 페이지로              │
   │ }                                                            │
   │                                                              │
   │ return NextResponse.next();   // 통과                        │
   └─────────────────────────────────────────────────────────────┘
```

### 7.2 사용자 목록

| ID | 사용자명 |
|----|----------|
| 1 | 청연정혜종 |
| 2 | 청연김흥래 |
| 3 | 청연신창국 |
| 4 | 청연윤운문 |
| 5 | 청연송원영 |

---

## 8. 핵심 비즈니스 로직

### 8.1 금액 계산

```typescript
// 10원 단위 내림
function calculateAmount(unitPrice: number, quantity: number): number {
  return Math.floor((unitPrice * quantity) / 10) * 10;
}

// 예시: 15,000원 × 3명 = 45,000원
// 예시: 12,345원 × 2명 = 24,690원 → 24,690원 (10원 단위)
```

### 8.2 계층형 예산 선택

```
위원회 (Committee)
  └── 사역팀/부 (Department)
        └── 예산(항) (Category)
              └── 예산(목) (Subcategory)
                    └── 예산(세목) (Detail)

예시:
기획위원회
  └── 재정팀
        └── 사무행정비
              └── 사무_회의및접대비
                    └── 아웃팅비_재정팀
```

### 8.3 결재 프로세스

```
제출 → [1차] 팀장 승인 → [2차] 회계 승인 → [3차] 재정팀장 승인 → 완료
         │                   │                   │
         └───────────────────┴───────────────────┴── 반려 가능
```

---

## 9. 보안

### 9.1 인증 보안

| 항목 | 구현 |
|------|------|
| httpOnly 쿠키 | XSS 공격 방지 |
| secure 플래그 | HTTPS 전용 (프로덕션) |
| sameSite=lax | CSRF 방지 |
| 세션 만료 | 7일 |

### 9.2 데이터 검증

- Zod 스키마로 클라이언트/서버 양쪽 검증
- Prisma 트랜잭션으로 데이터 일관성 보장
- SQL Injection 방지 (Prisma ORM)

---

## 10. 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Production Environment                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │     GitHub      │  push to main                             │
│  │   Repository    │────────────────┐                          │
│  └─────────────────┘                │                          │
│                                     ▼                          │
│                          ┌─────────────────┐                   │
│                          │     Render      │                   │
│                          │   (Auto Deploy) │                   │
│                          │                 │                   │
│                          │ Build Commands: │                   │
│                          │ npm install     │                   │
│                          │ prisma generate │                   │
│                          │ npm run build   │                   │
│                          └────────┬────────┘                   │
│                                   │                            │
│                    ┌──────────────┴──────────────┐             │
│                    │                             │             │
│                    ▼                             ▼             │
│         ┌─────────────────┐           ┌─────────────────┐      │
│         │   Neon Database │           │   Cloudinary    │      │
│         │   (PostgreSQL)  │           │   (Images)      │      │
│         │                 │           │                 │      │
│         │ • ap-southeast-1│           │ • CDN 배포      │      │
│         │ • Auto-scaling  │           │ • 이미지 변환   │      │
│         │ • Connection    │           │                 │      │
│         │   pooling       │           │                 │      │
│         └─────────────────┘           └─────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.1 환경 변수

```bash
# 데이터베이스
DATABASE_URL="postgresql://..."

# 앱 URL
NEXT_PUBLIC_APP_URL="https://expense-system.onrender.com"

# Cloudinary
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

---

## 11. 성능 최적화

### 11.1 데이터베이스
- 인덱스 설정 (status, requestDate, applicantName 등)
- Prisma Connection Pooling
- Neon 서버리스 확장

### 11.2 프론트엔드
- Next.js App Router (Server Components)
- 이미지 최적화 (Cloudinary CDN)
- 코드 스플리팅 (Dynamic Import)

---

## 12. 향후 개선 사항

1. **사용자 관리 DB화**: 하드코딩된 사용자를 DB로 이전
2. **역할 기반 권한**: Admin, Manager, User 권한 분리
3. **알림 시스템**: 결재 요청/승인 알림
4. **대시보드**: 통계 및 분석 기능
5. **모바일 최적화**: 반응형 UI 개선
6. **API 문서화**: Swagger/OpenAPI 적용

---

*문서 버전: 1.0*
*최종 수정: 2025-12-21*
