# 사용자 정보 데이터베이스 관리 전략

## 1. 현재 상태 분석

### 현재 구조 (`lib/users.ts`)
```typescript
// 하드코딩된 사용자 배열 (25명)
export const USERS: readonly UserInfo[] = [
  { id: '1', userid: '청연정혜종', username: '정혜종', role: 'admin' },
  { id: '2', userid: '청연김흥래', username: '김흥래', role: 'team_leader', department: '교육훈련위원회' },
  // ...
];
```

### 현재 데이터 구조
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| userid | string | 로그인 아이디 (예: 청연정혜종) |
| username | string | 표시 이름 (예: 정혜종) |
| role | UserRole | 역할 (admin, finance_head, accountant, team_leader, user) |
| department | string? | 소속 부서 (팀장인 경우) |

### 현재 문제점
1. **확장성 부재**: 사용자 추가/수정 시 코드 배포 필요
2. **관리 어려움**: 비개발자가 사용자 관리 불가
3. **감사 추적 불가**: 사용자 변경 이력 관리 불가
4. **인증 정보 부재**: 비밀번호 등 인증 정보 저장 불가

---

## 2. 데이터베이스 스키마 설계

### 2.1 User 테이블

```prisma
model User {
  id          String   @id @default(cuid())
  userid      String   @unique          // 로그인 아이디
  username    String                     // 표시 이름
  password    String?                    // 해시된 비밀번호 (향후 인증용)
  role        UserRole @default(user)
  department  String?                    // 소속 부서
  isActive    Boolean  @default(true)    // 활성 상태
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  expenses    Expense[]                  // 작성한 지출결의서
  approvals   ApprovalLine[]             // 결재 이력

  @@index([role])
  @@index([department])
  @@index([isActive])
}

enum UserRole {
  admin
  finance_head
  accountant
  team_leader
  user
}
```

### 2.2 역할 메타데이터 (선택적)

역할별 결재 단계와 한글명은 코드에서 유지하거나 별도 테이블로 관리 가능:

```prisma
model RoleMeta {
  id          String   @id @default(cuid())
  role        UserRole @unique
  displayName String                     // 한글명 (관리자, 재정팀장 등)
  stepNumber  Int?                       // 결재 단계 (1, 2, 3 또는 null)
  description String?                    // 역할 설명
}
```

---

## 3. API 설계

### 3.1 엔드포인트 구조

```
/api/users
  ├── GET     - 사용자 목록 조회 (필터/페이지네이션)
  ├── POST    - 사용자 생성 (관리자 전용)
  └── /[id]
      ├── GET    - 사용자 상세 조회
      ├── PUT    - 사용자 정보 수정
      └── DELETE - 사용자 비활성화 (soft delete)

/api/users/me
  └── GET     - 현재 로그인 사용자 정보

/api/users/by-role/[role]
  └── GET     - 역할별 사용자 목록
```

### 3.2 API 응답 예시

```typescript
// GET /api/users
{
  "users": [
    {
      "id": "clxxxxx",
      "userid": "청연정혜종",
      "username": "정혜종",
      "role": "admin",
      "department": null,
      "isActive": true
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 4. 마이그레이션 계획

### Phase 1: 스키마 준비
1. `prisma/schema.prisma`에 User 모델 추가
2. `npx prisma db push`로 테이블 생성
3. 기존 USERS 데이터를 시드 스크립트로 이관

### Phase 2: 시드 스크립트 작성
```typescript
// prisma/seed-users.ts
import { USERS } from '../lib/users';

async function seedUsers() {
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { userid: user.userid },
      update: {},
      create: {
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
      },
    });
  }
}
```

### Phase 3: 서비스 레이어 구현
```typescript
// lib/services/user-service.ts
export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function findUserByUserid(userid: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { userid } });
}

