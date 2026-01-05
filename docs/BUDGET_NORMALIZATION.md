# 예산 마스터 정규화 설계

## 1. 핵심 개념

### 1.1 예산 구조
```
위원회 → 사역팀(부) → 예산(항) → 예산(목) → 예산(세목)
                                              ├── 담당자 (1차 결재자)
                                              └── 예산금액
```

### 1.2 결재 흐름 결정 규칙

| 조건 | 결재 흐름 | 단계 |
|------|-----------|------|
| 담당자 ≠ 재정팀장 | 담당자 → 회계 → 재정팀장 | 3단계 |
| 담당자 = 재정팀장 | 재정팀장(전결) → 회계 → 재정팀장 | 3단계 (1차 자동승인) |

> **전결**: 담당자가 재정팀장인 경우, 1차 결재(담당자=재정팀장)는 자동 승인되고 회계 결재로 진행

### 1.3 예시 데이터

| 위원회 | 사역팀(부) | 예산(항) | 예산(목) | 예산(세목) | 담당자 | 결재흐름 |
|--------|-----------|----------|----------|-----------|--------|----------|
| 기획위원회 | 공간사역팀 | 비전사역비 | 공간사역비 | 인건비 | 윤운문(재정팀장) | 전결→회계→재정팀장 (3단계, 1차 자동) |
| 기획위원회 | 재정팀 | 사무행정비 | 회의및접대비 | 아웃팅비 | 홍길동(팀장) | 담당자→회계→재정팀장 (3단계) |
| 선교위원회 | 선교팀 | 선교비 | 국내선교비 | 단기선교 | 김철수(팀장) | 담당자→회계→재정팀장 (3단계) |

---

## 2. 현재 구조 분석

### 2.1 현재 BudgetMaster 테이블

```prisma
model BudgetMaster {
  id           String   @id
  committee    String   // 위원회
  department   String   // 사역팀(부)
  category     String   // 예산(항)
  subcategory  String   // 예산(목)
  detail       String   // 예산(세목)
  manager      String?  // 담당자 (현재 미사용)
  accountCode  String?  // 계정코드
  description  String?  // 항목 내역
  isActive     Boolean
}
```

### 2.2 현재 구조의 문제점

| 문제 | 설명 |
|------|------|
| **데이터 중복** | 위원회/사역팀/항/목 정보가 모든 세목에 반복 저장 |
| **담당자 미연결** | manager가 문자열로만 저장, User 테이블과 미연결 |
| **예산금액 없음** | 세목별 예산금액 필드 누락 |
| **연도 관리 불가** | 연도별 담당자/예산 변경 관리 불가 |

---

## 3. 정규화된 스키마 설계

### 3.1 테이블 구조 개요

```
┌─────────────┐
│  Committee  │ 위원회
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐
│ Department  │ 사역팀(부)
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐     ┌────────────────┐
│BudgetCategory│────>│BudgetSubcategory│ 예산(항) → 예산(목)
└─────────────┘ 1:N └───────┬────────┘
                            │ 1:N
                            ▼
                    ┌───────────────┐
                    │  BudgetDetail │ 예산(세목)
                    └───────┬───────┘
                            │ 1:N
                            ▼
                    ┌───────────────────┐
                    │ BudgetDetailYear  │ 연도별 세목 설정
                    │  - 담당자 (User)   │
                    │  - 예산금액        │
                    └───────────────────┘
```

### 3.2 조직 테이블

#### Committee (위원회)
```prisma
model Committee {
  id          String       @id @default(cuid())
  name        String       @unique  // "기획위원회", "선교위원회"
  sortOrder   Int          @default(0)
  isActive    Boolean      @default(true)

  departments Department[]

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

#### Department (사역팀/부)
```prisma
model Department {
  id           String     @id @default(cuid())
  committeeId  String
  committee    Committee  @relation(fields: [committeeId], references: [id])

  name         String     // "재정팀", "공간사역팀"
  sortOrder    Int        @default(0)
  isActive     Boolean    @default(true)

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([committeeId, name])
  @@index([committeeId])
}
```

### 3.3 예산 계층 테이블

#### BudgetCategory (예산 항)
```prisma
model BudgetCategory {
  id            String              @id @default(cuid())
  name          String              @unique  // "사무행정비", "비전사역비"
  sortOrder     Int                 @default(0)
  isActive      Boolean             @default(true)

  subcategories BudgetSubcategory[]

  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}
