# 디자인 시스템 리디자인 정의 (2026-07-18)

> 목표 레퍼런스: 딥그린 사이드바 기반 회계 대시보드 시안 (첨부 이미지)
> 상태: **아이디어 정의 단계** — 구현 착수 전. HTML 목업으로 시각 검증 후 스펙 확정 예정.

## 1. 문제 정의 (How Might We)

> **HMW**: 화면마다 제각각인 blue/indigo 하드코딩 스타일을, 회계·재정 도메인에 어울리는
> 일관된 딥그린 디자인 시스템으로 전환하되 — 기존 기능(결재, 예산, 정기지출)을 깨지 않고
> 화면 단위로 점진 적용할 수 있게 하려면 어떻게 해야 하는가?

**대상 사용자**: 재정팀장/회계 간사(데스크톱 중심, 정보 밀도 높은 대시보드 필요) + 일반 기안자(모바일 중심, 작성/조회 위주).

**성공 기준**:
- 새 화면을 만들 때 색상·컴포넌트를 "고민 없이" 토큰에서 가져다 쓸 수 있다
- 대시보드 첫 화면에서 "내가 지금 처리해야 할 것"(대기 결재)이 3초 안에 보인다
- 기존 화면과 새 화면이 섞여 있어도 사용에 지장이 없다 (점진 적용 가능)

## 2. 현재 상태 진단

| 항목 | 현재 | 문제 |
|------|------|------|
| 색상 | `bg-blue-50` 94회, `bg-blue-600` 70회 등 Tailwind 클래스 하드코딩 | 팔레트 변경 = 전 파일 수정. 테넌트 테마 불가 |
| 토큰 | `globals.css`에 background/foreground 2개뿐 | 시맨틱 토큰(primary, success, warning…) 부재 |
| 타이포/여백 | `lib/constants/styles.ts`에 일부 상수 존재 | 부분적. 컴포넌트 절반은 미사용 |
| 레이아웃 | 상단 `Header.tsx` + 모바일 하단탭 | 메뉴가 늘어나 상단 헤더가 포화. 데스크톱 정보 구조 한계 |
| 기존 자산 | `components/approval/`, `charts/`, `reports/` 존재 | 시안의 스테퍼·집행률 바는 **신규 기능이 아니라 기존 기능의 리디자인** |

## 3. 레퍼런스 시안 해부

시안에서 추출한 구성 요소:

1. **AppShell**: 좌측 다크그린 사이드바(로고, 메뉴 + 뱃지 카운트, 하단 사용자 카드) + 밝은 그레이그린 본문
2. **탑바**: 페이지 타이틀 + 날짜/회계연도 메타 + 주요 CTA(지출결의서 작성) + 알림 벨(dot) + 아바타
3. **KPI 스탯 카드 ×4**: 아이콘 타일 + 라벨 + 큰 숫자 + 보조 뱃지/프로그레스 (대기 결재, 이번 달 지출, 예산 집행률, 정기 지출)
4. **결재 진행 스테퍼**: 기안 → 팀장 승인 → 회계 확인 → 재정팀장 승인. 완료(그린 체크)/대기(앰버 링) 상태, 타임스탬프
5. **최근 지출결의서 테이블**: 결의번호(모노스페이스풍) + 항목 + 부서 + 금액(우측정렬, tabular-nums) + 상태 필
6. **부서별 예산 집행 패널**: 부서명 + % + 프로그레스 바, 90% 초과 시 앰버 강조 + 경고 배너
7. **상태 컬러 시스템**: 대기=앰버, 승인=그린, 반려=레드 — 필/뱃지/프로그레스에 일관 적용

## 4. 디자인 토큰 (초안)

Tailwind 4 `@theme` + CSS 변수로 `globals.css`에 정의. 컴포넌트는 시맨틱 토큰만 참조.

### 4.1 색상

```css
:root {
  /* Brand — Deep Green */
  --color-brand-950: #0B231A;  /* 사이드바 배경 */
  --color-brand-900: #123324;  /* 사이드바 hover/사용자 카드 */
  --color-brand-800: #1A4732;
  --color-brand-700: #166B4A;  /* 주요 버튼 (CTA) */
  --color-brand-600: #178A55;  /* 프라이머리 */
  --color-brand-500: #1DA463;  /* 체크/프로그레스/포지티브 강조 */
  --color-brand-100: #D7F0E2;  /* 연한 배경 (아이콘 타일, 활성 필) */
  --color-brand-50:  #EDF7F1;

  /* Semantic */
  --color-bg:        #F5F7F6;  /* 본문 배경 (그레이그린) */
  --color-surface:   #FFFFFF;  /* 카드 */
  --color-border:    #E5EAE7;
  --color-text:      #16211B;
  --color-text-muted:#6B7A72;

  /* Status */
  --color-pending:   #B45309;  --color-pending-bg: #FEF3C7;  /* 대기 */
  --color-approved:  #15803D;  --color-approved-bg:#DCFCE7;  /* 승인 */
  --color-rejected:  #B91C1C;  --color-rejected-bg:#FEE2E2;  /* 반려 */
  --color-warning-bg:#FFFBEB;  /* 예산 초과 배너 */
}
```

