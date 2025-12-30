# User-Expense 통합 수정 전략

## 개요

비밀번호 기반 로그인 인증 구현 후, 사용자별 지출결의서 관리를 위한 수정 전략입니다.

**목표:**
1. 지출결의서 목록을 로그인 사용자 기준으로 필터링
2. 지출결의서 작성 시 사용자의 은행 계좌 자동 조회 (여러 계좌 지원)

---

## 결정 사항

- **역할별 조회 권한**: admin, finance_head, accountant, admin_assistant → 전체 조회 / team_leader, user → 본인/부서만
- **기존 데이터**: 삭제 예정 (마이그레이션 불필요)
- **은행 계좌 관리**: 사용자당 여러 계좌 (SavedBankAccount + User 연결)

---

## 현재 상태 분석

### 1. User 모델
```prisma
model User {
  id          String    @id @default(cuid())
  userid      String    @unique
  username    String
  password    String?
  role        UserRole  @default(user)
  department  String?
  isActive    Boolean   @default(true)
  // SavedBankAccount 관계 없음
}
```

### 2. Expense 모델
```prisma
model Expense {
  applicantName   String      // 청구인 (문자열만)
  bankName        String
  accountNumber   String
  accountHolder   String
  // userId FK 없음 - User와 직접 관계 없음
}
```

### 3. SavedBankAccount 모델
```prisma
model SavedBankAccount {
  id             String   @id
  bankName       String
  accountNumber  String   @unique
  accountHolder  String
  nickname       String?
  isDefault      Boolean  @default(false)
  // userId FK 없음 - 전역 계좌 목록 (모든 사용자가 공유)
}
```

### 문제점
- Expense에 userId가 없어 **작성자 추적 불가**
- SavedBankAccount가 User와 연결되지 않아 **사용자별 계좌 관리 불가**

---

## 수정 전략

### Phase 1: 데이터베이스 스키마 수정

#### 1-1. SavedBankAccount 모델에 userId FK 추가
```prisma
model SavedBankAccount {
  id             String   @id @default(cuid())
  bankName       String
  accountNumber  String
  accountHolder  String
  nickname       String?
  isDefault      Boolean  @default(false)

  // 새로 추가할 필드
  userId         String              // 소유자 ID
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // 변경: 같은 사용자 내에서만 계좌번호 중복 방지
  @@unique([userId, accountNumber])
  @@index([userId])
  @@index([isDefault])
}
```

