/**
 * RBAC 권한 레지스트리 — 단일 출처(Single Source of Truth)
 *
 * "어떤 권한이 존재하는가"는 이 파일의 PERMISSIONS 카탈로그에서만 정의한다.
 * "역할이 어떤 권한을 갖는가"의 기본값(seed/fallback)은 ROLE_PERMISSION_PRESETS에서 정의하며,
 * 런타임 정본은 DB Role.permissions(테넌트별)이다.
 *
 * 서버 API 가드(lib/auth/user.ts)와 클라이언트 메뉴 노출이 동일한 hasPermission을 사용한다.
 *
 * 참고: spec_rbac_refactoring.md §4.2 ~ §4.4
 */

// ========================================
// 역할 코드 (단일 출처) — 하드코딩된 validRoles/역할배열을 대체
// ========================================

export const ROLE_CODES = [
  'admin',
  'finance_head',
  'accountant',
  'finance_member',
  'team_leader',
  'admin_assistant',
  'user',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}

/**
 * 연도별 역할(UserYearRole)로 지정 가능한 기능 역할 코드.
 * admin/user 는 연도별 역할이 아니므로 제외. (P11: year-roles 검증 단일 출처)
 */
export const YEAR_ROLE_CODES: readonly RoleCode[] = ROLE_CODES.filter(
  (r) => r !== 'admin' && r !== 'user'
);

/**
 * 시스템 내장 역할 — 삭제/비활성화/편집 제한 대상.
 * (역할 관리 UI/API에서 보호)
 */
export const PROTECTED_SYSTEM_ROLE_CODES: readonly RoleCode[] = ['admin', 'user'];

/** 시스템 보호 역할인지 */
export function isProtectedSystemRole(code: string): boolean {
  return (PROTECTED_SYSTEM_ROLE_CODES as readonly string[]).includes(code);
}

/** 역할 한글명 — 단일 출처 (menu-permissions.ts / user-service.ts 중복 제거 대상) */
export const ROLE_NAMES: Record<RoleCode, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  finance_member: '재정팀원',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

// ========================================
// 권한 카탈로그 (resource:action[.scope])
// ========================================

