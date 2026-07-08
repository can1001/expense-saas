import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { tenantExtension } from './prisma-tenant-extension';

// 전역 PrismaClient 타입 (Hot Reload 시 재사용)
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
  prismaBase: PrismaClient | undefined;
};

// PostgreSQL 어댑터 설정
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/**
 * 기본 PrismaClient 생성 (extension 없음)
 * 테넌트 필터링이 필요 없는 경우 사용
 * - SuperAdmin 관련 작업
 * - Tenant 조회/생성
 * - 시스템 레벨 작업
 */
function createBasePrismaClient() {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

/**
 * 테넌트 필터링이 적용된 PrismaClient 생성
 * 일반적인 API 요청에서 사용
 */
function createPrismaClient() {
  const baseClient = createBasePrismaClient();
  return baseClient.$extends(tenantExtension);
}

// 테넌트 필터링이 적용된 클라이언트 (기본)
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// 테넌트 필터링이 없는 베이스 클라이언트 (관리자/시스템용)
export const prismaBase = globalForPrisma.prismaBase ?? createBasePrismaClient();

export { Prisma };

// 개발 환경에서 Hot Reload 시 클라이언트 재사용
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaBase = prismaBase;
}

// 타입 export
export type PrismaClientWithTenant = typeof prisma;
export type PrismaClientBase = typeof prismaBase;
