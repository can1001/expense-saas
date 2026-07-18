# Spec: 디자인 토큰 (Phase 0) + AppShell 공용 사이드바 (Phase 1)

> 상위 문서: `docs/DESIGN_SYSTEM_2026-07-18.md` (방향·토큰·IA 확정)
> 상태: 검토 대기 — 승인 후 태스크 분해(Phase: Tasks) 진행
> 범위: 로드맵의 Phase 0 + Phase 1만. 대시보드(Phase 2) 이후는 별도 스펙.

## 0. 전제 (Assumptions)

1. **Header는 페이지별 렌더링** — 루트 `app/layout.tsx`에 없음. 따라서 라우트 그룹 재편 없이
   페이지 단위로 `Header` → `AppShell` 점진 교체가 가능하다.
2. **첫 적용 대상은 admin 영역** — `app/admin/layout.tsx` + `AdminLayout`이 이미 있어
   구조 변경 없이 재스타일만으로 새 디자인을 검증할 수 있다. 전역 페이지는 Phase 2+에서 교체.
3. **토큰은 Tailwind 4 `@theme`로 정의** — `bg-brand-600` 같은 유틸리티가 자동 생성되므로
   기존 Tailwind 클래스 방식 코드와 자연스럽게 공존한다.
4. 신규 라우트·DB 변경·의존성 추가 없음 (lucide-react 등 기존 것만 사용).
5. 다크모드는 구현하지 않는다 (토큰 구조만 호환 유지).

→ 이 전제가 틀렸다면 스펙 수정 후 진행.

## 1. Objective

blue/indigo 하드코딩 스타일을 딥그린 디자인 토큰 체계로 전환하기 위한 기반을 만든다.

- **Phase 0**: 시맨틱 토큰 + 기초 컴포넌트(StatusPill/ProgressBar/StatCard)를 만들어
  이후 모든 화면 작업이 토큰만 참조하게 한다.
- **Phase 1**: config 주입형 공용 `Sidebar`(딥그린) + `AppShell`을 만들고,
  admin 영역에 먼저 적용해 실화면에서 검증한다.

**사용자 스토리**
- 개발자로서, 새 화면을 만들 때 색을 `brand-*`/`status-*` 토큰에서 가져와 일관성을 유지한다.
- 관리자 권한 사용자로서, admin 영역에서 딥그린 사이드바로 동일한 메뉴를 이용한다 (기능 변화 없음).

## 2. Tech Stack

- Next.js 16.0.5 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 (`@import "tailwindcss"` + `@theme`)
- lucide-react (아이콘) · vitest (테스트)

## 3. Commands

```bash
pnpm run dev            # 개발 서버
pnpm run build          # 프로덕션 빌드 (--webpack, PWA)
pnpm test               # vitest (watch)
pnpm vitest run         # vitest 1회 실행
pnpm run lint           # eslint
```

## 4. Project Structure (이번 작업 산출물)

```
app/globals.css                     # [수정] @theme 토큰 블록 추가
lib/constants/design-tokens.ts      # [신규] TS에서 토큰 참조가 필요한 경우의 단일 출처 (색 hex 재정의 금지, CSS var 참조)
lib/constants/global-menu.ts        # [신규] 전역 사이드바 메뉴 config (권한은 menu-permissions.ts 파생)
lib/utils/fiscal-year.ts            # [신규] getFiscalYear() — 탑바 회계연도 단일 출처
components/ui/StatusPill.tsx        # [신규] 대기/승인/반려/브랜드 variant
components/ui/ProgressBar.tsx       # [신규] 집행률 바 (90% 초과 시 warning variant)
components/ui/StatCard.tsx          # [신규] KPI 카드 (Phase 2 대비, 이번엔 컴포넌트+테스트만)
components/layout/Sidebar.tsx       # [신규] 공용 사이드바 — 메뉴 config 주입형, 딥그린
components/layout/AppShell.tsx      # [신규] Sidebar + 탑바 + 콘텐츠 영역
components/admin/AdminSidebar.tsx   # [수정] 공용 Sidebar를 admin config로 래핑 (권한 필터·드로어 로직 유지)
components/ui/__tests__/            # [신규] 컴포넌트 테스트
```

