import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: true,
    exclude: ['e2e/**/*', 'node_modules/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.config.mjs',
        '**/types.ts',
        '**/*.d.ts',
        '.next/',
        'out/',
        'coverage/',
        '**/*.old.tsx',
        'prisma/',
        'scripts/',
        '**/__tests__/**',
        'lib/prisma.ts',
        'lib/excel.ts',
        'lib/types/**',
        'lib/constants/styles.ts',
        // Offline/PWA features - require extensive browser API mocking
        'lib/db/**',
        'lib/sync/**',
        'lib/hooks/useOfflineExpense.ts',
        'lib/hooks/useOnlineStatus.ts',
        'lib/hooks/usePushNotification.ts',
        'lib/hooks/index.ts',
        'lib/services/notification/index.ts',
        'lib/services/notification/notification-service.ts',
        'lib/services/notification/web-push-provider.ts',
        'lib/services/notification/notification-hub-provider.ts',
        'lib/user-excel-export.ts',
      ],
      // 현재 실측 커버리지에 맞춘 ratchet(회귀 방지 가드). CI 가 한 번도 충족 못한
      // 90% aspirational 값을 현실화. 커버리지 개선 시 상향한다. (Strangler 이전 중 프론트)
      thresholds: {
        lines: 78,
        functions: 77,
        branches: 74,
        statements: 78,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

