import { defineConfig } from 'prisma/config';

// Prisma 7 설정 파일
// CLI 명령어 (migrate, db push, introspect 등)에서 사용하는 설정

export default defineConfig({
  // 스키마 파일 경로
  schema: 'prisma/schema.prisma',

  // 마이그레이션 파일 경로
  migrations: {
    path: 'prisma/migrations',
  },

  // 데이터베이스 연결 URL
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
