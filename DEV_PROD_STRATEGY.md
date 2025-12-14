# 개발/프로덕션 DB 분리 전략

## 현재 상황

현재는 **Production DB를 직접 사용**하는 구조입니다:
- 로컬 개발 → Production DB 직접 연결
- 코드 변경 → main 브랜치 머지 → 배포 → DB 스키마 자동 적용

**문제점**:
- ❌ 로컬 개발 중 실수로 Production 데이터 손상 가능
- ❌ 스키마 변경 테스트가 Production에서 직접 발생
- ❌ 롤백이 어려움
- ❌ 팀원 간 DB 상태 불일치 가능

---

## 권장 전략: Neon Branching 활용

Neon PostgreSQL은 Git처럼 **브랜치 기능**을 제공합니다. 이를 활용한 안전한 개발 워크플로우:

### 1. Neon DB 브랜치 구조

```
Production Branch (main)
├── Development Branch (dev) ← 팀 공용 개발 DB
├── Feature Branch (feature/approval-system) ← 기능별 개발
└── Testing Branch (testing) ← E2E 테스트용
```

### 2. 브랜치 생성 방법

#### Neon Console에서:
1. https://console.neon.tech 접속
2. 프로젝트 선택 → **Branches** 탭
3. **"Create Branch"** 클릭
4. 옵션 선택:
   - **Source branch**: `main` (Production)
   - **Branch name**: `dev` 또는 `feature/xxx`
   - **Time**: `Latest` (최신 상태로 복사)

#### Neon CLI로:
```bash
# Neon CLI 설치
npm install -g neonctl

# 브랜치 생성
neonctl branches create --name dev --parent main

# 브랜치 목록 확인
neonctl branches list
```

### 3. 환경별 DATABASE_URL 설정

#### 로컬 개발 (.env.local)
```bash
# Development 브랜치 사용
DATABASE_URL="postgresql://user:pass@dev-branch.neon.tech/..."
```

#### Staging/Preview (.env.staging)
```bash
# Testing 브랜치 사용
DATABASE_URL="postgresql://user:pass@testing-branch.neon.tech/..."
```

#### Production (.env or Render 환경변수)
```bash
# Main 브랜치 사용
DATABASE_URL="postgresql://user:pass@main-branch.neon.tech/..."
```

---

## 개발 워크플로우

### 시나리오 1: 새로운 기능 개발 (스키마 변경 포함)

```mermaid
graph LR
    A[1. Neon에서<br/>feature 브랜치 생성] --> B[2. 로컬 .env에<br/>feature DB URL 설정]
    B --> C[3. 스키마 수정<br/>schema.prisma]
    C --> D[4. npx prisma db push]
    D --> E[5. 로컬 테스트]
    E --> F{테스트 통과?}
    F -->|Yes| G[6. 코드 커밋 & PR]
    F -->|No| C
    G --> H[7. main 머지]
    H --> I[8. 배포 시<br/>Production DB 자동 적용]
```

#### 단계별 설명:

**1. Feature 브랜치 생성 (Neon)**
```bash
neonctl branches create --name feature/approval-system --parent main
```

**2. 로컬 환경변수 설정**
```bash
# .env.local 파일 생성
DATABASE_URL="postgresql://...feature-approval-system.neon.tech/..."
```

**3. 스키마 수정**
```typescript
// prisma/schema.prisma
model ApprovalLine {
  id String @id @default(cuid())
  // ...
}
```

**4. DB에 적용 (Feature 브랜치에만 적용됨)**
```bash
npx prisma db push
npx prisma generate
```

**5. 로컬 테스트**
```bash
npm run dev
npm test
```

**6. 테스트 통과 후 커밋**
```bash
git add .
git commit -m "feat: add approval system"
git push
```

**7. PR → main 머지**

**8. 배포 (Render 자동 배포)**
- Render가 `npm run build` 실행
- `postinstall` 스크립트에서 `prisma generate` 실행
- Production DB에 스키마 적용 (`npx prisma db push` 또는 migrate)

