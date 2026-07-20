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
    // Expense id 는 cuid(v1)/cuid2 — 20자 이상 소문자 영숫자라서 bulk, export,
    // filter-options 등 미이관 고정 세그먼트(짧거나 하이픈 포함)와 구분된다.
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
        { source: "/api/expenses", destination: `${apiOrigin}/api/expenses` },
        {
          source: `/api/expenses/:id(${cuid})`,
          destination: `${apiOrigin}/api/expenses/:id`,
        },
        {
          source: `/api/expenses/:id(${cuid})/:action(submit|approve|reject|resubmit|withdraw|delegate|approval-line|approval)`,
          destination: `${apiOrigin}/api/expenses/:id/:action`,
        },
        // budget: 조회 계열 이관 — upload, hierarchy/export(Excel)만 Next 유지
        { source: "/api/budget", destination: `${apiOrigin}/api/budget` },
        { source: "/api/budget/hierarchy", destination: `${apiOrigin}/api/budget/hierarchy` },
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
        {
          source: `/api/budget-details/:id(${cuid})`,
          destination: `${apiOrigin}/api/budget-details/:id`,
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
          source: `/api/users/:id(${cuid})`,
          destination: `${apiOrigin}/api/users/:id`,
        },
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
