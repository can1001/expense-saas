import { z } from 'zod';

// 조직 유형 enum
export const orgTypeSchema = z.enum(['CHURCH', 'NONPROFIT', 'SCHOOL', 'COMPANY', 'OTHER']);
export type OrgType = z.infer<typeof orgTypeSchema>;

// 요금제 유형 enum
export const planTypeSchema = z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']);
export type PlanType = z.infer<typeof planTypeSchema>;

// subdomain 유효성 검사
const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const reservedSubdomains = ['www', 'app', 'api', 'admin', 'static', 'mail', 'ftp', 'dev', 'staging', 'test'];

// 테넌트 생성 스키마
export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, '조직명은 최소 2자 이상이어야 합니다')
    .max(100, '조직명은 최대 100자까지 가능합니다'),

  subdomain: z
    .string()
    .min(3, '서브도메인은 최소 3자 이상이어야 합니다')
    .max(63, '서브도메인은 최대 63자까지 가능합니다')
    .regex(subdomainRegex, '서브도메인은 영문 소문자, 숫자, 하이픈만 사용 가능합니다')
    .refine(
      (val) => !reservedSubdomains.includes(val),
      '예약된 서브도메인은 사용할 수 없습니다'
    ),

  customDomain: z
    .string()
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z]{2,})+$/, '올바른 도메인 형식이 아닙니다')
    .optional()
    .nullable(),

  orgType: orgTypeSchema.default('CHURCH'),

  description: z.string().max(500).optional().nullable(),

  logoUrl: z.string().url('올바른 URL 형식이 아닙니다').optional().nullable(),

  plan: planTypeSchema.default('FREE'),

  // 관리자 계정 정보 (테넌트 생성 시 함께 생성)
  adminEmail: z.string().email('올바른 이메일 형식이 아닙니다').optional(),
  adminName: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').optional(),
  adminPassword: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

// 테넌트 수정 스키마
export const updateTenantSchema = z.object({
  name: z
    .string()
    .min(2, '조직명은 최소 2자 이상이어야 합니다')
    .max(100, '조직명은 최대 100자까지 가능합니다')
    .optional(),

  customDomain: z
    .string()
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z]{2,})+$/, '올바른 도메인 형식이 아닙니다')
    .optional()
    .nullable(),

  orgType: orgTypeSchema.optional(),

  description: z.string().max(500).optional().nullable(),

  logoUrl: z.string().url('올바른 URL 형식이 아닙니다').optional().nullable(),

  plan: planTypeSchema.optional(),

  maxUsers: z.number().int().min(1).optional(),
  maxStorageMB: z.number().int().min(100).optional(),

  isActive: z.boolean().optional(),

  suspendReason: z.string().max(500).optional().nullable(),

  settings: z.record(z.unknown()).optional().nullable(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// 테넌트 목록 조회 파라미터
export const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  plan: planTypeSchema.optional(),
  orgType: orgTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'name', 'subdomain', 'currentUsers', 'plan']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;

// 요금제별 기본 제한
export const planLimits: Record<PlanType, { maxUsers: number; maxStorageMB: number }> = {
  FREE: { maxUsers: 10, maxStorageMB: 1024 }, // 1GB
  BASIC: { maxUsers: 50, maxStorageMB: 10240 }, // 10GB
  PRO: { maxUsers: 200, maxStorageMB: 51200 }, // 50GB
  ENTERPRISE: { maxUsers: 999999, maxStorageMB: 999999999 }, // 무제한
};
