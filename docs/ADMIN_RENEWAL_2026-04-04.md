# 관리자 페이지 리뉴얼 작업 내역

**작업일**: 2026-04-04

## 개요

지출결의시스템 관리자 페이지(`/admin`)를 전면 리뉴얼하였습니다.

- 메뉴 구조 재설계 (7개 → 8개 그룹)
- 대시보드 KPI 카드 추가
- 신규 페이지 3개 추가
- 담당자 예외 케이스 관리 기능 추가

---

## 1. 메뉴 구조 재설계

### 변경 파일
- `lib/constants/admin-menu.ts`

### 변경 내용

| 기존 (7개 그룹) | 신규 (8개 그룹) |
|----------------|----------------|
| 대시보드 | 대시보드 |
| 연도 설정 | 조직 관리 |
| 인원 관리 | 사용자/역할 |
| 예산 관리 | 예산 편성 |
| 현황/리포트 | 결산/실적 |
| 알림 | **결재 관리** (신규) |
| 재정 수입 | 수입 관리 |
| - | 시스템 |

### 상세 메뉴 구조

#### 1. 대시보드
- 홈 (`/admin`)

#### 2. 조직 관리
- 위원회 관리 (`/admin/committees`)
- 사역팀(부) 관리 (`/admin/departments`)

#### 3. 사용자/역할
- 사용자 관리 (`/admin/users`)
- 사용자 일괄 등록 (`/admin/users-upload`)
- 역할 관리 (`/admin/roles`)
- 연도별 역할 설정 (`/admin/year-roles`)
- 팀장 일괄 등록 (`/admin/leaders-upload`)
- 팀장 현황 (`/admin/year-roles-summary`)

#### 4. 예산 편성
- 설정 마법사 (`/admin/budget-wizard`)
- 예산 마스터 업로드 (`/admin/budget-upload`)
- 세목별 담당자 (`/admin/budget-managers`)
- 적요 예제 관리 (`/admin/memo-examples`)
- 설정 완료 현황 (`/admin/year-setup-status`)

#### 5. 결산/실적
- 예산 현황 조회 (`/admin/budget-view`)
- 사역비 집행 현황 (`/admin/budget-execution`)
- 인사/행정비 현황 (`/admin/hr-admin-execution`)
- 분기별 회계보고 (`/admin/quarterly-report`)
- **분기별 누적 현황** (`/admin/cumulative-report`) - 신규

#### 6. 결재 관리 (신규 그룹)
- **결재라인 규칙** (`/admin/approval-rules`) - 신규
- **담당자 예외 현황** (`/admin/manager-exceptions`) - 신규

#### 7. 수입 관리
- 헌금 관리 (`/admin/offerings`)

#### 8. 시스템
- 시스템 설정 (`/admin/settings`)
- 알림 발송 (`/admin/notifications`)

---

## 2. 대시보드 강화

### 신규 파일
- `app/api/admin/dashboard/route.ts` - 대시보드 KPI API

### 변경 파일
- `app/admin/page.tsx` - 대시보드 페이지 전면 개편

### 추가된 기능

#### KPI 카드 (4개)
| 지표 | 설명 | 색상 |
|------|------|------|
| 예산 집행률 | 당해연도 사용액/예산액 (%) | Blue |
| 결재 대기 건수 | PENDING/APPROVED_STEP_1/APPROVED_STEP_2 상태 건수 | Orange |
| 이번 달 지출 | 당월 APPROVED_FINAL 합계 | Green |
| 지급 대기 건수 | APPROVED_FINAL이지만 COMPLETED 아닌 건수 | Amber |

#### 빠른 링크 (4개)
- 연도별 설정 마법사
- 결재 대기함
- 분기별 회계보고
- 담당자 예외 현황

#### 최근 지출결의서
- 최근 제출된 5건 테이블 표시
- 신청자, 위원회, 부서, 금액, 상태, 신청일

#### 연간 요약
- 연간 지출 합계 및 건수
- 예산 잔액

---

## 3. 분기별 누적 현황 페이지 (신규)