- 다크모드: 1차 범위 제외 (Not Doing 참조). 단, 토큰 구조상 나중에 `:root.dark` 재정의만으로 가능하게 유지.
- 접근성: 상태 필 텍스트/배경 대비 WCAG AA(4.5:1) 이상 확인 필수 — 목업 단계에서 검증.

### 4.2 타이포그래피 / 형태

| 토큰 | 값 | 용도 |
|------|-----|------|
| 페이지 타이틀 | 24px / bold | "회계 대시보드" |
| 카드 타이틀 | 16px / semibold | 섹션 헤더 |
| KPI 숫자 | 28~32px / bold / `tabular-nums` | 스탯 카드 |
| 본문 | 14px | 테이블, 리스트 |
| 캡션 | 12px / muted | 날짜, 보조 설명 |
| radius | 카드 16px, 필 9999px, 버튼 10px | |
| shadow | `0 1px 3px rgb(0 0 0 / 0.06)` + border | 카드는 그림자보다 보더 위주 |
| 금액 | 우측 정렬 + `tabular-nums` + ₩ 접두 | 모든 금액 표기 통일 |

### 4.3 컴포넌트 인벤토리

| 컴포넌트 | 상태 | 비고 |
|----------|------|------|
| `AppShell` (사이드바+탑바) | 신규 | 데스크톱 md+ 사이드바, 모바일은 기존 하단탭 유지 |
| `StatCard` | 신규 | KPI 4종. `components/ui/`에 배치 |
| `ApprovalStepper` | 개편 | 기존 `components/approval/` 재스타일 |
| `StatusPill` | 신규 | 대기/승인/반려 — 현재 화면별 제각각인 뱃지 통합 |
| `ProgressBar` | 신규 | 예산 집행률. 90% 초과 시 앰버 전환 |
| `DataTable` 스타일 | 개편 | 기존 테이블에 새 토큰 적용 |
| `WarningBanner` | 신규 | 예산 초과 알림 |

## 5. 사이드바 IA 통합 (확정: 2026-07-18)

`docs/admin-sidebar-ia.md`는 이미 구현 완료된 상태다 — `components/admin/AdminSidebar.tsx` +
`AdminLayout.tsx` + `lib/constants/admin-menu.ts`(현재 9개 그룹: 대시보드/조직 관리/사용자·역할/
예산 편성/결산·실적/결재 관리/지출 관리/수입 관리/시스템). 따라서 통합의 의미는:

### 5.1 2단 내비게이션 구조

```
전역 사이드바 (AppShell — 신규)          관리자 컨텍스트 (/admin — 기존 재스타일)
─────────────────────────────          ─────────────────────────────
대시보드                                 ← 대시보드로 (백링크)
지출결의서 작성                          ┌ 그룹 타이틀 (admin-menu.ts 그대로)
결재함 [뱃지]                            │ 조직 관리
예산 관리                                │ 사용자/역할
정기 지출                                │ 예산 편성
영수증 관리          ← 신규 (7절)        │ 결산/실적
보고서                                   │ 결재 관리 · 지출 관리 · 수입 관리
관리자 콘솔          ← 권한별 노출        └ 시스템
```

- **사이드바 컴포넌트는 하나로 통합**: 메뉴 config(전역 vs admin)만 주입받는 공용 `Sidebar`.
  `/admin/*` 진입 시 관리자 config로 전환, 상단에 "← 대시보드로" 백링크.
- **메뉴 데이터 소스**: 전역은 기존 `menu-permissions.ts`의 권한 로직 이관,
  관리자는 기존 `admin-menu.ts` 그대로 사용 (IA 변경 없음, 스타일만 교체).

### 5.2 기존 메뉴 → 새 사이드바 매핑 (검토 완료: 2026-07-18)

기존 전역 메뉴 전수 조사(`Header.tsx` navItems + 드롭다운, `HomeClient.tsx` 카드 링크) 결과,
**누락 없이 전부 녹일 수 있다.** 권한 노출은 기존 permission 파생 함수를 그대로 사용한다.