export async function findUsersByRole(role: UserRole): Promise<User[]> {
  return prisma.user.findMany({
    where: { role, isActive: true }
  });
}
```

### Phase 4: 기존 코드 수정
1. `lib/users.ts`의 하드코딩 함수들을 DB 조회로 교체
2. 하위 호환성을 위해 동일한 함수 시그니처 유지
3. 캐싱 레이어 추가 (선택적)

---

## 5. 기존 코드 수정 범위

### 5.1 직접 수정 필요 파일

| 파일 | 수정 내용 |
|------|----------|
| `lib/users.ts` | 하드코딩 → DB 조회 함수로 변환 |
| `prisma/schema.prisma` | User 모델 추가 |
| `prisma/seed.ts` | 사용자 시드 데이터 추가 |

### 5.2 의존성 확인 필요 파일

```bash
# lib/users.ts를 import하는 파일 검색
grep -r "from.*lib/users" --include="*.ts" --include="*.tsx"
```

예상 파일:
- 결재 라인 관련 컴포넌트
- 사용자 선택 드롭다운
- API 라우트 (결재자 조회 등)

### 5.3 하위 호환성 전략

```typescript
// lib/users.ts - 점진적 마이그레이션
import { prisma } from './prisma';

// 기존 동기 함수를 비동기로 변경
// 호출부에서 await 추가 필요
export async function findUserById(id: string): Promise<UserInfo | undefined> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? mapToUserInfo(user) : undefined;
}

// 또는 캐싱으로 동기 API 유지 (앱 시작 시 로드)
let cachedUsers: UserInfo[] = [];

export function initializeUsers() {
  // 앱 시작 시 호출
}

export function findUserById(id: string): UserInfo | undefined {
  return cachedUsers.find(u => u.id === id);
}
```

---

## 6. 고려사항

### 6.1 인증/인가 (향후)
- 현재: 인증 없음
- 향후: 비밀번호 필드 추가, NextAuth.js 또는 커스텀 인증 구현
- 비밀번호 해싱: bcrypt 사용 권장

### 6.2 캐싱 전략
사용자 데이터는 자주 변경되지 않으므로 캐싱 고려:
- 메모리 캐시 (node-cache)
- Redis (분산 환경)
- SWR/React Query (클라이언트)

### 6.3 감사 로그
사용자 변경 이력 추적이 필요하면:
```prisma
model UserAuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // CREATE, UPDATE, DELETE
  changes   Json     // 변경 전후 데이터
  changedBy String   // 변경한 관리자
  createdAt DateTime @default(now())
}
```

### 6.4 Soft Delete
- `isActive` 필드로 soft delete 구현
- 삭제된 사용자도 과거 결재 이력에서 조회 가능

---

## 7. 구현 순서 권장

```
1. [스키마] User 모델 추가 및 DB 반영
2. [시드] 기존 25명 사용자 데이터 이관
3. [서비스] user-service.ts 작성
4. [API] /api/users 엔드포인트 구현
5. [리팩토링] lib/users.ts 함수들 DB 조회로 변경
6. [테스트] 기존 기능 정상 동작 확인
7. [UI] 사용자 관리 화면 추가 (선택)
```

---

## 8. 예상 작업량

| 항목 | 파일 수 | 난이도 |
|------|---------|--------|
| 스키마 & 시드 | 2 | 낮음 |
| API 엔드포인트 | 3-4 | 중간 |
| 서비스 레이어 | 1-2 | 낮음 |
| 기존 코드 수정 | 5-10 | 중간 |
| 관리 UI (선택) | 3-5 | 중간 |

---

## 9. 결론

하드코딩된 사용자 정보를 DB로 이관하면:
- 코드 배포 없이 사용자 관리 가능
- 향후 인증/인가 시스템 확장 용이
- 감사 추적 및 이력 관리 가능
- 결재 시스템과 자연스러운 연동

**권장**: Phase별 점진적 마이그레이션으로 기존 시스템 안정성 유지
