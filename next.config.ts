import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development", // 개발 모드에서는 비활성화
  // 커스텀 Service Worker 소스 (백그라운드 동기화, 푸시 알림)
  customWorkerSrc: "worker",
  // 오프라인 폴백 페이지
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1년
          },
        },
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-font-assets",
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 1주일
          },
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-image-assets",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60, // 24시간
          },
        },
      },
      {
        urlPattern: /\/_next\/static.+\.js$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static-js-assets",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24시간
          },
        },
      },
      {
        urlPattern: /\.(?:css|less)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-style-assets",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24시간
          },
        },
      },
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-data",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24시간
          },
        },
      },
      {
        urlPattern: /\/api\/.*$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "apis",
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 24 * 60 * 60, // 24시간
          },
          networkTimeoutSeconds: 10, // 10초 후 캐시 사용
        },
      },
      {
        urlPattern: /.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "others",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24시간
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  // Turbopack 설정 (개발 모드용) - webpack과 공존 허용
  turbopack: {},
  // Python(FastAPI) 백엔드 점진 이전용 프록시 (spec_python_refactoring.md §7)
  //   /api/py/*  →  <API_ORIGIN>/api/*
  // 이전 완료된 도메인만 이 경로로 호출하고, 미이전 도메인은 기존 /api/* (Next.js)를 쓴다.
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:8000";
    // Expense id 는 cuid(v1)/cuid2 — 20자 이상 소문자 영숫자라서 bulk, export
    // 등 미이관 고정 세그먼트(짧거나 하이픈 포함)와 구분된다.
    const cuid = "[a-z0-9]{20,}";
    // 컷오버 rewrite 는 API_ORIGIN 이 명시된 환경에서만 활성화한다.
    // 미설정 배포(env 추가 전 Render 등)에서 프록시가 localhost 로 향해
    // 전 도메인이 깨지는 사고 방지 — 미설정 시 기존 Next 라우트가 그대로 처리.
    if (!process.env.API_ORIGIN) {
      return {
        beforeFiles: [],
        afterFiles: [{ source: "/api/py/:path*", destination: `${apiOrigin}/api/:path*` }],
      };
    }
    return {
      // 컷오버 완료 도메인: 동일한 /api/* 경로를 FastAPI 가 처리.
      // beforeFiles 라서 남아있는 Next 라우트 파일보다 우선한다 (롤백 = 해당 항목 제거).
      beforeFiles: [
        { source: "/api/auth/login", destination: `${apiOrigin}/api/auth/login` },
        { source: "/api/auth/logout", destination: `${apiOrigin}/api/auth/logout` },
        { source: "/api/auth/me", destination: `${apiOrigin}/api/auth/me` },
        { source: "/api/auth/signup", destination: `${apiOrigin}/api/auth/signup` },
        {
          source: "/api/auth/change-password",
          destination: `${apiOrigin}/api/auth/change-password`,
        },
        {
          source: "/api/auth/switch-tenant",
          destination: `${apiOrigin}/api/auth/switch-tenant`,
        },
        {
          source: "/api/auth/accept-invitation",
          destination: `${apiOrigin}/api/auth/accept-invitation`,
        },
        { source: "/api/auth/kakao", destination: `${apiOrigin}/api/auth/kakao` },
        {
          source: "/api/auth/link-kakao",
          destination: `${apiOrigin}/api/auth/link-kakao`,
        },
        { source: "/api/expenses", destination: `${apiOrigin}/api/expenses` },
        {
          source: "/api/expenses/filter-options",
          destination: `${apiOrigin}/api/expenses/filter-options`,
        },
        { source: "/api/expenses/bulk", destination: `${apiOrigin}/api/expenses/bulk` },
        {
          source: "/api/expenses/bulk-expense-date",
          destination: `${apiOrigin}/api/expenses/bulk-expense-date`,
        },
        {
          source: "/api/expenses/bulk-payment-status",
          destination: `${apiOrigin}/api/expenses/bulk-payment-status`,
        },
        // expenses Excel 계열 (C3) — 고정 세그먼트, :id(cuid) 보다 먼저 매칭되어야 함
        {
          source: "/api/expenses/export/excel",
          destination: `${apiOrigin}/api/expenses/export/excel`,
        },
        {
          source: "/api/expenses/bulk-upload",
          destination: `${apiOrigin}/api/expenses/bulk-upload`,
        },
        {
          source: "/api/expenses/bulk-upload-template",
          destination: `${apiOrigin}/api/expenses/bulk-upload-template`,
        },
        {
          source: `/api/expenses/:id(${cuid})`,
          destination: `${apiOrigin}/api/expenses/:id`,
        },
        {
          source: `/api/expenses/:id(${cuid})/:action(submit|approve|reject|resubmit|withdraw|delegate|approval-line|approval|fix-status|payment-status|duplicate)`,
          destination: `${apiOrigin}/api/expenses/:id/:action`,
        },
        {
          source: `/api/expenses/:id(${cuid})/attachments`,
          destination: `${apiOrigin}/api/expenses/:id/attachments`,
        },
        {
          source: `/api/expenses/:id(${cuid})/attachments/:attachmentId(${cuid})`,
          destination: `${apiOrigin}/api/expenses/:id/attachments/:attachmentId`,
        },
        // upload: Cloudinary 업로드/삭제 ("upload" 는 6자로 cuid 패턴과 충돌하지 않음)
        { source: "/api/upload", destination: `${apiOrigin}/api/upload` },
        { source: "/api/upload/delete", destination: `${apiOrigin}/api/upload/delete` },
        // budget: 조회 계열 + upload(C2) 이관
        { source: "/api/budget", destination: `${apiOrigin}/api/budget` },
        { source: "/api/budget/hierarchy", destination: `${apiOrigin}/api/budget/hierarchy` },
        {
          source: "/api/budget/hierarchy/export",
          destination: `${apiOrigin}/api/budget/hierarchy/export`,
        },
        { source: "/api/budget/upload", destination: `${apiOrigin}/api/budget/upload` },
        { source: "/api/budget/search", destination: `${apiOrigin}/api/budget/search` },
        { source: "/api/budget/simple", destination: `${apiOrigin}/api/budget/simple` },
        {
          source: "/api/budget/simple/all-details",
          destination: `${apiOrigin}/api/budget/simple/all-details`,
        },
        {
          source: "/api/budget/usage-details",
          destination: `${apiOrigin}/api/budget/usage-details`,
        },
        {
          source: "/api/budget/memo-examples",
          destination: `${apiOrigin}/api/budget/memo-examples`,
        },
        // 예산 마스터
        { source: "/api/committees", destination: `${apiOrigin}/api/committees` },
        {
          source: `/api/committees/:id(${cuid})`,
          destination: `${apiOrigin}/api/committees/:id`,
        },
        { source: "/api/departments", destination: `${apiOrigin}/api/departments` },
        // leaders-upload: 고정 세그먼트(하이픈 포함) — :id(cuid) 와 충돌 없음
        {
          source: "/api/departments/leaders-upload",
          destination: `${apiOrigin}/api/departments/leaders-upload`,
        },
        {
          source: `/api/departments/:id(${cuid})`,
          destination: `${apiOrigin}/api/departments/:id`,
        },
        { source: "/api/budget-categories", destination: `${apiOrigin}/api/budget-categories` },
        {
          source: `/api/budget-categories/:id(${cuid})`,
          destination: `${apiOrigin}/api/budget-categories/:id`,
        },
        {
          source: "/api/budget-subcategories",
          destination: `${apiOrigin}/api/budget-subcategories`,
        },
        {
          source: `/api/budget-subcategories/:id(${cuid})`,
          destination: `${apiOrigin}/api/budget-subcategories/:id`,
        },
        { source: "/api/budget-details", destination: `${apiOrigin}/api/budget-details` },
        // year/year auto-assign: 고정 세그먼트("year" 4자) — :id(cuid) 와 충돌 없음
        {
          source: "/api/budget-details/year",
          destination: `${apiOrigin}/api/budget-details/year`,
        },
        {
          source: "/api/budget-details/year/auto-assign",
          destination: `${apiOrigin}/api/budget-details/year/auto-assign`,
        },
        {
          source: `/api/budget-details/:id(${cuid})`,
          destination: `${apiOrigin}/api/budget-details/:id`,
        },
        {
          source: `/api/budget-details/:id(${cuid})/description`,
          destination: `${apiOrigin}/api/budget-details/:id/description`,
        },
        // 결재 목록·결재선 계산 (calculate 의 Next GET 은 앱에서 미사용 — POST 만 쓴다)
        { source: "/api/approvals", destination: `${apiOrigin}/api/approvals` },
        {
          source: "/api/approvals/pending-count",
          destination: `${apiOrigin}/api/approvals/pending-count`,
        },
        {
          source: "/api/approval-line/calculate",
          destination: `${apiOrigin}/api/approval-line/calculate`,
        },
        { source: "/api/approval-policies", destination: `${apiOrigin}/api/approval-policies` },
        { source: "/api/tenant/info", destination: `${apiOrigin}/api/tenant/info` },
        // me: 서버 주도 설정(labels/features/branding) + 소속 조직 목록
        { source: "/api/me/config", destination: `${apiOrigin}/api/me/config` },
        { source: "/api/me/memberships", destination: `${apiOrigin}/api/me/memberships` },
        // users: 목록·생성·상세·수정·비활성화 + by-role/quick-register/year-roles 이관.
        // me/upload 등 남은 고정 세그먼트(짧거나 하이픈 포함)는 cuid 패턴과 충돌하지 않는다.
        { source: "/api/users", destination: `${apiOrigin}/api/users` },
        {
          source: "/api/users/by-role/:role",
          destination: `${apiOrigin}/api/users/by-role/:role`,
        },
        {
          source: "/api/users/quick-register",
          destination: `${apiOrigin}/api/users/quick-register`,
        },
        {
          source: "/api/users/year-roles",
          destination: `${apiOrigin}/api/users/year-roles`,
        },
        {
          source: "/api/users/upload",
          destination: `${apiOrigin}/api/users/upload`,
        },
        {
          source: `/api/users/:id(${cuid})`,
          destination: `${apiOrigin}/api/users/:id`,
        },
        // users/me/signatures: 서명·도장 관리 (본인 것만 조작 가능, "me" 는 cuid 패턴과 충돌 없음)
        { source: "/api/users/me/signatures", destination: `${apiOrigin}/api/users/me/signatures` },
        {
          source: `/api/users/me/signatures/:id(${cuid})`,
          destination: `${apiOrigin}/api/users/me/signatures/:id`,
        },
        {
          source: `/api/users/me/signatures/:id(${cuid})/default`,
          destination: `${apiOrigin}/api/users/me/signatures/:id/default`,
        },
        // simple-expenses: 간편 지출결의서 (Expense version="4.1.4") 목록/생성/상세/수정/삭제
        { source: "/api/simple-expenses", destination: `${apiOrigin}/api/simple-expenses` },
        {
          source: `/api/simple-expenses/:id(${cuid})`,
          destination: `${apiOrigin}/api/simple-expenses/:id`,
        },
        // expense-templates / bank-accounts: 본인 소유 리소스 목록·CRUD (B5)
        { source: "/api/expense-templates", destination: `${apiOrigin}/api/expense-templates` },
        {
          source: `/api/expense-templates/:id(${cuid})`,
          destination: `${apiOrigin}/api/expense-templates/:id`,
        },
        { source: "/api/bank-accounts", destination: `${apiOrigin}/api/bank-accounts` },
        {
          source: `/api/bank-accounts/:id(${cuid})`,
          destination: `${apiOrigin}/api/bank-accounts/:id`,
        },
        // recurring-expenses: 자동이체 목록/생성/상세/수정/취소 + 수동 생성 + 크론 처리 (B6)
        // "process" 는 7자 고정 세그먼트라 cuid(20자 이상) 패턴과 충돌하지 않는다.
        {
          source: "/api/recurring-expenses",
          destination: `${apiOrigin}/api/recurring-expenses`,
        },
        {
          source: "/api/recurring-expenses/process",
          destination: `${apiOrigin}/api/recurring-expenses/process`,
        },
        {
          source: `/api/recurring-expenses/:id(${cuid})`,
          destination: `${apiOrigin}/api/recurring-expenses/:id`,
        },
        {
          source: `/api/recurring-expenses/:id(${cuid})/generate`,
          destination: `${apiOrigin}/api/recurring-expenses/:id/generate`,
        },
        // settings: 시스템 설정 조회/저장 (관리자 전용 PUT)
        { source: "/api/settings", destination: `${apiOrigin}/api/settings` },
      ],
      afterFiles: [
        {
          source: "/api/py/:path*",
          destination: `${apiOrigin}/api/:path*`,
        },
      ],
    };
  },
};

export default withPWA(nextConfig);