### 신규 파일
- `app/api/admin/cumulative-report/route.ts`
- `app/admin/cumulative-report/page.tsx`

### 기능
- 연도/분기 선택
- 1분기부터 선택한 분기까지의 누적 집행 실적 조회
- 요약 카드: 예산총액, 누적지출, 누적잔액, 집행률
- 분기별 지출 추이 막대 차트
- 부서별 누적 집행 현황 (위원회별 접기/펼치기)
- CSV 내보내기

### API 응답 구조
```typescript
{
  year: number;
  toQuarter: number;
  summary: {
    totalBudget: number;
    cumulativeSpent: number;
    remaining: number;
    executionRate: number;
  };
  quarterlyBreakdown: Array<{
    quarter: number;
    spent: number;
    ratio: number;
  }>;
  byDepartment: Array<{
    committee: string;
    department: string;
    budget: number;
    cumulativeSpent: number;
    remaining: number;
    executionRate: number;
  }>;
}
```

---

## 4. 결재라인 규칙 관리 페이지 (신규)

### 신규 파일
- `app/admin/approval-rules/page.tsx`

### 기능
- 기본 결재 구조 시각화 (1차 담당자 → 2차 회계 → 3차 재정팀장)
- 역할별 결재 권한 테이블
- 연도별 회계/재정팀장 현황
- 전결(자동승인) 규칙 안내
  - 담당자 = 재정팀장인 경우 → 1차 자동승인
  - 신청자 = 담당자인 경우 → 1차 자동승인 (팀장 전결)
- 팀장 현황 요약

---

## 5. 담당자 예외 관리

### 5.1 담당자 예외 현황 페이지 (신규)

#### 신규 파일
- `app/api/admin/manager-exceptions/route.ts`
- `app/admin/manager-exceptions/page.tsx`

#### 기능
- 세목별 담당자가 해당 사역팀장과 다른 케이스 목록
- 요약: 전체 세목 수, 예외 건수, 예외 비율
- 위원회 필터링
- Excel 다운로드

#### API 응답 구조
```typescript
{
  year: number;
  summary: {
    totalDetails: number;
    exceptionCount: number;
    exceptionRate: number;
  };
  exceptions: Array<{
    budgetDetailId: string;
    committee: string;
    department: string;
    category: string;
    subcategory: string;
    detail: string;
    teamLeader: { id: string; name: string } | null;
    manager: { id: string; name: string };
  }>;
}
```

### 5.2 세목별 담당자 페이지 개선

#### 변경 파일
- `app/admin/budget-managers/page.tsx`

#### 추가된 기능
- 연도별 팀장 정보 로드
- "예외만 보기" 체크박스 필터
- 담당자가 팀장과 다른 경우 **예외** 배지 표시
- 예외 케이스 행 하이라이트 (amber 배경)
- 배지 hover 시 팀장 정보 툴팁

---

## 파일 변경 요약

### 신규 생성 (7개)
| 파일 | 설명 |
|------|------|
| `app/api/admin/dashboard/route.ts` | 대시보드 KPI API |
| `app/api/admin/cumulative-report/route.ts` | 분기별 누적 현황 API |
| `app/api/admin/manager-exceptions/route.ts` | 담당자 예외 현황 API |
| `app/admin/cumulative-report/page.tsx` | 분기별 누적 현황 페이지 |
| `app/admin/approval-rules/page.tsx` | 결재라인 규칙 페이지 |
| `app/admin/manager-exceptions/page.tsx` | 담당자 예외 현황 페이지 |
| `docs/ADMIN_RENEWAL_2026-04-04.md` | 작업 내역 문서 (본 파일) |

### 수정 (3개)
| 파일 | 변경 내용 |
|------|----------|
| `lib/constants/admin-menu.ts` | 8개 그룹으로 메뉴 재구성 |
| `app/admin/page.tsx` | KPI 카드 + 빠른 링크 + 최근 지출결의서 |
| `app/admin/budget-managers/page.tsx` | 예외 케이스 표시 + 필터 기능 |

---

## 검증

- `npm run lint` - 경고 4개 (exhaustive-deps), 에러 없음
- `npm run build` - 성공
- `npm run dev` - 정상 실행 (localhost:3000)