export const PERMISSIONS = {
  // 지출결의서
  EXPENSE_READ_OWN: 'expense:read.own',
  EXPENSE_READ_DEPARTMENT: 'expense:read.department',
  EXPENSE_READ_ALL: 'expense:read.all',
  EXPENSE_CREATE: 'expense:create',
  EXPENSE_APPROVE: 'expense:approve',
  EXPENSE_EDIT_APPROVED: 'expense:edit_approved',
  EXPENSE_PAYMENT_MANAGE: 'expense:payment_manage',
  EXPENSE_BULK_UPLOAD: 'expense:bulk_upload',
  EXPENSE_EXPORT: 'expense:export',
  SIMPLE_EXPENSE_USE: 'simple_expense:use',
  // 자동이체
  RECURRING_READ: 'recurring:read',
  RECURRING_MANAGE_ALL: 'recurring:manage_all',
  // 관리자 대시보드 · 보고서
  ADMIN_DASHBOARD_READ: 'admin:dashboard.read',
  REPORT_BUDGET_EXEC_READ: 'report:budget_execution.read',
  REPORT_HR_ADMIN_READ: 'report:hr_admin.read',
  REPORT_QUARTERLY_READ: 'report:quarterly.read',
  REPORT_CUMULATIVE_READ: 'report:cumulative.read',
  REPORT_FINANCIAL_READ: 'report:financial.read',
  REPORT_EXPORT: 'report:export',
  // 조직/예산 관리
  COMMITTEE_MANAGE: 'committee:manage',
  DEPARTMENT_MANAGE: 'department:manage',
  BUDGET_MANAGER_MANAGE: 'budget_manager:manage',
  BUDGET_MASTER_MANAGE: 'budget_master:manage', // 예산 마스터(항/목/세목 구조) 편집
  BUDGET_VIEW: 'budget:view',
  OFFERING_MANAGE: 'offering:manage',
  // 사용자/역할/설정
  USER_READ: 'user:read',
  USER_REGISTER: 'user:register',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  SETTINGS_MANAGE: 'settings:manage',
  NOTIFICATION_SEND: 'notification:send',
  // 청소년부 모듈
  YOUTH_MANAGE: 'youth:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** 존재하는 모든 permission 코드 목록 (검증/열거용) */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

/** permission 한글 라벨 (역할 편집 UI 등 클라이언트 표시용) */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.EXPENSE_READ_OWN]: '본인 지출 조회',
  [PERMISSIONS.EXPENSE_READ_DEPARTMENT]: '부서 지출 조회',
  [PERMISSIONS.EXPENSE_READ_ALL]: '전체 지출 조회',
  [PERMISSIONS.EXPENSE_CREATE]: '지출결의서 작성',
  [PERMISSIONS.EXPENSE_APPROVE]: '결재',
  [PERMISSIONS.EXPENSE_EDIT_APPROVED]: '최종승인 후 수정',
  [PERMISSIONS.EXPENSE_PAYMENT_MANAGE]: '지급상태 관리',
  [PERMISSIONS.EXPENSE_BULK_UPLOAD]: '지출결의서 일괄 업로드',
  [PERMISSIONS.EXPENSE_EXPORT]: '지출 내보내기',
  [PERMISSIONS.SIMPLE_EXPENSE_USE]: '간편 지출결의서',
  [PERMISSIONS.RECURRING_READ]: '자동이체 조회',
  [PERMISSIONS.RECURRING_MANAGE_ALL]: '자동이체 전체 관리',
  [PERMISSIONS.ADMIN_DASHBOARD_READ]: '관리자 대시보드',
  [PERMISSIONS.REPORT_BUDGET_EXEC_READ]: '사역비 집행 현황',
  [PERMISSIONS.REPORT_HR_ADMIN_READ]: '인사/행정비 현황',
  [PERMISSIONS.REPORT_QUARTERLY_READ]: '분기별 회계보고',
  [PERMISSIONS.REPORT_CUMULATIVE_READ]: '분기별 누적 현황',
  [PERMISSIONS.REPORT_FINANCIAL_READ]: '재정보고서',
  [PERMISSIONS.REPORT_EXPORT]: '보고서 내보내기',
  [PERMISSIONS.COMMITTEE_MANAGE]: '위원회 관리',
  [PERMISSIONS.DEPARTMENT_MANAGE]: '사역팀(부) 관리',
  [PERMISSIONS.BUDGET_MANAGER_MANAGE]: '세목별 담당자 관리',
  [PERMISSIONS.BUDGET_MASTER_MANAGE]: '예산 항목 관리',
  [PERMISSIONS.BUDGET_VIEW]: '예산 현황 조회',
  [PERMISSIONS.OFFERING_MANAGE]: '헌금 관리',
  [PERMISSIONS.USER_READ]: '사용자 조회',
  [PERMISSIONS.USER_REGISTER]: '사용자 등록',
  [PERMISSIONS.USER_MANAGE]: '사용자 관리',
  [PERMISSIONS.ROLE_MANAGE]: '역할 관리',
  [PERMISSIONS.SETTINGS_MANAGE]: '시스템 설정',
  [PERMISSIONS.NOTIFICATION_SEND]: '알림 발송',
  [PERMISSIONS.YOUTH_MANAGE]: '청소년부 관리',
};

/** 역할 편집 UI 용 permission 그룹 (표시 순서) */
export const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  {
    title: '지출결의서',
    permissions: [
      PERMISSIONS.EXPENSE_READ_OWN,
      PERMISSIONS.EXPENSE_READ_DEPARTMENT,
      PERMISSIONS.EXPENSE_READ_ALL,
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_APPROVE,
      PERMISSIONS.EXPENSE_EDIT_APPROVED,
      PERMISSIONS.EXPENSE_PAYMENT_MANAGE,
      PERMISSIONS.EXPENSE_BULK_UPLOAD,
      PERMISSIONS.EXPENSE_EXPORT,
      PERMISSIONS.SIMPLE_EXPENSE_USE,
    ],
  },
  {
    title: '자동이체',
    permissions: [PERMISSIONS.RECURRING_READ, PERMISSIONS.RECURRING_MANAGE_ALL],
  },
  {
    title: '관리자 · 보고서',
    permissions: [
      PERMISSIONS.ADMIN_DASHBOARD_READ,
      PERMISSIONS.REPORT_BUDGET_EXEC_READ,
      PERMISSIONS.REPORT_HR_ADMIN_READ,
      PERMISSIONS.REPORT_QUARTERLY_READ,
      PERMISSIONS.REPORT_CUMULATIVE_READ,
      PERMISSIONS.REPORT_FINANCIAL_READ,
      PERMISSIONS.REPORT_EXPORT,
    ],
  },
  {
    title: '조직 · 예산',
    permissions: [
      PERMISSIONS.COMMITTEE_MANAGE,
      PERMISSIONS.DEPARTMENT_MANAGE,
      PERMISSIONS.BUDGET_MANAGER_MANAGE,
      PERMISSIONS.BUDGET_MASTER_MANAGE,
      PERMISSIONS.BUDGET_VIEW,
      PERMISSIONS.OFFERING_MANAGE,
    ],
  },
  {
    title: '사용자 · 설정',
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_REGISTER,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.NOTIFICATION_SEND,
    ],
  },
  {
    title: '기타',
    permissions: [PERMISSIONS.YOUTH_MANAGE],
  },
];

