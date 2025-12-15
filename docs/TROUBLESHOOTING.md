# 배포 트러블슈팅 가이드

이 문서는 프로덕션 배포 중 발생한 이슈와 해결 방법을 정리한 것입니다.

---

## 목차

1. [Prisma Import 오류](#1-prisma-import-오류)
2. [Prisma 7 설정 변경](#2-prisma-7-설정-변경)
3. [TypeScript 타입 오류](#3-typescript-타입-오류)
4. [누락된 패키지](#4-누락된-패키지)
5. [Prisma 버전 불일치](#5-prisma-버전-불일치)
6. [프로덕션 DB 스키마 동기화](#6-프로덕션-db-스키마-동기화)

---

## 1. Prisma Import 오류

### 증상
```
Export default doesn't exist in target module
import prisma from '@/lib/prisma';
```

### 원인
`lib/prisma.ts`가 **named export**를 사용하는데, API 라우트에서 **default import**를 사용함.

### 해결
```typescript
// ❌ 잘못된 방식
import prisma from '@/lib/prisma';

// ✅ 올바른 방식
import { prisma } from '@/lib/prisma';
```

### 영향 받은 파일
- `app/api/expenses/[id]/approval/route.ts`
- `app/api/expenses/[id]/submit/route.ts`
- `app/api/expenses/[id]/approve/route.ts`
- `app/api/expenses/[id]/withdraw/route.ts`
- `app/api/expenses/[id]/reject/route.ts`

---

## 2. Prisma 7 설정 변경

### 증상
```
Error: The datasource property `url` is no longer supported in schema files.
```

### 원인
Prisma 7에서 `schema.prisma`의 datasource에서 `url` 속성이 제거됨.

### 해결

**1) `prisma/schema.prisma` 수정:**
```prisma
// ❌ Prisma 6 방식
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ✅ Prisma 7 방식
datasource db {
  provider = "postgresql"
}
```

**2) `prisma.config.ts` 파일 생성:**
```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## 3. TypeScript 타입 오류

### 3-1. JSON 필드 null 처리

#### 증상
```
Type 'null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'.
```

#### 해결
```typescript
// ❌ 잘못된 방식
beforeSnapshot,  // null일 수 있음

// ✅ 올바른 방식
beforeSnapshot: beforeSnapshot ?? undefined,
```

### 3-2. ZodError 타입 캐스팅

#### 증상
```
Conversion of type 'object & Record<"name", unknown>' to type '{ errors: ... }' may be a mistake
```

#### 해결
```typescript
// ❌ 잘못된 방식
const zodError = error as { errors: Array<...> };

// ✅ 올바른 방식
const zodError = error as unknown as { errors: Array<...> };
```

---

## 4. 누락된 패키지

### 증상
```
Cannot find module 'lucide-react' or its corresponding type declarations.
```

### 해결
```bash
npm install lucide-react
```

---

## 5. Prisma 버전 불일치

### 증상
```
TypeError: The "paths[1]" argument must be of type string. Received undefined
```

### 원인
`@prisma/adapter-pg`는 v7인데 `@prisma/client`와 `prisma`는 v6으로 버전 불일치.

### 확인 방법
```bash
npm list @prisma/client @prisma/adapter-pg prisma
```

### 해결
```bash
npm install prisma@7 @prisma/client@7
npx prisma generate
```

---

## 6. 프로덕션 DB 스키마 동기화

### 증상
- 특정 API만 500 오류 발생 (예: `/api/expenses`)
- 다른 API는 정상 작동 (예: `/api/bank-accounts`)

### 원인
프로덕션 DB에 새로운 컬럼/테이블이 없음. 코드에는 새 필드가 추가되었지만 DB 스키마가 업데이트되지 않음.

### 해결

**방법 1: Render Build Command 수정**
```bash
npm install && npx prisma generate && npx prisma db push --skip-generate && npm run build
```

**방법 2: 로컬에서 프로덕션 DB에 직접 적용**
```bash
DATABASE_URL="postgresql://...프로덕션URL..." npx prisma db push
```

### Render Build Command 변경 방법
1. Render 대시보드 접속: https://dashboard.render.com
2. 해당 서비스 선택
3. **Settings** 탭 클릭
4. **Build & Deploy** 섹션에서 **Build Command** 수정
5. **Save Changes** 클릭
6. **Manual Deploy** > **Deploy latest commit** 클릭

---

## 빠른 체크리스트

배포 오류 발생 시 순서대로 확인:

- [ ] Prisma import 방식 확인 (`{ prisma }` named export)
- [ ] Prisma 버전 일치 확인 (`npm list prisma @prisma/client @prisma/adapter-pg`)
- [ ] `prisma.config.ts` 파일 존재 및 설정 확인
- [ ] 누락된 패키지 확인 (`npm install`)
- [ ] 프로덕션 DB 스키마 동기화 (`npx prisma db push`)
- [ ] TypeScript 빌드 테스트 (`npm run build`)

---

## 관련 문서

- [Prisma 7 Migration Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma with Neon PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/neon)
- [Render Deployment](https://render.com/docs/deploy-nextjs-app)