---

## 6. 추가 개선 사항 (오후 작업)

### 6.1 담당자 예외 현황 페이지 - 팀장 직접 지정 기능

#### 변경 파일
- `app/admin/manager-exceptions/page.tsx`

#### 추가 기능
- 팀장이 "미지정"인 경우 드롭다운에서 팀장 직접 지정 가능
- 사용자 선택 시 자동으로 `UserYearRole`에 등록
- 지정 완료 시 데이터 자동 새로고침

---

### 6.2 위원회/사역팀 관리 - 사용자 목록 API 버그 수정

#### 변경 파일
- `app/admin/committees/page.tsx`
- `app/admin/departments/page.tsx`

#### 문제
- 사용자 목록 API 호출 시 잘못된 파라미터 사용
- `?active=true` (잘못됨) → `?isActive=true&pageSize=200` (수정)

#### 결과
- 위원장/팀장 선택 시 전체 사용자 목록 정상 표시

---

### 6.3 사역팀 관리 페이지 - UserYearRole 연동

#### 변경 파일
- `app/admin/departments/page.tsx`

#### 문제
- `/admin/departments`: `Department.leaderId` 사용 (레거시)
- `/admin/manager-exceptions`: `UserYearRole` 사용 (연도별)
- 두 페이지의 팀장 정보 불일치

#### 해결
- departments 페이지에서 `UserYearRole`을 조회하여 팀장 표시
- 팀장 지정 시 `UserYearRole`에 등록
- 두 페이지의 팀장 데이터 일관성 확보

---

### 6.4 팀장 겸직 지원 (스키마 변경)

#### 변경 파일
- `prisma/schema.prisma`
- `lib/services/user-service.ts`
- `prisma/seed.ts`
- `app/api/users/year-roles/route.ts`

#### 문제
- 기존 유니크 제약: `@@unique([userId, year])`
- 한 사용자가 연도별로 하나의 역할만 가능
- 예: 윤운문이 재정팀장 + 행정비 팀장 + 인사위 팀장 불가

#### 해결
```prisma
// 변경 전
@@unique([userId, year])

// 변경 후
@@unique([userId, year, department])
```

- 같은 사용자가 여러 부서의 팀장 겸직 가능
- `setYearRole` 함수 로직 수정 (nullable department 처리)

---

## 파일 변경 요약 (추가분)

### 수정 (6개)
| 파일 | 변경 내용 |
|------|----------|
| `app/admin/manager-exceptions/page.tsx` | 팀장 직접 지정 드롭다운 추가 |
| `app/admin/committees/page.tsx` | 사용자 API 버그 수정 |
| `app/admin/departments/page.tsx` | UserYearRole 연동, 사용자 API 버그 수정 |
| `prisma/schema.prisma` | UserYearRole 유니크 제약 변경 |
| `lib/services/user-service.ts` | setYearRole 함수 로직 수정 |
| `prisma/seed.ts` | 새 유니크 제약 적용 |

---

## 커밋 내역 (4월 4일)

| 커밋 | 메시지 |
|------|--------|
| `23344a7` | feat: 관리자 페이지 리뉴얼 - 메뉴 구조 개편 및 신규 페이지 추가 |
| `05c4389` | feat: 담당자 예외 현황 페이지에서 팀장 직접 지정 기능 추가 |
| `39bc091` | fix: 위원회 관리 페이지 사용자 목록 조회 버그 수정 |
| `a2c51cf` | feat: 팀장 겸직 지원 및 departments 페이지 UserYearRole 연동 |

---

## 향후 개선 가능 사항

1. **결재라인 규칙 편집 기능**: 현재 읽기 전용, 향후 규칙 수정 기능 추가 가능
2. **대시보드 차트 추가**: 분기별 추이 라인 차트
3. **담당자 예외 사유 입력**: 예외 케이스에 사유 필드 추가
4. **알림 연동**: 예외 케이스 발생 시 관리자 알림
5. **Department.leaderId 필드 폐기**: UserYearRole로 완전 이전 후 레거시 필드 제거
