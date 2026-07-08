import { prismaBase, Prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export type ActivityAction =
  | 'CREATE_TENANT'
  | 'UPDATE_TENANT'
  | 'DELETE_TENANT'
  | 'SUSPEND_TENANT'
  | 'ACTIVATE_TENANT'
  | 'UPDATE_TENANT_SETTINGS'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'ACTIVATE_USER'
  | 'DEACTIVATE_USER'
  | 'VIEW_TENANT'
  | 'VIEW_STATS'
  | 'EXPORT_DATA';

export type EntityType = 'tenant' | 'user' | 'settings' | 'stats' | 'export';

interface LogActivityParams {
  superAdminId: string;
  superAdminEmail: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId?: string;
  tenantId?: string;
  tenantName?: string;
  details?: Record<string, unknown>;
}

/**
 * 플랫폼 관리 활동을 로그에 기록합니다.
 */
export async function logPlatformActivity(params: LogActivityParams) {
  try {
    const headersList = await headers();
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      'unknown';
    const userAgent = headersList.get('user-agent') || undefined;

    await prismaBase.platformActivityLog.create({
      data: {
        superAdminId: params.superAdminId,
        superAdminEmail: params.superAdminEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        tenantId: params.tenantId,
        tenantName: params.tenantName,
        details: params.details as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // 로그 기록 실패는 메인 작업에 영향을 주지 않도록 함
    console.error('Failed to log platform activity:', error);
  }
}

/**
 * 활동 액션의 한글 설명을 반환합니다.
 */
export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE_TENANT: '테넌트 생성',
    UPDATE_TENANT: '테넌트 수정',
    DELETE_TENANT: '테넌트 삭제',
    SUSPEND_TENANT: '테넌트 일시중지',
    ACTIVATE_TENANT: '테넌트 활성화',
    UPDATE_TENANT_SETTINGS: '테넌트 설정 변경',
    CREATE_USER: '사용자 생성',
    UPDATE_USER: '사용자 수정',
    DELETE_USER: '사용자 삭제',
    ACTIVATE_USER: '사용자 활성화',
    DEACTIVATE_USER: '사용자 비활성화',
    VIEW_TENANT: '테넌트 조회',
    VIEW_STATS: '통계 조회',
    EXPORT_DATA: '데이터 내보내기',
  };
  return labels[action] || action;
}

/**
 * 엔티티 타입의 한글 설명을 반환합니다.
 */
export function getEntityTypeLabel(entityType: string): string {
  const labels: Record<string, string> = {
    tenant: '테넌트',
    user: '사용자',
    settings: '설정',
    stats: '통계',
    export: '내보내기',
  };
  return labels[entityType] || entityType;
}