---

### 시나리오 2: 프로덕션과 동일한 데이터로 로컬 테스트

#### 옵션 A: Neon Time Travel (과거 시점 브랜치)
```bash
# 특정 시점의 Production 데이터로 브랜치 생성
neonctl branches create --name test-with-prod-data \
  --parent main \
  --timestamp "2024-12-14T10:00:00Z"
```

#### 옵션 B: Production 브랜치 복사
```bash
# Production의 최신 상태를 복사
neonctl branches create --name dev --parent main
```

⚠️ **주의**: Production 브랜치는 직접 사용하지 않기!

---

## 배포 파이프라인 설정

### Render 환경변수 설정

#### Production 환경
```bash
# Render Dashboard > Environment Variables
DATABASE_URL=postgresql://...main-branch.neon.tech/...
```

#### Preview 환경 (PR용)
```bash
# 자동으로 Testing 브랜치 사용
DATABASE_URL=postgresql://...testing-branch.neon.tech/...
```

### package.json 스크립트 추가

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "postinstall": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate:deploy": "prisma migrate deploy",

    // 개발용
    "db:reset:dev": "prisma migrate reset --skip-seed",
    "db:seed:dev": "prisma db seed",

    // 프로덕션용 (자동 실행)
    "postbuild": "prisma db push --accept-data-loss || true"
  }
}
```

⚠️ **주의**: `--accept-data-loss`는 신중하게 사용! 데이터 손실 가능성 있음.

---

## 마이그레이션 vs DB Push

### DB Push (현재 사용 중)
```bash
npx prisma db push
```

**장점**:
- ✅ 빠르고 간단
- ✅ 마이그레이션 파일 불필요
- ✅ 프로토타이핑에 적합

**단점**:
- ❌ 마이그레이션 히스토리 없음
- ❌ 팀원 간 동기화 어려움
- ❌ 롤백 불가

### Migrate (권장 - Production용)
```bash
# 개발 중
npx prisma migrate dev --name add-approval-system

# 배포 시
npx prisma migrate deploy
```

**장점**:
- ✅ 마이그레이션 히스토리 관리
- ✅ Git으로 버전 관리
- ✅ 롤백 가능
- ✅ 팀원 간 동기화 용이

**단점**:
- ❌ 초기 설정 복잡
- ❌ 마이그레이션 파일 관리 필요

---

## 권장 전환 계획

### Phase 1: 현재 상태 유지 + Neon Branching 도입

```bash
# 1. Development 브랜치 생성
neonctl branches create --name dev --parent main

# 2. 로컬 .env.local 설정
DATABASE_URL="postgresql://...dev-branch.neon.tech/..."

# 3. 개발은 dev 브랜치에서, 배포는 main으로
```

**변경 최소화**:
- 기존 `db:push` 방식 유지
- 로컬만 dev 브랜치 사용
- Production은 배포 시 자동 적용

### Phase 2: Prisma Migrate 도입

```bash
# 1. 초기 마이그레이션 생성
npx prisma migrate dev --name init

# 2. .gitignore에서 migrations/ 제외
git add prisma/migrations
git commit -m "chore: add initial migration"

# 3. 배포 스크립트 변경
"postbuild": "prisma migrate deploy"
```

**변경 사항**:
- `db:push` → `migrate dev/deploy`
- 마이그레이션 파일 Git 관리
- 히스토리 추적 가능

### Phase 3: CI/CD 자동화

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # 1. DB 마이그레이션 (Preview 브랜치)
      - name: Run migrations (Preview)
        env:
          DATABASE_URL: ${{ secrets.PREVIEW_DATABASE_URL }}
        run: npx prisma migrate deploy

      # 2. 테스트
      - name: Run tests
        run: npm test

      # 3. Production 배포 (성공 시만)
      - name: Deploy to Render
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

---

## 백업 전략

### Neon 자동 백업
- Neon은 자동으로 Point-in-Time Recovery (PITR) 제공
- 최대 7일간 데이터 복구 가능

### 수동 백업 (중요 변경 전)
```bash
# 1. 백업 브랜치 생성
neonctl branches create --name backup-before-approval-system --parent main

