# 예산 계층 관리 시스템 개선

## 개요

예산 계층 구조(위원회 → 사역팀 → 예산)를 효율적으로 관리하기 위한 시스템 개선 작업입니다.

### 주요 개선 사항
1. 위원회/사역팀에 리더(위원장/팀장) 지정 기능 추가
2. 기존 Admin UI에 리더 선택 드롭다운 추가
3. 6단계 예산 등록 마법사 신규 개발
4. 세목 담당자 자동 배정 (사역팀 팀장 기본값)

---

## 구현 내용

### Phase 1: 스키마 개선

**파일: `prisma/schema.prisma`**

```prisma
model Committee {
  // 기존 필드...
  leaderId    String?
  leader      User?        @relation("CommitteeLeader", fields: [leaderId], references: [id])
  @@index([leaderId])
}

model Department {
  // 기존 필드...
  leaderId     String?
  leader       User?      @relation("DepartmentLeader", fields: [leaderId], references: [id])
  @@index([leaderId])
}

model User {
  // 기존 관계에 추가...
  ledCommittees      Committee[]   @relation("CommitteeLeader")
  ledDepartments     Department[]  @relation("DepartmentLeader")
}
```

**적용 명령:**
```bash
npx dotenv -e .env -- npx prisma db push
npx prisma generate
```

---

### Phase 2: API 업데이트

#### 위원회 API

**파일: `app/api/committees/route.ts`**
- GET: 위원장 정보 포함 조회
- POST: leaderId 파라미터로 위원장 지정

**파일: `app/api/committees/[id]/route.ts`**
- PATCH: leaderId 수정 지원

#### 사역팀 API

**파일: `app/api/departments/route.ts`**
- GET: 팀장 정보 포함 조회 (leaderId, leaderName)
- POST: leaderId 파라미터로 팀장 지정

**파일: `app/api/departments/[id]/route.ts`**
- PATCH: leaderId 수정 지원

---

### Phase 3: 기존 Admin UI 개선

#### 위원회 관리 페이지
**파일: `app/admin/committees/page.tsx`**

변경 사항:
- User 인터페이스 및 users 상태 추가
- 위원장 선택 드롭다운 (추가/수정 시)
- 위원장 이름 테이블에 표시

#### 사역팀 관리 페이지
**파일: `app/admin/departments/page.tsx`**

변경 사항:
- User 인터페이스 및 users 상태 추가
- 팀장 선택 드롭다운 (추가/수정 시)
- 팀장 이름 인라인 표시 (예: "재정팀 (홍길동)" 또는 "재정팀 (팀장 미지정)")

---

### Phase 4: 예산 등록 마법사

**파일: `app/admin/budget-wizard/page.tsx`** (신규, 700+ 라인)

#### 6단계 워크플로우

| 단계 | 제목 | 기능 |
|------|------|------|
| 1 | 위원회 선택 | 기존 선택 또는 신규 등록 (위원장 지정 가능) |
| 2 | 사역팀 선택 | 선택된 위원회 하위 사역팀 선택/등록 (팀장 지정 가능) |
| 3 | 예산(항) 선택 | BudgetCategory 선택 또는 신규 등록 |
| 4 | 예산(목) 선택 | 선택된 항 하위 BudgetSubcategory 선택/등록 |
| 5 | 예산(세목) 등록 | 세목 정보 입력 (담당자 기본값: 사역팀 팀장) |
| 6 | 완료 | 등록 결과 요약 및 다음 작업 안내 |

#### 주요 기능
- 각 단계에서 기존 항목 선택 + 신규 등록 모두 지원
- 이전/다음 단계 네비게이션
- 진행률 표시 스테퍼
- 세목 복수 등록 지원
- 담당자 자동 배정 (수정 가능)

#### 관련 신규 API

**파일: `app/api/budget-categories/route.ts`**
```typescript
// GET: 예산(항) 목록 조회
// POST: 예산(항) 신규 등록
```