| 새 사이드바 항목 | 기존 메뉴/라우트 | 권한 (기존 함수) | 비고 |
|------------------|------------------|------------------|------|
| 대시보드 | `/` (HomeClient 카드 그리드) | 로그인 사용자 | 카드 그리드 → 대시보드로 대체 (Phase 2) |
| 지출결의서 | `/expenses` (Header "지출결의서") | 전체 | `/expenses/new`는 탑바 CTA 버튼으로. 간편 작성 `/expenses/simple/new`는 CTA 분기 또는 하위 항목 (`SIMPLE_EXPENSE_USE`) |
| 결재함 [뱃지] | `/approvals` (Header "결재함") | `canAccessApprovalMenu` + 세목 담당자 | 뱃지 = 기존 `usePendingApprovalCount` |
| 예산 관리 | `/admin/budget-view` | `BUDGET_VIEW` permission | 전역 전용 라우트 없음 → BUDGET_VIEW 권한자에게 admin 페이지 링크 노출 (MENU_PERMISSIONS에 이미 존재) |
| 정기 지출 | `/recurring-expenses` (Header "자동이체") | `canAccessRecurringExpenseMenu` | **라벨 통일 필요**: "자동이체" → "정기 지출" 채택 제안 |
| 영수증 관리 | `/receipts` (신규, 6절) | 신규 `RECEIPT_READ` permission | 회계/재정팀장 + admin 프리셋 |
| 보고서 | `/reports/financial` | `REPORT_FINANCIAL_READ` | 결산·분기 보고서류는 admin 컨텍스트에 유지 |
| 관리자 콘솔 | `/admin` (Header "관리") | `canAccessAdminMenu` | |
| (하단 사용자 카드) | `/mypage` + 서명·비밀번호·알림 4종 | 로그인 사용자 | Header 드롭다운 → 사용자 카드 클릭 시 메뉴 |

- `/youth-night`: Header에서 이미 주석 처리(임시 숨김) — 사이드바에도 미포함, `HomeClient` 잔여 링크는 대시보드 교체 시 정리
- 신규 permission 추가 시 `lib/auth/permissions.ts` 프리셋 → `menu-permissions.ts` 파생 패턴 준수 (하드코딩 금지 원칙 유지)
- **스타일 대체 선언**: `admin-sidebar-ia.md` §6 스타일 가이드(white bg + blue-50 활성)는
  본 문서의 딥그린 토큰(`brand-950` 배경 + `brand-500` 액센트)으로 **대체(supersede)**한다.
  IA 설계(§2 그룹화, §8 접근성/활성 표시 규칙)는 계속 유효.
- 반응형: 데스크톱 고정 240px → 태블릿 아이콘 접힘 → 모바일 기존 하단탭 + 햄버거(admin).

## 6. 영수증 관리 — 신규 기능 정의 (확정: 포함)

**현재 상태**: 영수증은 지출결의서 작성 시 첨부(`FileUpload`/`ImagePreview`/카메라)만 가능하고,
결의서를 열지 않으면 볼 수 없다. 예외 세목은 `lib/constants/receipt-exempt-details.ts`(5개)로 관리 중.

**MVP 범위** (별도 스펙 문서로 상세화 필요):
- 영수증 목록/갤러리 뷰 — 기간·부서·결재상태 필터, 썸네일 + 원본 보기
- **미첨부 현황**: 영수증 없는 결의서 목록 (예외 세목 자동 제외) — 회계 간사의 핵심 pain point
- 원본 다운로드 (감사 대비)

**MVP 이후 백로그**: OCR 금액 대사, 기간 일괄 zip 다운로드, 결산 보고서 연동

**라우트**: `/receipts` (전역 사이드바 항목)

**접근 권한 (확정)**: **회계/재정팀장만** (+ admin). 구현은 신규 `PERMISSIONS.RECEIPT_READ`를
`lib/auth/permissions.ts`의 회계/재정팀장 프리셋에 부여하고, 메뉴 노출·서버 가드 모두
permission에서 파생 — 팀장의 자기 부서 열람은 범위에서 제외.

## 7. 적용 로드맵

```
Phase 0  토큰 정의        globals.css @theme + StatusPill/ProgressBar 등 기초 컴포넌트
Phase 1  AppShell         공용 Sidebar 도입 (전역 + admin config 통합), 모바일 탭 유지
Phase 2  대시보드         홈(HomeClient)을 시안의 회계 대시보드로 교체 — 역할별 위젯
Phase 3  목록/결재함      지출결의서 목록, 결재함에 새 테이블/필/스테퍼 적용
Phase 4  폼/나머지        작성 폼, 보고서, 관리자 화면 순차 적용
Phase 5  영수증 관리      신규 기능 (6절 MVP) — 별도 스펙 선행
```

각 Phase는 독립 배포 가능. Phase 2까지가 체감 효과의 80%.