# 2. 또는 pg_dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 롤백 방법
```bash
# 1. 백업 브랜치로 되돌리기
neonctl branches reset main --from backup-before-approval-system

# 2. 또는 마이그레이션 롤백
npx prisma migrate reset
```

---

## 팀 협업 가이드

### 1. 브랜치 명명 규칙
```
dev              # 팀 공용 개발 DB
feature/xxx      # 기능별 개발 DB
testing          # E2E 테스트용 DB
hotfix/xxx       # 긴급 수정용 DB
```

### 2. 환경변수 관리
```bash
# .env.example (템플릿)
DATABASE_URL=postgresql://...

# .env.local (로컬 개발 - Git 무시)
DATABASE_URL=postgresql://...dev-branch.neon.tech/...

# .env.production (Render 환경변수)
DATABASE_URL=postgresql://...main-branch.neon.tech/...
```

### 3. 스키마 변경 프로세스
1. ✅ Neon에서 feature 브랜치 생성
2. ✅ 로컬에서 스키마 수정 & 테스트
3. ✅ PR에 스키마 변경 내용 명시
4. ✅ 리뷰 후 main 머지
5. ✅ 배포 시 자동 적용
6. ✅ 적용 후 feature 브랜치 삭제

---

## 비용 최적화

### Neon 브랜치 제한
- **Free Tier**: 브랜치 1개
- **Pro**: 브랜치 10개 ($19/월)
- **Scale**: 무제한 ($69/월)

### 권장 브랜치 구조 (Pro 플랜)
```
main (Production)
dev (팀 공용)
testing (CI/CD)
feature-1 (개발자1)
feature-2 (개발자2)
```

### 브랜치 정리
```bash
# 사용하지 않는 브랜치 삭제
neonctl branches delete feature/old-feature

# 자동 삭제 (Neon Console 설정)
# Settings > Branches > Auto-delete after 7 days
```

---

## 트러블슈팅

### 문제 1: 로컬 DB가 Production과 다름
**해결**: Neon 브랜치를 최신 상태로 리셋
```bash
neonctl branches reset dev --from main
```

### 문제 2: 마이그레이션 충돌
**해결**:
```bash
# 1. 로컬 마이그레이션 상태 확인
npx prisma migrate status

# 2. 충돌 해결 후 재적용
npx prisma migrate resolve --applied [migration-name]
```

### 문제 3: 배포 시 DB 적용 실패
**해결**:
```bash
# Render 로그 확인
# Build Command에 추가:
npx prisma db push --accept-data-loss || echo "DB push failed but continuing"
```

---

## 체크리스트

### 개발 시작 전
- [ ] Neon에서 feature 브랜치 생성
- [ ] .env.local에 feature DB URL 설정
- [ ] `npx prisma db push` 실행
- [ ] 로컬 테스트 완료

### PR 생성 전
- [ ] 스키마 변경 사항 PR에 명시
- [ ] 테스트 커버리지 90% 이상
- [ ] 마이그레이션 파일 Git에 커밋 (migrate 사용 시)

### 배포 전
- [ ] Neon 백업 브랜치 생성 (중요 변경 시)
- [ ] Staging 환경에서 테스트
- [ ] 배포 시간 공지 (다운타임 예상 시)

### 배포 후
- [ ] Production DB 스키마 확인
- [ ] 애플리케이션 정상 동작 확인
- [ ] 사용하지 않는 feature 브랜치 삭제

---

## 참고 링크

- [Neon Branching 공식 문서](https://neon.tech/docs/guides/branching)
- [Prisma Migrate 가이드](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Render 환경변수 설정](https://render.com/docs/environment-variables)