#### 1-2. User 모델에 관계 추가
```prisma
model User {
  id            String    @id @default(cuid())
  userid        String    @unique
  username      String
  password      String?
  role          UserRole  @default(user)
  department    String?
  isActive      Boolean   @default(true)

  // 관계 추가
  expenses      Expense[]           // 작성한 지출결의서
  bankAccounts  SavedBankAccount[]  // 저장된 은행 계좌들

  yearRoles     UserYearRole[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

#### 1-3. Expense 모델에 userId FK 추가
```prisma
model Expense {
  id                String    @id @default(cuid())
  // 기존 필드들...

  // 새로 추가할 필드
  userId            String            // 작성자 ID
  user              User     @relation(fields: [userId], references: [id])

  // 기존 applicantName, 은행 정보는 유지 (제출 시점의 값 저장)
  applicantName     String
  bankName          String
  accountNumber     String
  accountHolder     String

  @@index([userId])
}
```

#### 1-4. 마이그레이션 명령
```bash
npx prisma db push  # 스키마 변경 적용
```

---

### Phase 2: API 수정

#### 2-1. GET /api/expenses - 사용자별 필터링

**파일:** `app/api/expenses/route.ts`

**수정 내용:**
```typescript
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const where: Prisma.ExpenseWhereInput = {};

  // 역할에 따른 조회 범위 결정
  const fullAccessRoles = ['admin', 'finance_head', 'accountant', 'admin_assistant'];

  if (fullAccessRoles.includes(currentUser.role)) {
    // 전체 조회 권한
  } else if (currentUser.role === 'team_leader') {
    // 팀장: 본인 부서 지출결의서만 조회
    where.department = currentUser.department;
  } else {
    // 일반 사용자: 본인 작성 지출결의서만 조회
    where.userId = currentUser.id;
  }

  // 기존 쿼리에 where 조건 추가
  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    // ...
  });
}
```

**역할별 조회 권한:**
| 역할 | 조회 범위 |
|------|----------|
| admin | 전체 |
| finance_head | 전체 |
| accountant | 전체 |
| admin_assistant | 전체 |
| team_leader | 본인 부서 |
| user | 본인 작성만 |

#### 2-2. POST /api/expenses - 작성자 자동 설정

**파일:** `app/api/expenses/route.ts`

**수정 내용:**
```typescript
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const expense = await prisma.expense.create({
    data: {
      // 기존 데이터...
      userId: currentUser.id,  // 작성자 자동 설정
      applicantName: body.applicantName || currentUser.username,
      // ...
    }
  });
}
```

#### 2-3. GET /api/bank-accounts - 사용자별 계좌 목록

**파일:** `app/api/bank-accounts/route.ts`

**수정 내용:**
```typescript
export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 현재 로그인 사용자의 계좌만 조회
  const accounts = await prisma.savedBankAccount.findMany({
    where: { userId: currentUser.id },
    orderBy: [
      { isDefault: 'desc' },  // 기본 계좌 먼저
      { createdAt: 'desc' }
    ]
  });

  return NextResponse.json(accounts);
}
```

#### 2-4. POST /api/bank-accounts - 계좌 추가 (userId 자동 설정)

**파일:** `app/api/bank-accounts/route.ts`

**수정 내용:**
```typescript
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // 첫 번째 계좌면 자동으로 기본 계좌로 설정
  const existingCount = await prisma.savedBankAccount.count({
    where: { userId: currentUser.id }
  });

  const account = await prisma.savedBankAccount.create({
    data: {
      userId: currentUser.id,  // 현재 사용자로 자동 설정
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      accountHolder: body.accountHolder,
      nickname: body.nickname,
      isDefault: existingCount === 0 ? true : body.isDefault ?? false,
    }
  });

  return NextResponse.json(account);
}
```

#### 2-5. GET /api/auth/me - 기본 계좌 정보 포함

**파일:** `app/api/auth/me/route.ts`

**수정 내용:**
```typescript
export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 기본 계좌 조회
  const defaultAccount = await prisma.savedBankAccount.findFirst({
    where: {
      userId: currentUser.id,
      isDefault: true
    }
  });

  return NextResponse.json({
    id: currentUser.id,
    userid: currentUser.userid,
    username: currentUser.username,
    role: currentUser.role,
    department: currentUser.department,
    // 기본 계좌 정보
    defaultBankAccount: defaultAccount ? {
      id: defaultAccount.id,
      bankName: defaultAccount.bankName,
      accountNumber: defaultAccount.accountNumber,
      accountHolder: defaultAccount.accountHolder,
      nickname: defaultAccount.nickname,
    } : null,
  });
}
```

---

### Phase 3: 프론트엔드 수정

#### 3-1. ExpenseForm - 계좌 선택 드롭다운 추가

**파일:** `components/ExpenseForm.tsx`

**수정 내용:**
```typescript
'use client';

import { useEffect, useState } from 'react';

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  nickname: string | null;
  isDefault: boolean;
}