/** 입력 배열을 유효한 permission 코드만 남겨 정규화 (중복 제거). 비배열이면 빈 배열 */
export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<Permission>();
  for (const v of input) {
    if (typeof v === 'string' && isPermission(v)) set.add(v);
  }
  return [...set];
}

// ========================================
// 역할별 기본 프리셋 (spec §4.4 매트릭스)
// seed / DB 미설정 fallback 전용. 런타임 정본은 DB Role.permissions.
// ========================================

const P = PERMISSIONS;

// 재사용 그룹
/** 관리(대시보드/보고서/조직·예산 관리/간편지출/자동이체) 접근 역할 */
const MANAGEMENT_PERMS: Permission[] = [
  P.SIMPLE_EXPENSE_USE,
  P.RECURRING_READ,
  P.RECURRING_MANAGE_ALL,
  P.ADMIN_DASHBOARD_READ,
  P.REPORT_BUDGET_EXEC_READ,
  P.REPORT_HR_ADMIN_READ,
  P.REPORT_QUARTERLY_READ,
  P.REPORT_CUMULATIVE_READ,
  P.REPORT_FINANCIAL_READ,
  P.OFFERING_MANAGE,
  P.COMMITTEE_MANAGE,
  P.DEPARTMENT_MANAGE,
  P.BUDGET_MANAGER_MANAGE,
  P.BUDGET_VIEW,
];

export const ROLE_PERMISSION_PRESETS: Record<RoleCode, Permission[]> = {
  // admin: 모든 권한
  admin: [...ALL_PERMISSIONS],

  finance_head: [
    P.EXPENSE_READ_OWN,
    P.EXPENSE_READ_DEPARTMENT,
    P.EXPENSE_READ_ALL,
    P.EXPENSE_CREATE,
    P.EXPENSE_APPROVE,
    P.EXPENSE_EDIT_APPROVED,
    P.EXPENSE_PAYMENT_MANAGE,
    P.EXPENSE_EXPORT,
    P.REPORT_EXPORT,
    P.NOTIFICATION_SEND,
    P.YOUTH_MANAGE,
    P.BUDGET_MASTER_MANAGE, // 예산 마스터 편집 (admin+finance_head, 현행 canAccessAdmin 보존)
    ...MANAGEMENT_PERMS,
  ],

  accountant: [
    P.EXPENSE_READ_OWN,
    P.EXPENSE_READ_DEPARTMENT,
    P.EXPENSE_READ_ALL,
    P.EXPENSE_CREATE,
    P.EXPENSE_APPROVE,
    P.EXPENSE_EDIT_APPROVED,
    P.EXPENSE_PAYMENT_MANAGE,
    P.REPORT_EXPORT,
    P.NOTIFICATION_SEND,
    P.YOUTH_MANAGE,
    ...MANAGEMENT_PERMS,
  ],

  finance_member: [
    P.EXPENSE_READ_OWN,
    P.EXPENSE_READ_DEPARTMENT,
    P.EXPENSE_READ_ALL,
    P.EXPENSE_CREATE,
    P.REPORT_EXPORT,
    ...MANAGEMENT_PERMS,
  ],

  team_leader: [
    P.EXPENSE_READ_OWN,
    P.EXPENSE_READ_DEPARTMENT,
    P.EXPENSE_CREATE,
    P.EXPENSE_APPROVE,
    P.YOUTH_MANAGE,
  ],

  admin_assistant: [
    P.EXPENSE_READ_OWN,
    P.EXPENSE_READ_ALL,
    P.EXPENSE_CREATE,
    P.EXPENSE_EDIT_APPROVED,
    P.EXPENSE_PAYMENT_MANAGE,
    P.EXPENSE_BULK_UPLOAD,
    P.NOTIFICATION_SEND,
    ...MANAGEMENT_PERMS,
  ],

  user: [P.EXPENSE_READ_OWN, P.EXPENSE_CREATE],
};