```

#### BudgetSubcategory (예산 목)
```prisma
model BudgetSubcategory {
  id          String          @id @default(cuid())
  categoryId  String
  category    BudgetCategory  @relation(fields: [categoryId], references: [id])

  name        String          // "회의및접대비", "공간사역비"
  sortOrder   Int             @default(0)
  isActive    Boolean         @default(true)

  details     BudgetDetail[]

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@unique([categoryId, name])
  @@index([categoryId])
}
```

#### BudgetDetail (예산 세목)
```prisma
model BudgetDetail {
  id             String            @id @default(cuid())
  subcategoryId  String
  subcategory    BudgetSubcategory @relation(fields: [subcategoryId], references: [id])

  name           String            // "아웃팅비_재정팀", "인건비"
  accountCode    String?           // 계정코드
  description    String?           // 항목 내역
  sortOrder      Int               @default(0)
  isActive       Boolean           @default(true)

  // 연도별 설정
  yearSettings   BudgetDetailYear[]

  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@unique([subcategoryId, name])
  @@index([subcategoryId])
}
```

### 3.4 연도별 세목 설정 (핵심 테이블)

#### BudgetDetailYear (연도별 담당자 + 예산금액)
```prisma
model BudgetDetailYear {
  id              String       @id @default(cuid())

  budgetDetailId  String
  budgetDetail    BudgetDetail @relation(fields: [budgetDetailId], references: [id])

  year            Int          // 2024, 2025, 2026...

  // 담당자 (1차 결재자) - User 테이블 참조
  managerId       String
  manager         User         @relation(fields: [managerId], references: [id])

  // 예산금액
  budgetAmount    Int          @default(0)   // 배정 예산
  usedAmount      Int          @default(0)   // 사용 금액 (집계)

  isActive        Boolean      @default(true)

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([budgetDetailId, year])
  @@index([year])
  @@index([managerId])
}
```

### 3.5 조직-예산 연결 테이블

#### DepartmentBudgetDetail (사역팀별 사용 가능 세목)
```prisma
model DepartmentBudgetDetail {
  id              String       @id @default(cuid())

  departmentId    String
  department      Department   @relation(fields: [departmentId], references: [id])

  budgetDetailId  String
  budgetDetail    BudgetDetail @relation(fields: [budgetDetailId], references: [id])

  isActive        Boolean      @default(true)

  createdAt       DateTime     @default(now())

  @@unique([departmentId, budgetDetailId])
  @@index([departmentId])
  @@index([budgetDetailId])
}
```

---

## 4. 전체 ERD

```
┌─────────────┐          ┌──────────────┐
│  Committee  │─────────<│  Department  │
│  (위원회)    │    1:N   │  (사역팀/부)  │
└─────────────┘          └──────┬───────┘
                                │
                                │ N:M (via DepartmentBudgetDetail)
                                │
┌────────────────┐       ┌──────▼───────┐       ┌──────────────────┐
│ BudgetCategory │──────<│BudgetSubcat. │──────<│   BudgetDetail   │
│   (예산 항)     │  1:N  │  (예산 목)    │  1:N  │   (예산 세목)     │
└────────────────┘       └──────────────┘       └────────┬─────────┘
                                                         │
                                                         │ 1:N
                                                         ▼
                                                ┌──────────────────┐
                                                │ BudgetDetailYear │
                                                │  (연도별 설정)    │
                                                │  - managerId     │◀──┐
                                                │  - budgetAmount  │   │
                                                └──────────────────┘   │
                                                                       │ N:1
                                                              ┌────────┴───────┐
                                                              │      User      │
                                                              │   (담당자)      │
                                                              └────────────────┘