## 8. 아이디어 백로그 (발산 단계에서 나온 변형)

1. **테넌트별 테마** — SaaS이므로 `--color-brand-*`를 테넌트 설정으로 오버라이드. 토큰 구조만 잡아두면 추후 1일 작업. *(1차 제외, 구조만 대비)*
2. **역할별 대시보드** — 재정팀장: 대기 결재·집행률 중심 / 기안자: 내 결의서 상태 중심. `docs/role-based-home-analysis.md`와 연결됨. *(Phase 2에 포함 검토)*
3. **예산 90% 초과 알림 연동** — 시안의 경고 배너를 기존 push-notification 인프라와 연결. *(백엔드 연동 별도 스펙 필요)*
4. **스테퍼 공용화** — 결재 상세·목록 카드·대시보드에서 동일 `ApprovalStepper` 재사용, 사이즈 variant만 분리
5. **밀도 전환(Compact 모드)** — 회계 간사용 테이블 밀도 토글. *(수요 확인 전까지 보류)*
6. **10x 버전: 인사이트 리포트** — 전월 대비 증감, 이상 지출 탐지 등. *(비전 항목, 이번 범위 아님)*

## 9. 검증할 가정

- [ ] **딥그린이 전 테넌트에 수용 가능하다** → 청연컨설팅 등 실사용 테넌트에 목업 공유해 확인
- [ ] **사이드바 전환 시 기존 Header의 권한별 메뉴 로직을 그대로 이관할 수 있다** → `menu-permissions.ts` 구조 검토로 확인
- [ ] **공용 Sidebar가 전역/admin 두 config를 무리 없이 수용한다** → 기존 `AdminSidebar.tsx` 구조가 config 주입형이라 가능성 높음, 구현 시 확인
- [ ] **화면별 점진 적용 시 신·구 스타일 혼재가 견딜 만하다** → Phase 1 배포 후 실사용 피드백
- [ ] **상태 컬러(앰버/그린/레드)가 기존 결재 상태 enum과 1:1 매핑된다** → 결재 상태 값 전수 조사

## 10. Not Doing (이번 범위에서 하지 않는 것)

- **전면 일괄 리디자인** — 회귀 리스크 큼. 화면 단위 점진 적용
- **다크모드** — 토큰 구조만 대비하고 구현은 보류 (회계 업무 특성상 수요 낮음)
- **차트 라이브러리 교체** — 기존 `components/charts/` 유지, 색상만 토큰 적용
- **모바일 하단탭 구조 변경** — 검증된 UX. 색상 토큰만 교체
- **컴포넌트 라이브러리(shadcn 등) 도입** — 기존 컴포넌트 자산이 충분, 토큰 기반 재스타일로 충분
- **admin-menu.ts IA 재편** — 관리자 메뉴 그룹 구조는 그대로 두고 스타일만 교체 (5절)

## 11. 확정된 결정 사항 (구 Open Questions)

- **사이드바 통합** → 5절: 공용 Sidebar + config 주입, admin IA 유지. 기존 메뉴 매핑 검토 완료 (5.2절, 누락 없음)
- **영수증 관리** → 6절: 포함. 접근 권한 = 회계/재정팀장만 (신규 `RECEIPT_READ` permission)
- **회계연도 데이터 소스** → 조사 결과 중앙 설정 없음. 현재 연도는 기능별로
  `new Date().getFullYear()` 파생(예외: 분기보고서는 1분기에 전년도 기본값), 연도 스코프 데이터는
  `BudgetDetailYear.year`·`UserYearRole.year` 등에 저장, 테넌트 settings에는 라벨 "예산(회계연도)"만 존재.
  **결정**: 탑바 표기는 공용 헬퍼 `getFiscalYear()`(현재는 캘린더 연도 반환)를 신설해 단일 출처화.
  비(非)캘린더 회계연도가 필요해지면 테넌트 settings에 `fiscalYearStartMonth`를 추가해 이 헬퍼만 수정.

남은 열린 질문: 없음 — 스펙 작성 단계로 진행 가능.

## 12. 다음 단계 & 활용 스킬

| 순서 | 작업 | 스킬 |
|------|------|------|
| 1 | HTML 목업으로 토큰/컴포넌트 시각 검증 | `artifact-design`, `dataviz` |
| 2 | 확정 후 상세 스펙 작성 | `agent-skills:spec-driven-development` |
| 3 | Phase별 태스크 분해 | `agent-skills:planning-and-task-breakdown` |
| 4 | 구현 (접근성 포함) | `agent-skills:frontend-ui-engineering` + `incremental-implementation` |
| 5 | 브라우저 실검증 | `agent-skills:browser-testing-with-devtools` |