## 5. 상세 설계

### 5.1 Phase 0 — 토큰

`globals.css`에 `@theme` 블록 추가 (상위 문서 4.1절 값 그대로):

```css
@theme {
  --color-brand-950: #0B231A;   /* 사이드바 배경 */
  --color-brand-900: #123324;
  --color-brand-800: #1A4732;
  --color-brand-700: #166B4A;   /* CTA */
  --color-brand-600: #178A55;   /* 프라이머리 */
  --color-brand-500: #1DA463;
  --color-brand-100: #D7F0E2;
  --color-brand-50:  #EDF7F1;
  --color-status-pending:      #B45309;
  --color-status-pending-bg:   #FEF3C7;
  --color-status-pending-bar:  #D97706;  /* 대비 3:1 확보용 바 채움색 */
  --color-status-approved:     #15803D;
  --color-status-approved-bg:  #DCFCE7;
  --color-status-rejected:     #B91C1C;
  --color-status-rejected-bg:  #FEE2E2;
  --color-surface-bg:          #F5F7F6;
}
```

→ `bg-brand-950`, `text-status-pending` 등 유틸리티 자동 생성. 기존 blue 클래스는 건드리지 않음(공존).

**기초 컴포넌트 계약**

```tsx
<StatusPill variant="pending | approved | rejected | brand">대기</StatusPill>
<ProgressBar value={68} warnThreshold={90} label="예산 집행률" />  // value≥threshold → 앰버 + aria
<StatCard icon={Clock} label="대기 중 결재" value="8건"
          sub={<StatusPill variant="pending">승인 필요</StatusPill>} />
```

- 금액·숫자는 `tabular-nums`, 필 radius 9999px, 카드 radius 16px, 터치 타겟 `min-h-[44px]`.
- ProgressBar는 `role="progressbar"` + `aria-valuenow` 필수, % 텍스트 라벨 상시 표시.

### 5.2 Phase 1 — 공용 Sidebar + AppShell

**Sidebar (config 주입형)**

```tsx
interface SidebarConfig {
  variant: 'global' | 'admin';
  backLink?: { href: string; label: string };   // admin: "← 대시보드로"
  groups: { title?: string; items: SidebarItem[] }[];  // global은 title 없는 단일 그룹
}
interface SidebarItem {
  href: string; label: string; icon: LucideIcon;
  badgeCount?: number;                           // 결재함 뱃지
}
```

- 스타일: `bg-brand-950` 배경, 활성 항목 `bg-brand-900` + `inset 3px` 그린 액센트,
  그룹 타이틀 uppercase 12px. 목업(아티팩트 v0.3) 기준.
- 반응형: 데스크톱(lg+) 고정 240px / 모바일 드로어(오버레이+ESC 닫기) — 기존 AdminSidebar 동작 이식.
- 하단 사용자 카드: 이름·이메일·아바타, 클릭 시 마이페이지 메뉴(서명/비밀번호/알림/로그아웃).
  기존 Header 드롭다운 로직 재사용.

**AdminSidebar 리팩터링**: 데이터 로직(역할 fetch, `filterAdminMenuByRoles`,
`getAdminSidebarMenu`)은 유지하고, 렌더링만 공용 `Sidebar`에 위임. `admin-menu.ts` IA 변경 없음.

**AppShell**: `<AppShell title="회계 대시보드" actions={<CTA/>}>{children}</AppShell>`
— 사이드바 + 탑바(타이틀·`getFiscalYear()` 표기·CTA·알림 벨·아바타) + 본문.
이번 Phase에서는 admin 영역(`AdminLayout`)만 AppShell로 전환. 전역 페이지는 Header 유지.