```

---

## 5. 결재 흐름 결정 로직

### 5.1 결재선 자동 산출

```typescript
interface ApprovalStep {
  stepNumber: number;
  role: string;
  userId: string;
  userName: string;
}

async function getApprovalLine(
  budgetDetailId: string,
  year: number
): Promise<ApprovalStep[]> {

  // 1. 세목의 연도별 담당자 조회
  const budgetDetailYear = await prisma.budgetDetailYear.findUnique({
    where: { budgetDetailId_year: { budgetDetailId, year } },
    include: {
      manager: true,
      budgetDetail: true
    }
  });

  const manager = budgetDetailYear.manager;

  // 2. 재정팀장 조회
  const financeHead = await prisma.userYearRole.findFirst({
    where: { year, role: 'finance_head' },
    include: { user: true }
  });

  // 3. 회계 조회
  const accountant = await prisma.userYearRole.findFirst({
    where: { year, role: 'accountant' },
    include: { user: true }
  });

  // 4. 결재선 결정
  if (manager.id === financeHead.userId) {
    // 담당자가 재정팀장인 경우 → 3단계 (1차 자동승인)
    return [
      {
        stepNumber: 1,
        role: '재정팀장(전결)',
        userId: financeHead.userId,
        userName: financeHead.user.username,
        isAutoApproved: true  // 제출 시 자동 승인
      },
      {
        stepNumber: 2,
        role: '회계',
        userId: accountant.userId,
        userName: accountant.user.username
      },
      {
        stepNumber: 3,
        role: '재정팀장',
        userId: financeHead.userId,
        userName: financeHead.user.username
      }
    ];
  } else {
    // 일반 결재 → 3단계
    return [
      {
        stepNumber: 1,
        role: '담당자',
        userId: manager.id,
        userName: manager.username
      },
      {
        stepNumber: 2,
        role: '회계',
        userId: accountant.userId,
        userName: accountant.user.username
      },
      {
        stepNumber: 3,
        role: '재정팀장',
        userId: financeHead.userId,
        userName: financeHead.user.username
      }
    ];
  }
}
```

### 5.2 결재 흐름 요약

```
┌─────────────────────────────────────────────────────────┐
│                    지출결의서 제출                        │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 세목 담당자 == 재정팀장? │
              └───────────┬───────────┘
                    │           │
                   YES          NO
                    │           │
                    ▼           ▼
         ┌──────────────┐  ┌──────────────┐
         │ 재정팀장(전결) │  │    담당자    │
         │ (자동 승인)   │  └──────┬───────┘
         └──────┬───────┘         │
                │                 │
                ▼                 ▼
         ┌──────────────┐  ┌──────────────┐
         │    회계      │  │    회계      │
         └──────┬───────┘  └──────┬───────┘
                │                 │
                ▼                 ▼
         ┌──────────────┐  ┌──────────────┐
         │  재정팀장    │  │  재정팀장    │
         └──────┬───────┘  └──────┬───────┘
                │                 │
                ▼                 ▼
         ┌────────────────────────────────┐
         │          최종 승인 완료          │
         └────────────────────────────────┘