export default function ExpenseForm({ initialData }: Props) {
  const [currentUser, setCurrentUser] = useState(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  useEffect(() => {
    // 현재 사용자 정보 조회
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(user => {
        setCurrentUser(user);

        // 신규 작성 모드면 청구인 자동 설정
        if (!initialData) {
          setValue('applicantName', user.username);
        }
      });

    // 저장된 계좌 목록 조회
    fetch('/api/bank-accounts')
      .then(res => res.json())
      .then(accounts => {
        setBankAccounts(accounts);

        // 신규 작성 모드이고 기본 계좌가 있으면 자동 선택
        if (!initialData) {
          const defaultAccount = accounts.find(a => a.isDefault);
          if (defaultAccount) {
            setSelectedAccountId(defaultAccount.id);
            setValue('bankName', defaultAccount.bankName);
            setValue('accountNumber', defaultAccount.accountNumber);
            setValue('accountHolder', defaultAccount.accountHolder);
          }
        }
      });
  }, []);

  // 계좌 선택 핸들러
  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);

    if (accountId === 'manual') {
      // 직접 입력 선택시 필드 초기화
      setValue('bankName', '');
      setValue('accountNumber', '');
      setValue('accountHolder', '');
      return;
    }

    const account = bankAccounts.find(a => a.id === accountId);
    if (account) {
      setValue('bankName', account.bankName);
      setValue('accountNumber', account.accountNumber);
      setValue('accountHolder', account.accountHolder);
    }
  };

  // 렌더링
  return (
    <form>
      {/* 계좌 선택 드롭다운 */}
      <div>
        <label>저장된 계좌</label>
        <select
          value={selectedAccountId}
          onChange={(e) => handleAccountSelect(e.target.value)}
        >
          <option value="">계좌 선택...</option>
          {bankAccounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.nickname || account.bankName} - {account.accountNumber}
              {account.isDefault && ' (기본)'}
            </option>
          ))}
          <option value="manual">직접 입력</option>
        </select>
      </div>

      {/* 기존 은행 정보 필드 (선택된 계좌 정보 또는 직접 입력) */}
      {/* ... */}
    </form>
  );
}
```

#### 3-2. Expenses 목록 페이지 - 권한별 UI 조정

**파일:** `app/expenses/page.tsx`

**수정 내용:**
- API가 이미 역할 기반으로 필터링하므로, 프론트엔드는 결과를 그대로 표시
- 사용자에게 현재 조회 범위 안내 메시지 표시 (선택사항)

```typescript
// 조회 범위 안내 (선택사항)
{currentUser?.role === 'user' && (
  <p className="text-sm text-gray-500">
    내가 작성한 지출결의서만 표시됩니다.
  </p>
)}
{currentUser?.role === 'team_leader' && (
  <p className="text-sm text-gray-500">
    {currentUser.department} 부서의 지출결의서가 표시됩니다.
  </p>
)}
```

#### 3-3. 계좌 관리 페이지 (선택사항)

**새 파일:** `app/settings/bank-accounts/page.tsx`

사용자가 본인의 은행 계좌를 관리할 수 있는 페이지:
- 계좌 목록 조회 (GET /api/bank-accounts)
- 계좌 추가 (POST /api/bank-accounts)
- 계좌 수정/삭제 (PUT/DELETE /api/bank-accounts/[id])
- 기본 계좌 설정

---

## 구현 순서

### Step 1: 스키마 수정
1. `prisma/schema.prisma` 수정
   - SavedBankAccount 모델에 userId FK 추가
   - User 모델에 bankAccounts, expenses 관계 추가
   - Expense 모델에 userId FK 추가
2. `npx prisma db push` 실행

### Step 2: API 수정
1. `app/api/bank-accounts/route.ts` - 사용자별 계좌 조회/생성
2. `app/api/bank-accounts/[id]/route.ts` - 계좌 수정/삭제 (소유자 확인)
3. `app/api/expenses/route.ts` GET - 역할 기반 필터링
4. `app/api/expenses/route.ts` POST - userId 자동 설정
5. `app/api/auth/me/route.ts` - 기본 계좌 정보 포함

### Step 3: 프론트엔드 수정
1. `components/ExpenseForm.tsx` - 계좌 선택 드롭다운 추가
2. `app/expenses/page.tsx` - 조회 범위 안내 (선택)

### Step 4: 추가 기능 (선택)
1. 계좌 관리 페이지 (`app/settings/bank-accounts/page.tsx`)

---

## 예상 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `prisma/schema.prisma` | SavedBankAccount userId FK, User 관계, Expense userId 추가 |
| `app/api/bank-accounts/route.ts` | 사용자별 필터링 |
| `app/api/bank-accounts/[id]/route.ts` | 소유자 확인 로직 |
| `app/api/expenses/route.ts` | GET 역할 기반 필터링, POST userId 설정 |
| `app/api/auth/me/route.ts` | 기본 계좌 정보 포함 |
| `components/ExpenseForm.tsx` | 계좌 선택 드롭다운 추가 |
| `app/expenses/page.tsx` | 조회 범위 안내 (선택) |

---

## 다음 단계

위 전략 검토 후 승인되면:
1. 스키마 수정부터 순차적으로 구현
2. 각 단계별 테스트 후 다음 단계 진행
3. 전체 통합 테스트 후 배포
