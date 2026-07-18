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
  'accountCategory', // 테넌트별 계정과목(ARC-001) — 조회/쓰기 시 tenantId 자동 스코프 강제

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

// 테스트를 위해 export
export { TENANT_SCOPED_MODELS };
export type { TenantScopedModel };

// 대소문자 무관 비교를 위해 소문자로 정규화된 Set (O(1) 룩업)
const TENANT_SCOPED_MODELS_SET = new Set(
  TENANT_SCOPED_MODELS.map((m) => m.toLowerCase())
);

/**
 * 모델이 테넌트 스코프인지 확인
 * Prisma는 모델명을 PascalCase로 전달하므로 대소문자 무관하게 비교
 * Set.has()를 사용하여 O(1) 성능 보장
 */
export function isTenantScopedModel(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS_SET.has(model.toLowerCase());
}

/**
 * where 절에 tenantId 조건 추가
 * Object.create(null)로 프로토타입 오염 방지
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addTenantFilter(where: any, tenantId: string): any {
  // 프로토타입 오염 방지: null 프로토타입 객체 사용
  const safeWhere = where && typeof where === 'object' ? where : {};
  return Object.assign(Object.create(null), safeWhere, { tenantId });
}

/**
 * data에 tenantId 추가 (중첩 생성/수정 포함)
 * Prisma nested writes 패턴 지원:
 * - { items: { create: [...] } }
 * - { items: { createMany: { data: [...] } } }
 * - { items: { connectOrCreate: { where, create } } }
 * - { items: { update: { where, data } } }
 * - { items: { upsert: { where, create, update } } }
 * - { items: { updateMany: { where, data } } }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addTenantToData(data: any, tenantId: string): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => addTenantToData(item, tenantId));
  }

  if (typeof data !== 'object') {
    return data;
  }

  // 최상위 객체에 tenantId 추가
  const result = { ...data, tenantId };

  // 중첩 관계 처리
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // 수정된 nested operations을 누적할 객체
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modifiedValue: Record<string, any> = { ...value };

      // create 중첩 처리
      if (value.create !== undefined) {
        modifiedValue.create = addTenantToData(value.create, tenantId);
      }
      // createMany 중첩 처리
      if (value.createMany?.data !== undefined) {
        modifiedValue.createMany = {
          ...value.createMany,
          data: addTenantToData(value.createMany.data, tenantId),
        };
      }
      // connectOrCreate 중첩 처리 (where와 create 모두에 tenantId 적용)
      if (value.connectOrCreate !== undefined) {
        const connectOrCreate = value.connectOrCreate;
        if (Array.isArray(connectOrCreate)) {
          modifiedValue.connectOrCreate = connectOrCreate.map(
            (item: { where: unknown; create: unknown }) => ({
              ...item,
              where: addTenantFilter(item.where, tenantId),
              create: addTenantToData(item.create, tenantId),
            })
          );
        } else {
          modifiedValue.connectOrCreate = {
            ...connectOrCreate,
            where: addTenantFilter(connectOrCreate.where, tenantId),
            create: addTenantToData(connectOrCreate.create, tenantId),
          };
        }
      }
      // update 중첩 처리 (where와 data 모두에 tenantId 적용)
      if (value.update !== undefined) {
        const update = value.update;
        if (Array.isArray(update)) {
          modifiedValue.update = update.map(
            (item: { where: unknown; data: unknown }) => ({
              ...item,
              where: addTenantFilter(item.where, tenantId),
              data: addTenantToData(item.data, tenantId),
            })
          );
        } else if (update.where !== undefined && update.data !== undefined) {
          modifiedValue.update = {
            ...update,
            where: addTenantFilter(update.where, tenantId),
            data: addTenantToData(update.data, tenantId),
          };
        }
      }
      // upsert 중첩 처리 (where, create, update 모두에 tenantId 적용)
      if (value.upsert !== undefined) {
        const upsert = value.upsert;
        if (Array.isArray(upsert)) {
          modifiedValue.upsert = upsert.map(
            (item: { where: unknown; create: unknown; update: unknown }) => ({
              ...item,
              where: addTenantFilter(item.where, tenantId),
              create: addTenantToData(item.create, tenantId),
              update: addTenantToData(item.update, tenantId),
            })
          );
        } else {
          modifiedValue.upsert = {
            ...upsert,
            where: addTenantFilter(upsert.where, tenantId),
            create: addTenantToData(upsert.create, tenantId),
            update: addTenantToData(upsert.update, tenantId),
          };
        }
      }
      // updateMany 중첩 처리 (where와 data에 tenantId 적용)
      if (value.updateMany !== undefined) {
        const updateMany = value.updateMany;
        if (Array.isArray(updateMany)) {
          modifiedValue.updateMany = updateMany.map(
            (item: { where: unknown; data: unknown }) => ({
              ...item,
              where: addTenantFilter(item.where, tenantId),
              data: addTenantToData(item.data, tenantId),
            })
          );
        } else {
          modifiedValue.updateMany = {
            ...updateMany,
            where: addTenantFilter(updateMany.where, tenantId),
            data: addTenantToData(updateMany.data, tenantId),
          };
        }
      }
      // deleteMany 중첩 처리 (where에 tenantId 적용)
      if (value.deleteMany !== undefined) {
        const deleteMany = value.deleteMany;
        if (Array.isArray(deleteMany)) {
          modifiedValue.deleteMany = deleteMany.map((item: unknown) =>
            addTenantFilter(item, tenantId)
          );
        } else if (
          deleteMany &&
          typeof deleteMany === 'object' &&
          !Array.isArray(deleteMany)
        ) {
          modifiedValue.deleteMany = addTenantFilter(deleteMany, tenantId);
        }
      }
      // delete 단일 중첩 처리 (where에 tenantId 적용)
      if (value.delete !== undefined) {
        const del = value.delete;
        if (Array.isArray(del)) {
          modifiedValue.delete = del.map((item: unknown) =>
            addTenantFilter(item, tenantId)
          );
        } else if (del && typeof del === 'object' && !Array.isArray(del)) {
          modifiedValue.delete = addTenantFilter(del, tenantId);
        }
      }
      // connect 중첩 처리 (where에 tenantId 적용하여 크로스 테넌트 연결 방지)
      if (value.connect !== undefined) {
        const connect = value.connect;
        if (Array.isArray(connect)) {
          modifiedValue.connect = connect.map((item: unknown) =>
            addTenantFilter(item, tenantId)
          );
        } else if (
          connect &&
          typeof connect === 'object' &&
          !Array.isArray(connect)
        ) {
          modifiedValue.connect = addTenantFilter(connect, tenantId);
        }
      }
      // disconnect 중첩 처리 (where에 tenantId 적용)
      if (value.disconnect !== undefined) {
        const disconnect = value.disconnect;
        // disconnect: true인 경우는 수정하지 않음 (모든 연결 해제)
        if (Array.isArray(disconnect)) {
          modifiedValue.disconnect = disconnect.map((item: unknown) =>
            addTenantFilter(item, tenantId)
          );
        } else if (
          disconnect &&
          typeof disconnect === 'object' &&
          !Array.isArray(disconnect)
        ) {
          modifiedValue.disconnect = addTenantFilter(disconnect, tenantId);
        }
        // disconnect: true는 그대로 유지 (boolean이므로 위 조건에 해당 안 함)
      }
      // set 중첩 처리 (관계 전체 교체 시 tenantId 적용)
      if (value.set !== undefined) {
        const set = value.set;
        if (Array.isArray(set)) {
          modifiedValue.set = set.map((item: unknown) =>
            addTenantFilter(item, tenantId)
          );
        } else if (set && typeof set === 'object' && !Array.isArray(set)) {
          modifiedValue.set = addTenantFilter(set, tenantId);
        }
      }

      // 누적된 수정 사항을 result에 반영
      result[key] = modifiedValue;
    }
  }

  return result;
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

        // 사전 필터링: where 절에 tenantId 추가하여 타이밍 공격 방지
        // Prisma findUnique는 compound unique가 아니어도 추가 필드를 where에 허용
        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        return query(newArgs);
      },

      async findUniqueOrThrow({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // 사전 필터링: where 절에 tenantId 추가
        // 다른 테넌트의 레코드는 찾지 못하므로 Prisma가 자동으로 에러 발생
        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        return query(newArgs);
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

      // 수정 작업에 tenantId 필터 추가 (사전 검증으로 TOCTOU 방지)
      async update({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // TOCTOU 방지: where 절에 tenantId를 추가하여 사전 필터링
        // 다른 테넌트의 레코드는 찾지 못하므로 수정 불가
        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        return query(newArgs);
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

      // upsert 작업에 tenantId 필터 추가 (TOCTOU 방지)
      async upsert({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // where, create, update 모두에 tenantId 적용
        // where: 다른 테넌트 레코드 찾기 방지
        // create: 새 레코드에 tenantId 설정
        // update: 업데이트 데이터에 tenantId 유지 (변조 방지)
        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
          create: addTenantToData(args.create, tenantId),
          update: addTenantToData(args.update, tenantId),
        };

        return query(newArgs);
      },

      // 삭제 작업에 tenantId 필터 추가 (사전 검증으로 TOCTOU 방지)
      async delete({ model, args, query }) {
        const tenantId = getTenantIdOptional();

        if (!tenantId || !isTenantScopedModel(model)) {
          return query(args);
        }

        // TOCTOU 방지: where 절에 tenantId를 추가하여 사전 필터링
        // 다른 테넌트의 레코드는 찾지 못하므로 삭제 불가
        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        return query(newArgs);
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