[전결 케이스: 3단계]              [일반 케이스: 3단계]
재정팀장(전결,자동) → 회계 → 재정팀장    담당자 → 회계 → 재정팀장
```

---

## 6. 데이터 예시

### 6.1 BudgetDetailYear 테이블 데이터

| id | budgetDetailId | year | managerId | managerName | budgetAmount |
|----|----------------|------|-----------|-------------|--------------|
| 1  | detail_001     | 2026 | user_윤운문 | 윤운문 (재정팀장) | 50,000,000 |
| 2  | detail_002     | 2026 | user_홍길동 | 홍길동 (팀장)    | 10,000,000 |
| 3  | detail_003     | 2026 | user_김철수 | 김철수 (팀장)    | 5,000,000  |

### 6.2 결재선 생성 예시

**예시 1: 공간사역팀 인건비 (담당자: 윤운문 = 재정팀장) → 3단계 (1차 자동승인)**
```json
{
  "budgetDetail": "인건비",
  "manager": "윤운문",
  "isFinanceHead": true,
  "approvalLine": [
    { "step": 1, "role": "재정팀장(전결)", "approver": "윤운문", "isAutoApproved": true },
    { "step": 2, "role": "회계", "approver": "박회계" },
    { "step": 3, "role": "재정팀장", "approver": "윤운문" }
  ]
}
```

**예시 2: 재정팀 아웃팅비 (담당자: 홍길동 = 일반 팀장) → 3단계**
```json
{
  "budgetDetail": "아웃팅비_재정팀",
  "manager": "홍길동",
  "isFinanceHead": false,
  "approvalLine": [
    { "step": 1, "role": "담당자", "approver": "홍길동" },
    { "step": 2, "role": "회계", "approver": "박회계" },
    { "step": 3, "role": "재정팀장", "approver": "윤운문" }
  ]
}
```

---

## 7. 마이그레이션 전략

### 7.1 마이그레이션 단계

| 단계 | 작업 | SQL/코드 |
|------|------|----------|
| 1 | Committee 테이블 생성 | BudgetMaster에서 DISTINCT committee 추출 |
| 2 | Department 테이블 생성 | DISTINCT (committee, department) 추출 |
| 3 | BudgetCategory 테이블 생성 | DISTINCT category 추출 |
| 4 | BudgetSubcategory 테이블 생성 | DISTINCT (category, subcategory) 추출 |
| 5 | BudgetDetail 테이블 생성 | DISTINCT (subcategory, detail) + accountCode |
| 6 | DepartmentBudgetDetail 연결 | 기존 매핑 관계 생성 |
| 7 | BudgetDetailYear 생성 | manager → User 매핑 + 예산금액 |

### 7.2 마이그레이션 SQL (예시)

```sql
-- 1. Committee 추출
INSERT INTO "Committee" (id, name, "sortOrder", "isActive")
SELECT
  gen_random_uuid(),
  committee,
  ROW_NUMBER() OVER (ORDER BY committee),
  true
FROM "BudgetMaster"
GROUP BY committee;

-- 2. Department 추출
INSERT INTO "Department" (id, "committeeId", name, "sortOrder", "isActive")
SELECT
  gen_random_uuid(),
  c.id,
  bm.department,
  ROW_NUMBER() OVER (PARTITION BY bm.committee ORDER BY bm.department),
  true
FROM (SELECT DISTINCT committee, department FROM "BudgetMaster") bm
JOIN "Committee" c ON c.name = bm.committee;

