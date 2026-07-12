# 기업(COMPANY) 테넌트 관리자 페이지 — 1단계

> 브랜치: `20260712-david-company-admin` · 커밋: e974701 · 상태: 1단계 구현 완료

## 1. 목표

교회(CHURCH) 테넌트용으로 완성된 기존 `/admin`을 **orgType 분기 방식으로 재활용**하여,
기업(COMPANY) 테넌트 관리자가 자기 조직 용어로 관리자 페이지를 사용할 수 있게 한다.
파일럿 테넌트: (주)청연컨설팅.

## 2. 설계 원칙

1. **DB/API 무변경**: `Committee`/`Department` 모델과 API 필드명은 그대로 두고 화면 표시 용어만 치환한다.
   (청연컨설팅 시드가 이미 Committee=본부 4개, Department=팀 14개로 이 구조에 들어가 있음)
2. **기본값은 교회 용어**: orgType 미확정 시 기존 동작을 유지해 교회 테넌트 회귀를 방지한다.
3. **메뉴 필터링**: 교회 전용 기능(헌금 관리)은 CHURCH가 아닌 테넌트에서 메뉴 숨김 + 직접 접근 시 안내 표시.

## 3. 용어 매핑 (`lib/org-terms.ts`)

| 키 | CHURCH | COMPANY | NONPROFIT/SCHOOL/OTHER |
|----|--------|---------|------------------------|
| committee | 위원회 | 본부 | 본부 |
| department | 사역팀 | 팀 | 부서 |
| departmentFull | 사역팀(부) | 팀 | 부서 |
| departmentSlash | 사역팀/부 | 팀 | 부서 |
| operationalExpense | 사역비 | 팀 운영비 | 부서 운영비 |
| committeeLeader | 위원장 | 본부장 | 본부장 |

## 4. 구현 내역

- `lib/org-terms.ts` (신규): 용어 사전 + `getOrgTerms()` + `isChurchOnlyFeatureVisible()`
- `lib/contexts/TenantContext.tsx` (신규): `TenantProvider`(루트 Providers에 장착, `/api/tenant/info` 1회 조회,
  sessionStorage 캐시) + `useTenant()` + `useOrgTerms()`
- `lib/constants/admin-menu.ts`: `getAdminSidebarMenu(orgType)` — 라벨 분기 + 헌금 메뉴 노출 제어.
  기존 `ADMIN_SIDEBAR_MENU` 상수는 교회 기준으로 유지(호환)
- `components/admin/AdminSidebar.tsx`: orgType 기반 메뉴 생성 후 역할 필터 적용
- `app/admin/offerings/page.tsx`: 비교회 테넌트 접근 시 "사용하지 않는 기능" 안내
- 화면 30곳 라벨 치환: 관리자 페이지 전반 + 지출결의서 작성/목록/상세, 결재 상세, 자동이체 폼/상세,
  인쇄 양식(PrintHeader/PrintApprovalBox/SimplePrintableExpense), 홈, 재정 차트

## 5. 의도적으로 남긴 것 (후속 과제)

- 업로드 안내의 "열 구조: 위원회, 사역팀..." 문구 — 서버 파서가 기대하는 실제 엑셀 컬럼명이므로
  파서/템플릿을 orgType 인식으로 바꿀 때 함께 수정 (`budget-upload`, `leaders-upload`)
- `lib/schemas/expense-schema.ts`의 zod 검증 메시지("위원회를 선택해주세요" 등) — 모듈 레벨 스키마라
  팩토리 전환 필요 (RecurringExpenseForm은 전환 완료)
- `manager-exceptions`의 교회 예시 문구("공간사역팀 인건비...") — 조직 유형별 예시로 재작성
- NONPROFIT/SCHOOL 용어(부서)는 조사(이/가) 처리 미세 조정 필요

## 6. 검증

- `npx tsc --noEmit`: 소스 에러 0건 (기존 테스트 mock 타입 에러는 본 작업과 무관하게 존재)
- `npx vitest run`: 1,935개 전체 통과 (컨텍스트 기본값이 교회 용어라 기존 스냅샷/텍스트 단언 유지됨)
- 수동 확인 체크리스트:
  - [ ] 청연컨설팅 관리자 로그인 → 사이드바에 "본부 관리 / 팀 관리 / 팀 운영비 집행 현황" 표시, "헌금 관리" 없음
  - [ ] `/admin/offerings` 직접 접근 시 안내 화면
  - [ ] 지출결의서 작성 폼 선택 라벨이 "본부 / 팀"
  - [ ] 인쇄 미리보기 결재란이 "팀장"
  - [ ] 교회 테넌트 화면은 변경 전과 동일
