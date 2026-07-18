# 구현 태스크: 디자인 토큰 + AppShell (Phase 0·1)

> 스펙: `docs/SPEC_DESIGN_TOKENS_APPSHELL_2026-07-18.md` (승인됨)
> 원칙: 각 태스크 종료 시 시스템은 동작 상태 유지. 체크포인트에서 `pnpm vitest run` + `pnpm run build`.

## Phase 0 — 토큰·기초 컴포넌트

- [x] **T1 (S)**: `@theme` 토큰 + `getFiscalYear()`
  - 파일: `app/globals.css`, `lib/utils/fiscal-year.ts`, `lib/utils/__tests__/fiscal-year.test.ts`
  - 수용: `bg-brand-600` 등 유틸리티 생성, 기존 화면 시각 변화 없음
- [x] **T2 (S)**: `StatusPill` + `ProgressBar` + 테스트
  - 파일: `components/ui/StatusPill.tsx`, `components/ui/ProgressBar.tsx`, `components/ui/__tests__/*`
  - 수용: variant 매핑, 90% 임계값(89/90/91) 전환, `role="progressbar"` + aria
- [x] **T3 (S)**: `StatCard` + 테스트
  - 파일: `components/ui/StatCard.tsx`, `components/ui/__tests__/StatCard.test.tsx`
  - 수용: icon/label/value/sub 렌더링, 숫자 tabular-nums

### 체크포인트 A: `pnpm vitest run` 전체 통과 + `pnpm run build` 성공

## Phase 1 — 공용 Sidebar·AppShell (admin 우선 적용)

- [x] **T4 (M)**: 공용 `Sidebar` (config 주입형, 딥그린) + 테스트
  - 파일: `components/layout/Sidebar.tsx`, `components/layout/__tests__/Sidebar.test.tsx`
  - 수용: 그룹/뱃지/백링크 렌더링, 활성 하이라이트(`/admin` 정확일치·하위경로), 드로어 ESC·오버레이
- [x] **T5 (S)**: `AdminSidebar` → 공용 Sidebar 위임 (의존: T4)
  - 파일: `components/admin/AdminSidebar.tsx`
  - 수용: 역할 fetch·권한 필터·메뉴 IA 동일, 렌더링만 교체
- [x] **T6 (M)**: `AppShell` + `AdminLayout` 전환 (의존: T4, T1)
  - 파일: `components/layout/AppShell.tsx`, `components/admin/AdminLayout.tsx`
  - 수용: 탑바(타이틀·"YYYY 회계연도"·액션 슬롯), admin 전 페이지 딥그린 적용
- [x] **T7 (S)**: `global-menu.ts` (Phase 2 대비 config만) + 최종 검증
  - 파일: `lib/constants/global-menu.ts`
  - 수용: permission 파생 함수만 사용, 미사용 상태로 빌드 통과

### 체크포인트 B (완료 조건): vitest 전체 통과 · build 성공 · lint 통과 ·
admin 역할별 메뉴 노출 이전과 동일 · 전역 페이지 Header 회귀 없음

## 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| Tailwind 4 @theme 토큰이 빌드에서 미생성 | 중 | T1에서 샘플 사용처로 즉시 검증 |
| AdminLayout에 숨은 결합(모바일 토글 등) | 중 | T6 착수 전 AdminLayout 정독, 동작 이식 |
| admin 페이지들이 개별 헤더를 그림 | 저 | Phase 1은 사이드바/레이아웃만, 페이지 내부 미수정 |
