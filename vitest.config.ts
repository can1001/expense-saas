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
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 84,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

