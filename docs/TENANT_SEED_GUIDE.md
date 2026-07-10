# 테넌트 시드 스크립트 사용 가이드

테넌트 시드 스크립트를 사용하여 새로운 테넌트와 기본 데이터를 생성하는 방법을 설명합니다.

## 목차

- [사전 요구사항](#사전-요구사항)
- [환경변수 설정](#환경변수-설정)
- [시드 스크립트 실행](#시드-스크립트-실행)
- [사용 가능한 시드 스크립트](#사용-가능한-시드-스크립트)
- [생성되는 데이터](#생성되는-데이터)
- [문제 해결](#문제-해결)

---

## 사전 요구사항

1. **Node.js 18+** 설치
2. **PostgreSQL** 데이터베이스 (Neon 권장)
3. **필수 환경변수** 설정

## 환경변수 설정

시드 스크립트 실행 전 반드시 다음 환경변수를 설정해야 합니다.

### 필수 환경변수

| 환경변수 | 설명 | 요구사항 |
|----------|------|----------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | 필수 |
| `TENANT_ADMIN_PASSWORD` | 테넌트 관리자 비밀번호 | 필수, 최소 12자 |

### 설정 방법

#### 방법 1: .env 파일 사용 (권장)

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가합니다:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
TENANT_ADMIN_PASSWORD="YourSecurePassword123!"
```

#### 방법 2: 명령줄에서 직접 설정

```bash
TENANT_ADMIN_PASSWORD="YourSecurePassword123!" npx ts-node prisma/seeds/tenant-seed.ts
```

#### 방법 3: export 사용

```bash
export DATABASE_URL="postgresql://..."
export TENANT_ADMIN_PASSWORD="YourSecurePassword123!"
npx ts-node prisma/seeds/tenant-seed.ts
```

### 비밀번호 요구사항

- **최소 12자 이상**
- 대문자, 소문자, 숫자, 특수문자 조합 권장
- 예시: `MySecure@Pass2026!`

---

## 시드 스크립트 실행

### 기본 실행 명령

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/[스크립트명].ts
```

### 예시

```bash
# 기본 샘플 테넌트 생성
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/tenant-seed.ts

# (주)청연컨설팅 테넌트 생성
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/chungyeon-consulting-seed.ts

# 유앤아이환경기술(주) 테넌트 생성
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/uni-environment-seed.ts
```

---

## 사용 가능한 시드 스크립트

### 1. tenant-seed.ts (기본 샘플 테넌트)

**생성되는 테넌트:**

| 테넌트명 | Subdomain | 조직 유형 | 요금제 |
|----------|-----------|-----------|--------|
| 청연교회 | `chungyeon` | CHURCH | PRO |
| 소망교회 | `somang` | CHURCH | BASIC |
| 테스트 단체 | `test` | OTHER | FREE |

**실행:**
```bash
TENANT_ADMIN_PASSWORD="YourPassword123!" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/tenant-seed.ts
```

### 2. chungyeon-consulting-seed.ts

**(주)청연컨설팅** 전용 시드 스크립트

- **Subdomain:** `chungyeon-consulting`
- **조직 유형:** COMPANY
- **요금제:** PRO
- **계정과목:** 제13기(2026년) 회계 기준

**실행:**
```bash
TENANT_ADMIN_PASSWORD="YourPassword123!" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/chungyeon-consulting-seed.ts
```

### 3. uni-environment-seed.ts

**유앤아이환경기술(주)** 전용 시드 스크립트

- **Subdomain:** `uni-environment`
- **조직 유형:** COMPANY
- **요금제:** PRO
- **계정과목:** 제13기(2026년) 회계 기준

**실행:**
```bash
TENANT_ADMIN_PASSWORD="YourPassword123!" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/uni-environment-seed.ts
```

---

## 생성되는 데이터

각 시드 스크립트는 다음 데이터를 생성합니다:

### 1. 테넌트 정보
- 테넌트 기본 정보 (이름, subdomain, 요금제 등)

### 2. 역할 (Roles)
| 역할 코드 | 역할명 | 결재 단계 | 권한 |
|-----------|--------|-----------|------|
| `admin` | 관리자 | - | 전체 관리 권한 |
| `finance_head` | 재정팀장 | 3차 | 최종 결재, 재정 관리 |
| `accountant` | 회계 | 2차 | 2차 결재, 회계 처리 |
| `team_leader` | 팀장 | 1차 | 1차 결재 |
| `user` | 일반 사용자 | - | 지출결의서 작성 |

### 3. 사용자 계정

**tenant-seed.ts의 경우:**
- 관리자: `{subdomain}admin` (예: `chungyeonadmin`)
- 테스트 사용자: `{subdomain}user` (예: `chungyeonuser`)

**회사별 시드의 경우:**
- 관리자만 생성 (예: `chungyeon-admin`, `uni-admin`)

### 4. 조직 구조
- 위원회/본부
- 부서/팀

### 5. 예산 계정과목
- 예산 항(Category)
- 예산 목(Subcategory)
- 예산 세목(Detail) + 계정코드

---

## 접속 방법

시드 완료 후 다음 방법으로 접속할 수 있습니다:

### 로컬 개발 환경
```
http://localhost:3000?tenant={subdomain}
```

예시:
- http://localhost:3000?tenant=chungyeon
- http://localhost:3000?tenant=chungyeon-consulting
- http://localhost:3000?tenant=uni-environment

### 프로덕션 환경
```
https://{subdomain}.expense-saas.com
```

---

## 문제 해결

### 오류: TENANT_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다

**원인:** 필수 환경변수가 설정되지 않음

**해결:**
```bash
# .env 파일에 추가하거나
TENANT_ADMIN_PASSWORD="YourSecurePassword123!"

# 명령줄에서 직접 설정
TENANT_ADMIN_PASSWORD="YourSecurePassword123!" npx ts-node ...
```

### 오류: 비밀번호는 최소 12자 이상이어야 합니다

**원인:** 비밀번호가 너무 짧음

**해결:** 12자 이상의 비밀번호 사용
```bash
TENANT_ADMIN_PASSWORD="MySecure@Pass2026!"  # 18자
```

### 오류: DATABASE_URL 환경변수가 설정되지 않았습니다

**원인:** 데이터베이스 연결 정보 없음

**해결:** `.env` 파일에 DATABASE_URL 추가
```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

### 테넌트가 이미 존재합니다 (SKIP)

**원인:** 동일한 subdomain의 테넌트가 이미 존재

**해결:**
1. 기존 테넌트를 사용하거나
2. 데이터베이스에서 기존 테넌트 삭제 후 재실행

### 트랜잭션 오류 (데이터 불일치)

**원인:** 시드 중간에 오류 발생

**해결:** 시드 스크립트는 트랜잭션으로 래핑되어 있어 자동 롤백됨. 오류 원인 해결 후 재실행

---

## 보안 주의사항

1. **비밀번호 관리**
   - 환경변수로만 비밀번호 설정
   - `.env` 파일은 `.gitignore`에 포함되어 있음
   - 프로덕션에서는 첫 로그인 후 반드시 비밀번호 변경

2. **로그 보안**
   - 비밀번호는 콘솔에 출력되지 않음
   - CI/CD 환경에서 안전하게 사용 가능

3. **데이터베이스 보안**
   - SSL 연결 권장 (`?sslmode=require`)
   - 프로덕션 DB 접근 제한 설정

---

## 관련 문서

- [기본 계정과목 정의](./DEFAULT_CHART_OF_ACCOUNTS.md)
- [프로젝트 README](../README.md)
