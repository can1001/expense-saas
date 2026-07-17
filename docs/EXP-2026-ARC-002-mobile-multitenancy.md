# 지출결의서 SaaS 모바일 앱 멀티테넌시 설계서

| 항목 | 내용 |
|---|---|
| 문서번호 | EXP-2026-ARC-002 |
| 프로젝트 | expense-saas (지출결의서 플랫폼) |
| 대상 | Android 앱 (단일 앱 배포) |
| 작성일 | 2026-07-18 |
| 작성 | ㈜청연컨설팅 |
| 관련문서 | EXP-2026-ARC-001 (멀티테넌트 아키텍처 설계서) |

---

## 1. 설계 원칙

**앱은 하나, 테넌시 판단은 전부 서버.**

앱은 테넌트를 구분하는 로직을 갖지 않는다. 테넌트 식별·권한·화면 구성은 모두 서버가 결정하고, 앱은 서버가 내려주는 설정대로 렌더링만 한다.

## 2. 테넌트 식별 — 로그인으로 해결

### 2.1 UX 원칙

- 앱에서 "조직 코드 입력"을 요구하지 않는다.
- 이메일 로그인 → 서버가 소속 테넌트를 조회하는 방식.

### 2.2 복수 소속 대응 (Membership 구조)

한 사람이 여러 조직에 속할 수 있다 (예: 회사 직원이면서 교회 재정부 소속).

```prisma
model Membership {
  id       String @id @default(cuid())
  userId   String
  tenantId String
  role     String // TENANT_ADMIN / MEMBER 등

  @@unique([userId, tenantId])
}
```

- `User`가 `tenantId`를 직접 갖는 구조에서 `User` ↔ `Membership` ↔ `Tenant` 구조로 전환.
- 복수 소속인 경우: 로그인 직후 조직 선택 화면 + 앱 내 조직 전환 메뉴 제공.
- 단일 소속인 경우: 선택 화면 생략, 바로 진입.

## 3. 보안 — tenantId는 토큰 안에만

### 3.1 원칙

| 구분 | 내용 |
|---|---|
| 허용 | JWT 클레임에 `tenantId` 포함, 서버는 토큰의 tenantId로만 스코프 |
| 금지 | 클라이언트가 요청 바디·쿼리 파라미터로 tenantId 전송 |

클라이언트가 tenantId를 보내는 구조는 값 조작만으로 타 조직 데이터가 열리는 **멀티테넌시 최대 사고 지점**이다.

### 3.2 조직 전환 흐름

```
[앱] 조직 전환 요청 (POST /auth/switch-tenant { tenantId })
  → [서버] Membership 검증 → 새 tenantId 클레임의 토큰 발급
  → [앱] 토큰 교체 → 설정 재조회 → 화면 리로드
```

- 전환은 반드시 "전환 API 호출 → 새 토큰 발급" 방식.
- 기존 토큰의 tenantId를 앱이 임의로 바꿔 쓰는 경로는 존재하지 않아야 한다.

## 4. UI — 서버 주도 설정 (Server-Driven Config)

### 4.1 설정 조회

로그인/조직 전환 시 `GET /me/config` 호출. `Tenant.settings`(EXP-2026-ARC-001 §3.3)를 그대로 활용한다.

응답 예시:

```json
{
  "tenant": { "id": "...", "name": "청연교회", "orgType": "CHURCH" },
  "labels": {
    "department": "부서",
    "position": "직분",
    "budget": "예산(회계연도)"
  },
  "features": {
    "incomeModule": true,
    "budgetModule": true,
    "vat": false,
    "taxInvoice": false,
    "offeringLink": true
  },
  "branding": { "logoUrl": "...", "primaryColor": "#1F3864" }
}
```

### 4.2 앱 렌더링 규칙

| 항목 | 규칙 |
|---|---|
| 레이블 | "부서/직분" vs "팀/직급" 등 하드코딩 금지, 서버 레이블 맵으로 렌더링 |
| 기능 플래그 | `incomeModule: false`면 수입 탭 자체를 미노출 |
| 계정과목 | API 조회 (테넌트별 복제본) |
| 캐시 | 설정은 로컬 캐시, 앱 포그라운드 진입 시 재검증 |

### 4.3 효과

새 조직 유형(orgType)이 추가돼도 **앱 업데이트 없이 대응 가능.** 서버 템플릿·설정만 추가하면 된다.

## 5. 배포 — 단일 앱 우선

| 전략 | 판단 |
|---|---|
| 단일 앱 (Play Store 1개) | **채택.** 조직별 브랜딩(로고, 색상)은 settings로 런타임 적용 |
| 조직별 별도 앱 (white-label) | 보류. 빌드 flavor로 기술적으로는 가능하나 심사·업데이트 관리 비용이 조직 수만큼 증가 |

전용 앱(white-label)은 추후 **프리미엄 요금제 항목**으로 판매하는 카드로 남겨둔다.

## 6. 푸시 알림 (FCM) 테넌트 스코프

- FCM 토픽을 `tenant_{id}_...` 형태로 스코프 — 결재 알림이 타 조직에 새는 것을 방지.
- 디바이스 토큰 등록 시 tenantId를 함께 저장.
- **조직 전환 시 토픽 재구독 필수** (이전 조직 토픽 해제 → 새 조직 토픽 구독).

## 7. 구현 체크리스트

- [ ] `User.tenantId` → `Membership` 구조 마이그레이션
- [ ] JWT에 `tenantId` 클레임 추가, 전 API 토큰 기반 스코프 검증
- [ ] `POST /auth/switch-tenant` (Membership 검증 + 토큰 재발급)
- [ ] `GET /me/config` (labels + features + branding)
- [ ] 앱: 조직 선택/전환 화면, 서버 설정 기반 렌더링, 설정 캐시 + 포그라운드 재검증
- [ ] FCM 토픽 테넌트 스코프 + 전환 시 재구독
- [ ] 요청 바디/쿼리의 tenantId 수신 경로 전수 제거 (보안 점검)