/** 개별 사용자 플래그 → permission 매핑 (User.canRegisterUsers 등) */
export function individualFlagPermissions(flags: {
  canRegisterUsers?: boolean;
}): Permission[] {
  const perms: Permission[] = [];
  if (flags.canRegisterUsers) perms.push(P.USER_REGISTER);
  return perms;
}

// ========================================
// 권한 해석 (resolve) + 판정 (hasPermission)
// ========================================

/** 역할 코드 → permission 목록을 반환하는 함수 타입 (기본: 프리셋, DB 백엔드로 대체 가능) */
export type RolePermissionResolver = (roleCode: string) => readonly string[];

/** 기본 resolver: 코드 프리셋 사용 */
export const presetResolver: RolePermissionResolver = (roleCode) =>
  isRoleCode(roleCode) ? ROLE_PERMISSION_PRESETS[roleCode] : [];

export interface ResolveOptions {
  /** 역할→권한 정본 (기본: presetResolver). DB 캐시 백엔드를 주입해 AC3 실시간 반영 */
  resolver?: RolePermissionResolver;
  /** 역할 외 개별 부여 권한 */
  granted?: readonly string[];
  /** 역할에서 제외할 권한 */
  revoked?: readonly string[];
}

/**
 * 유효 역할 목록으로부터 effective permission 집합 계산.
 * 여러 역할(User.role ∪ UserYearRole)의 합집합 − revoked + granted.
 */
export function resolvePermissions(
  roles: readonly string[],
  options: ResolveOptions = {}
): Set<Permission> {
  const resolver = options.resolver ?? presetResolver;
  const set = new Set<Permission>();

  for (const role of roles) {
    for (const perm of resolver(role)) {
      if (isPermission(perm)) set.add(perm);
    }
  }
  for (const perm of options.granted ?? []) {
    if (isPermission(perm)) set.add(perm);
  }
  for (const perm of options.revoked ?? []) {
    set.delete(perm as Permission);
  }
  return set;
}

/** 세션 유사 객체 — 인가 판정에 필요한 최소 정보 */
export interface PermissionSubject {
  /** 유효 역할 코드 목록 (단일 역할이면 [role]) */
  roles: readonly string[];
  granted?: readonly string[];
  revoked?: readonly string[];
}

/** subject의 effective permission 집합 */
export function subjectPermissions(
  subject: PermissionSubject,
  resolver?: RolePermissionResolver
): Set<Permission> {
  return resolvePermissions(subject.roles, {
    resolver,
    granted: subject.granted,
    revoked: subject.revoked,
  });
}

/** 단일 권한 보유 여부 */
export function hasPermission(
  permsOrSubject: Set<string> | PermissionSubject,
  permission: Permission,
  resolver?: RolePermissionResolver
): boolean {
  const set =
    permsOrSubject instanceof Set
      ? permsOrSubject
      : subjectPermissions(permsOrSubject, resolver);
  return set.has(permission);
}

/** 역할 코드(단일/다중)가 특정 권한을 프리셋 기준으로 보유하는지 — 인가 판정 단일 진입점 */
export function roleHasPermission(
  roleOrRoles: string | readonly string[],
  permission: Permission,
  resolver?: RolePermissionResolver
): boolean {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles as string];
  return hasPermission({ roles }, permission, resolver);
}

/** 하나라도 보유 */
export function hasAnyPermission(
  permsOrSubject: Set<string> | PermissionSubject,
  permissions: readonly Permission[],
  resolver?: RolePermissionResolver
): boolean {
  const set =
    permsOrSubject instanceof Set
      ? permsOrSubject
      : subjectPermissions(permsOrSubject, resolver);
  return permissions.some((p) => set.has(p));
}

/** 전부 보유 */
export function hasAllPermissions(
  permsOrSubject: Set<string> | PermissionSubject,
  permissions: readonly Permission[],
  resolver?: RolePermissionResolver
): boolean {
  const set =
    permsOrSubject instanceof Set
      ? permsOrSubject
      : subjectPermissions(permsOrSubject, resolver);
  return permissions.every((p) => set.has(p));
}
