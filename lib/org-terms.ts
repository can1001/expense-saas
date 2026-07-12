/**
 * 조직 유형(OrgType)별 화면 용어 사전
 *
 * DB 스키마/API 필드명은 그대로 두고, 화면에 표시되는 용어만 조직 유형에 맞게 치환한다.
 * - Committee 모델: 교회=위원회, 기업=본부
 * - Department 모델: 교회=사역팀(부), 기업=팀
 *
 * 클라이언트 컴포넌트에서 안전하게 사용 가능 (Prisma 미의존).
 */

// Prisma OrgType enum과 동일한 문자열 유니온 (클라이언트 번들에 Prisma 포함 방지)
export type OrgTypeCode = 'CHURCH' | 'NONPROFIT' | 'SCHOOL' | 'COMPANY' | 'OTHER';

export interface OrgTerms {
  /** Committee 모델의 표시 명칭 (예: 위원회 / 본부) */
  committee: string;
  /** Department 모델의 표시 명칭 (예: 사역팀 / 팀) */
  department: string;
  /** Department 모델의 정식 표기 (예: 사역팀(부) / 팀) */
  departmentFull: string;
  /** Department 모델의 슬래시 표기 (예: 사역팀/부 / 팀) — 기존 화면 호환용 */
  departmentSlash: string;
  /** 부서 운영 지출 명칭 (예: 사역비 / 팀 운영비) */
  operationalExpense: string;
  /** Committee 책임자 명칭 (예: 위원장 / 본부장) */
  committeeLeader: string;
}

const CHURCH_TERMS: OrgTerms = {
  committee: '위원회',
  department: '사역팀',
  departmentFull: '사역팀(부)',
  departmentSlash: '사역팀/부',
  operationalExpense: '사역비',
  committeeLeader: '위원장',
};

const COMPANY_TERMS: OrgTerms = {
  committee: '본부',
  department: '팀',
  departmentFull: '팀',
  departmentSlash: '팀',
  operationalExpense: '팀 운영비',
  committeeLeader: '본부장',
};

// 비영리/학교는 일반 조직 용어(부서) 사용 — 필요 시 별도 사전으로 분리
const GENERIC_TERMS: OrgTerms = {
  committee: '본부',
  department: '부서',
  departmentFull: '부서',
  departmentSlash: '부서',
  operationalExpense: '부서 운영비',
  committeeLeader: '본부장',
};

const TERMS_BY_ORG_TYPE: Record<OrgTypeCode, OrgTerms> = {
  CHURCH: CHURCH_TERMS,
  COMPANY: COMPANY_TERMS,
  NONPROFIT: GENERIC_TERMS,
  SCHOOL: GENERIC_TERMS,
  OTHER: GENERIC_TERMS,
};

/**
 * 조직 유형에 맞는 용어 사전 반환.
 * orgType이 없거나 알 수 없으면 기존 동작 유지를 위해 교회 용어를 기본값으로 사용한다.
 */
export function getOrgTerms(orgType?: string | null): OrgTerms {
  if (orgType && orgType in TERMS_BY_ORG_TYPE) {
    return TERMS_BY_ORG_TYPE[orgType as OrgTypeCode];
  }
  return CHURCH_TERMS;
}

/** 교회 전용 기능 여부 (메뉴/라우트 노출 제어에 사용) */
export function isChurchOnlyFeatureVisible(orgType?: string | null): boolean {
  // orgType 미확정 시 기존 동작(노출) 유지
  return !orgType || orgType === 'CHURCH';
}
