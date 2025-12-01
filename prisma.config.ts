import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  migrations: {
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} ./prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