**파일: `app/api/budget-subcategories/route.ts`**
```typescript
// GET: 예산(목) 목록 조회 (categoryId 필터)
// POST: 예산(목) 신규 등록
```

**파일: `app/api/budget-details/route.ts`**
```typescript
// POST: 예산 세목 일괄 등록
// - DepartmentBudgetDetail 연결 자동 생성
// - BudgetDetailYear 생성 (담당자 자동 배정)
```

#### 대시보드 링크 추가
**파일: `app/admin/page.tsx`**
- "예산 등록 마법사" 링크 추가 (Wand2 아이콘, 보라색)

---

### Phase 5: 자동 담당자 배정 로직

**파일: `app/api/budget-details/route.ts`**

```typescript
// 세목 생성 시 담당자 자동 배정 로직
const department = await prisma.department.findUnique({
  where: { id: departmentId },
  select: { id: true, leaderId: true },
});

// 담당자 우선순위: 입력값 > 사역팀 팀장 > null
const managerId = detail.managerId || department.leaderId || null;

await tx.budgetDetailYear.create({
  data: {
    budgetDetailId: budgetDetail.id,
    year: currentYear,
    managerId,  // 사역팀 팀장이 기본값
    budgetAmount: detail.budgetAmount || 0,
    usedAmount: 0,
  },
});
```

---

## 수정된 파일 목록

### 스키마
| 파일 | 변경 내용 |
|------|-----------|
| `prisma/schema.prisma` | Committee, Department에 leaderId 추가 |

### API (수정)
| 파일 | 변경 내용 |
|------|-----------|
| `app/api/committees/route.ts` | leader 포함 조회/생성 |
| `app/api/committees/[id]/route.ts` | leader 업데이트 |
| `app/api/departments/route.ts` | leader 포함 조회/생성 |
| `app/api/departments/[id]/route.ts` | leader 업데이트 |

### API (신규)
| 파일 | 변경 내용 |
|------|-----------|
| `app/api/budget-categories/route.ts` | 예산(항) CRUD |
| `app/api/budget-subcategories/route.ts` | 예산(목) CRUD |
| `app/api/budget-details/route.ts` | 세목 일괄 생성 + 자동 담당자 배정 |

### Admin 페이지
| 파일 | 변경 내용 |
|------|-----------|
| `app/admin/committees/page.tsx` | 위원장 선택 UI 추가 |
| `app/admin/departments/page.tsx` | 팀장 선택 UI 추가 |
| `app/admin/budget-wizard/page.tsx` | **신규** - 6단계 마법사 |
| `app/admin/page.tsx` | 마법사 링크 추가 |

---

## 사용 방법

### 1. 기존 위원회/사역팀에 리더 지정
1. `/admin/committees` 접속
2. 위원회 행의 연필 아이콘 클릭
3. 위원장 드롭다운에서 사용자 선택
4. 체크 아이콘으로 저장

### 2. 예산 등록 마법사 사용
1. `/admin` (관리자 대시보드) 접속
2. "예산 등록 마법사" 클릭
3. 6단계 워크플로우 진행:
   - 위원회 선택 (또는 신규 등록)
   - 사역팀 선택 (또는 신규 등록)
   - 예산(항) 선택 (또는 신규 등록)
   - 예산(목) 선택 (또는 신규 등록)
   - 세목 정보 입력 (담당자는 팀장이 기본값)
   - 완료 확인

### 3. 자동 담당자 배정 확인
- 마법사에서 세목 등록 후 `/admin/budget-managers` 접속
- 등록된 세목의 담당자가 사역팀 팀장으로 설정되어 있는지 확인

---

## 프로덕션 배포

### 스키마 적용
```bash
# 프로덕션 환경에서 실행
npx dotenv -e .env.production -- npx prisma db push
```

### 기존 데이터 마이그레이션 (선택)
기존 위원회/사역팀에 리더를 배정하려면 Admin UI 또는 직접 DB 업데이트 필요

---

## 기술 스택
- Next.js 16 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Tailwind CSS
- Lucide React Icons

---

## 작성일
2026-01-09
