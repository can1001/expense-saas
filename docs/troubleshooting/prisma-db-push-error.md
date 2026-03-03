# Prisma DB Push 오류 해결 가이드

## 오류 메시지

```
npx prisma db push

Error: Cannot read properties of undefined (reading 'startsWith')
```

---

## 원인

### 1. 환경 변수 미로드

`prisma.config.ts` 파일에서 `process.env.DATABASE_URL`을 참조하지만, CLI에서 직접 실행 시 `.env` 파일이 자동으로 로드되지 않습니다.

```typescript
// prisma.config.ts
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!, // <- undefined 발생
  },
});
```

### 2. Prisma 7.x + prisma.config.ts 조합

Prisma 7.x 버전에서 `prisma.config.ts`를 사용할 경우, 환경 변수가 설정되지 않으면 `startsWith` 메서드 호출 시 오류가 발생합니다.

---

## 해결 방법

### 방법 1: dotenv CLI 사용 (권장)

```bash
npx dotenv -e .env -- prisma db push
```

`dotenv` 패키지가 `.env` 파일을 먼저 로드한 후 prisma 명령을 실행합니다.

### 방법 2: 환경 변수 직접 설정

```bash
export DATABASE_URL="postgresql://..."
npx prisma db push
```

### 방법 3: .env 파일 source

```bash
source .env
npx prisma db push
```

> **참고**: `source` 명령은 일부 환경에서 작동하지 않을 수 있습니다.

---

## 관련 명령어

| 명령어 | 설명 |
|--------|------|
| `npx dotenv -e .env -- prisma db push` | 스키마를 DB에 적용 |
| `npx dotenv -e .env -- prisma generate` | Prisma Client 재생성 |
| `npx dotenv -e .env -- prisma migrate dev` | 마이그레이션 생성 및 적용 |
| `npx dotenv -e .env -- prisma studio` | Prisma Studio 실행 |

---

## 예방 방법

### package.json에 스크립트 추가

```json
{
  "scripts": {
    "db:push": "dotenv -e .env -- prisma db push",
    "db:generate": "dotenv -e .env -- prisma generate",
    "db:migrate": "dotenv -e .env -- prisma migrate dev",
    "db:studio": "dotenv -e .env -- prisma studio"
  }
}
```

이후 다음과 같이 실행:

```bash
npm run db:push
```

---

## 환경

- Prisma: 7.x
- Node.js: 24.x
- prisma.config.ts 사용

---

*작성일: 2026-03-03*
