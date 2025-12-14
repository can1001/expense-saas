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
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
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