> **구현 중 결정 (2026-07-18)**: Header(637줄 — 사용자 메뉴·테넌트 스위처·알림·사용자 등록)를
> Phase 1에서 통째로 대체하는 것은 태스크 크기 원칙 위반이라, AppShell에 `withHeader` 전환기
> 옵션을 두어 admin은 기존 Header를 유지한 채 딥그린 사이드바 + 타이틀/회계연도 탑바만 적용했다.
> 알림 벨·아바타의 탑바 이관(Header 완전 대체)은 Phase 2 대시보드 스펙에서 진행.

**getFiscalYear()**: `new Date().getFullYear()` 반환하는 순수 함수 + JSDoc으로
"비캘린더 회계연도 도입 시 이 함수만 수정" 명시. 탑바에서 사용.

## 6. Code Style

기존 컨벤션 준수 예시 (권한은 반드시 파생, 하드코딩 금지):

```tsx
// lib/constants/global-menu.ts
import { canAccessApprovalMenu, canAccessAdminMenu } from '@/lib/constants/menu-permissions';

/** 전역 사이드바 메뉴 — 권한 판정은 menu-permissions.ts 파생 함수만 사용한다 */
export function getGlobalSidebarMenu(user: { roles: string[] }): SidebarConfig {
  ...
}
```

- 주석·라벨 한글, 커밋 메시지 한글 (`feat(design): ...`)
- `cn()` 유틸로 클래스 조합, 컴포넌트별 named export 지양(기존 default export 관례 유지)

## 7. Testing Strategy

- vitest + @testing-library/react, 위치는 기존 관례대로 `components/**/__tests__/`
- **Phase 0**: StatusPill variant→클래스 매핑, ProgressBar 임계값 전환(89/90/91%)·aria 속성,
  StatCard 렌더링 스냅샷 없이 역할 기반 단언
- **Phase 1**: Sidebar — config 렌더링, 활성 경로 하이라이트(`/admin` 정확일치·하위경로 규칙 유지),
  뱃지 표시, 드로어 ESC 닫기. AdminSidebar — 기존 테스트 깨지지 않아야 함(`components/__tests__` 확인)
- 회귀 기준: `pnpm vitest run` 전체 통과 + `pnpm run build` 성공

## 8. Boundaries

- **Always**: 커밋 전 `pnpm vitest run` + `pnpm run lint` · 색상은 토큰 유틸리티만 사용 ·
  권한 노출은 permission 파생 함수 경유 · 터치 타겟 44px · 기존 파일 스타일/주석 관례 유지
- **Ask first**: 의존성 추가 · `app/layout.tsx`(루트) 변경 · 라우트 이동/신설 ·
  `admin-menu.ts` IA 변경 · Header.tsx 삭제/대규모 수정
- **Never**: 역할 배열 하드코딩 · DB 스키마 변경 · backend/ 수정 ·
  기존 blue 클래스 일괄 치환(마이그레이션은 Phase 2+에서 화면 단위로) · 테스트 삭제로 통과시키기

## 9. Success Criteria

**Phase 0**
- [ ] `bg-brand-600` 등 토큰 유틸리티가 빌드에서 동작 (샘플 사용처 1곳 이상)
- [ ] StatusPill/ProgressBar/StatCard 테스트 통과, ProgressBar 90% 임계값·aria 검증 포함
- [ ] 기존 화면 시각 변화 없음 (토큰 추가만으로는 아무 화면도 안 바뀜)

**Phase 1**
- [ ] admin 전 페이지가 딥그린 사이드바로 렌더링되고 메뉴 항목·권한 필터링이 이전과 동일
     (역할별 노출 항목 비교로 확인)
- [ ] 모바일 드로어(오버레이·ESC·페이지 이동 시 닫힘) 동작 유지
- [ ] 탑바에 `getFiscalYear()` 기반 "YYYY 회계연도" 표시
- [ ] `pnpm vitest run` 전체 통과 + `pnpm run build` 성공
- [ ] 전역 페이지(비 admin)는 기존 Header 그대로 (회귀 없음)

## 10. Open Questions

- 없음 — 상위 문서 11절에서 모두 확정. 구현 중 발견 사항은 본 스펙에 추기.