-- (이하 생략...)
```

---

## 8. API 설계

### 8.1 예산 마스터 조회 API

**GET /api/budget/v2**
```typescript
// Response
{
  committees: [
    {
      id: "...",
      name: "기획위원회",
      departments: [
        { id: "...", name: "재정팀" },
        { id: "...", name: "공간사역팀" }
      ]
    }
  ],
  categories: [
    {
      id: "...",
      name: "비전사역비",
      subcategories: [
        {
          id: "...",
          name: "공간사역비",
          details: [
            {
              id: "...",
              name: "인건비",
              accountCode: "301-001"
            }
          ]
        }
      ]
    }
  ]
}
```

### 8.2 연도별 세목 설정 조회 API

**GET /api/budget/details/year?year=2026**
```typescript
// Response
{
  year: 2026,
  details: [
    {
      id: "detail_001",
      category: "비전사역비",
      subcategory: "공간사역비",
      detail: "인건비",
      manager: {
        id: "user_윤운문",
        name: "윤운문",
        isFinanceHead: true
      },
      budgetAmount: 50000000,
      usedAmount: 12000000,
      remainingAmount: 38000000
    }
  ]
}
```

### 8.3 결재선 조회 API

**GET /api/approval-line?budgetDetailId=xxx&year=2026**
```typescript
// Response (전결 케이스 - 3단계, 1차 자동승인)
{
  budgetDetail: "인건비",
  manager: {
    id: "user_윤운문",
    name: "윤운문"
  },
  isDirectApproval: true,  // 전결 여부 (1차 자동승인)
  totalSteps: 3,
  approvalLine: [
    {
      stepNumber: 1,
      role: "재정팀장(전결)",
      userId: "user_윤운문",
      userName: "윤운문",
      isAutoApproved: true
    },
    {
      stepNumber: 2,
      role: "회계",
      userId: "user_박회계",
      userName: "박회계"
    },
    {
      stepNumber: 3,
      role: "재정팀장",
      userId: "user_윤운문",
      userName: "윤운문"
    }
  ]
}
```

---

## 9. 구현 우선순위

### Phase 1: 스키마 정규화 (필수)
- [ ] Committee, Department 테이블 생성
- [ ] BudgetCategory, BudgetSubcategory, BudgetDetail 테이블 생성
- [ ] BudgetDetailYear 테이블 생성 (담당자 + 예산금액)
- [ ] 기존 BudgetMaster 데이터 마이그레이션
- [ ] 기존 API 호환성 유지

### Phase 2: 담당자 관리 UI
- [ ] 연도별 세목 담당자 설정 페이지
- [ ] 연도별 예산금액 입력 페이지
- [ ] 이전 연도 복사 기능

### Phase 3: 결재선 자동화
- [ ] 결재선 자동 산출 로직 구현
- [ ] 담당자 = 재정팀장 판별 로직
- [ ] 지출결의서 제출 시 결재선 자동 생성

---

## 10. 정책 결정 사항

### 10.1 담당자 변경 이력
- **질문**: 연도 중간에 담당자가 변경되면 어떻게 처리하나요?
- **결론(정책)**:
  - 이미 제출/기안된 결의서는 **당시 담당자/승인자 스냅샷을 유지**
  - **신규 제출분부터 새 담당자 적용**
- **구현 가이드**:
  - 결의서에 `approver_snapshot` 컬럼을 두어 제출 시점 결재선 저장
  - 또는 결재선을 별도 테이블(`ApprovalLine`)에 스냅샷으로 기록 (현재 구조)
  - 담당자 마스터 변경은 이력 관리 가능 (`effective_from`, `effective_to`)

---

### 10.2 예산 초과 처리
- **질문**: 세목별 예산을 초과하면 결의서 제출을 막나요?
- **결론(정책)**: **경고 표시 후 제출 허용**
- **구현 가이드**:
  - UI/서버 검증 단계에서 초과 여부 계산 → `warning` 메시지 노출
  - 정책 변경 가능성 고려하여 `BLOCK / WARN / ALLOW` 옵션을 환경설정화 가능

---

### 10.3 다중 담당자
- **질문**: 하나의 세목에 여러 담당자가 필요한 경우가 있나요?
- **결론(정책)**: **세목당 담당자 1명**
- **확장 여지**:
  - 향후 다중 담당자 필요 시 `BudgetDetailYear`를
    - `(budgetDetailId, year, managerId)` 복수 row 허용 구조로 확장
    - 또는 별도 매핑 테이블로 다대다 지원 가능

---

### 10.4 위원회-사역팀 관계
- **질문**: 각 사역팀은 하나의 위원회에만 속하나요?
- **결론(정책)**: **Yes (1:N 관계)**
- **관계 정의**:
  ```
  Committee (1) : Department (N)
  Department.committeeId → Committee.id (FK)
  ```

---

## 11. 최종 테이블 요약

| 테이블 | 역할 | 주요 필드 |
|--------|------|-----------|
| **Committee** | 위원회 마스터 | name |
| **Department** | 사역팀 마스터 | committeeId, name |
| **BudgetCategory** | 예산(항) | name |
| **BudgetSubcategory** | 예산(목) | categoryId, name |
| **BudgetDetail** | 예산(세목) | subcategoryId, name, accountCode |
| **BudgetDetailYear** | 연도별 세목 설정 | budgetDetailId, year, **managerId**, **budgetAmount** |
| **DepartmentBudgetDetail** | 사역팀-세목 연결 | departmentId, budgetDetailId |

**핵심**: `BudgetDetailYear.managerId`가 1차 결재자이며, 이 값이 재정팀장과 같으면 전결 처리됨.
