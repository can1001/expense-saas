import { defineConfig, devices } from '@playwright/test';

// E2E 전용 로컬 테스트 DB — 라이브 DB(.env의 DATABASE_URL)와 분리
// 셋업: createdb expense_e2e && prisma db push --url $E2E_DATABASE_URL
//       && db:seed:users && db:seed && db:seed:e2e (모두 DATABASE_URL 오버라이드로 실행)
// CI 에서는 워크플로우가 주입한 DATABASE_URL(서비스 컨테이너의 테스트 DB)을 그대로 쓴다
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  (process.env.CI
    ? (process.env.DATABASE_URL ?? '')
    : 'postgresql://wandosea@localhost:5432/expense_e2e');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3002',
    // 라이브 DB를 바라보는 기존 dev 서버를 재사용하면 안 되므로 항상 새로 띄운다
    // (3002 포트가 사용 중이면 명시적으로 실패)
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
    },
  },
});
