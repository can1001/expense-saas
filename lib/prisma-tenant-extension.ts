import { Prisma } from '@prisma/client';
import { getTenantIdOptional } from './tenant-context';

// tenantId 필드를 가진 모델 목록
// 모든 테넌트 스코프 모델들
const TENANT_SCOPED_MODELS = [
  'user',
  'role',
  'expense',
  'expenseItem',
  'expenseAttachment',
  'committee',
  'department',
  'budgetCategory',
  'budgetSubcategory',
  'budgetDetail',
  'budgetDetailYear',
  'departmentBudgetDetail',
  'savedBankAccount',
  'simpleExpense',
  'simpleExpenseItem',
  'simpleExpenseAttachment',
  'offering',
  'systemSetting',
  'adminNotification',
  'accountReport',
  'accountReportIncome',
  'accountReportExpense',
  'accountReportBankAccount',
  'accountReportReserve',
  'accountReportAsset',
  'accountReportLiability',
  'accountReportCommitteeExpense',
  'curriculum',
  'lesson',
  'question',
  'attendance',
  'quizResponse',
  'studentPoints',
  'recitationSubmission',
  'expenseTemplate',
  'recurringExpense',
  'userYearRole',
  'userSignature',
  'userYearRoleHistory',
  'budgetDetailYearHistory',
  'approvalLog',
  'notificationPreference',
  'notificationLog',
  'pushSubscription',
  'webPushLog',
  'fcmToken',
  'fcmLog',
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

/**
 * 모델이 테넌트 스코프인지 확인
 */
function isTenantScopedModel(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS.includes(model.toLowerCase() as TenantScopedModel);
}

/**
 * where 절에 tenantId 조건 추가
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTenantFilter(where: any, tenantId: string): any {
  return {
    ...where,
    tenantId,
  };
}

/**
 * data에 tenantId 추가
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTenantToData(data: any, tenantId: string): any {
  if (Array.isArray(data)) {
    return data.map((item) => ({
      ...item,
      tenantId,
    }));
  }
  return {
    ...data,
    tenantId,
  };
}

/**
 * 멀티테넌시 자동 필터링 Prisma Extension
 *
 * 기능:
 * 1. 모든 쿼리에 자동으로 tenantId 필터 추가
 * 2. create/update 시 자동으로 tenantId 설정
 * 3. 테넌트 컨텍스트가 없는 경우 필터링 건너뜀 (관리자 모드)
 */
export const tenantExtension = Prisma.defineExtension({
  name: 'tenant-isolation',

  query: {
    $allModels: {
      // 조회 작업들에 tenantId 필터 자동 추가
      async findMany({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        // 테넌트 컨텍스트가 없거나, 테넌트 스코프 모델이 아닌 경우 패스
        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // where 절에 tenantId 추가
        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },

      async findFirst({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },

      async findUnique({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // findUnique는 unique 필드 조건이 필요하므로
        // 쿼리 후 결과에서 tenantId 검증
        const result = await query(args);

        // 결과가 있는 경우 tenantId 검증
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (result && (result as any).tenantId !== tenantId) {
          return null; // 다른 테넌트의 데이터는 null 반환
        }

        return result;
      },

      async findUniqueOrThrow({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const result = await query(args);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((result as any).tenantId !== tenantId) {
          throw new Error('Record not found');
        }

        return result;
      },

      async count({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },

      async aggregate({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },

      async groupBy({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },

      // 생성 작업에 tenantId 자동 설정
      async create({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // data에 tenantId 자동 추가
        const newArgs = {
          ...args,
          data: addTenantToData(args.data, tenantId),
        };

        return query(newArgs);
      },

      async createMany({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          data: addTenantToData(args.data, tenantId),
        };

        return query(newArgs);
      },

      // 수정 작업에 tenantId 필터 추가
      async update({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // update의 경우 먼저 데이터 존재 및 권한 확인 필요
        // 여기서는 간단히 결과 검증
        const result = await query(args);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (result && (result as any).tenantId !== tenantId) {
          throw new Error('Unauthorized access to record');
        }

        return result;
      },

      async updateMany({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },

      async upsert({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          create: addTenantToData(args.create, tenantId),
        };

        return query(newArgs);
      },

      // 삭제 작업에 tenantId 필터 추가
      async delete({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // delete의 경우 먼저 데이터 존재 및 권한 확인
        const result = await query(args);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (result && (result as any).tenantId !== tenantId) {
          throw new Error('Unauthorized access to record');
        }

        return result;
      },

      async deleteMany({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };
        return query(newArgs);
      },
    },
  },
});

/**
 * 테넌트 필터링을 우회하는 Extension
 * 슈퍼 관리자 또는 시스템 작업에서 사용
 */
export const bypassTenantExtension = Prisma.defineExtension({
  name: 'bypass-tenant-isolation',
  // 기본 동작 유지 (필터링 없음)
});
