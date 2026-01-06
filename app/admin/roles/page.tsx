'use client';

import { Shield, Check, X } from 'lucide-react';

interface RoleInfo {
  role: string;
  name: string;
  description: string;
  color: string;
  permissions: {
    label: string;
    allowed: boolean;
  }[];
}

const ROLES: RoleInfo[] = [
  {
    role: 'admin',
    name: '관리자',
    description: '시스템 전체 관리 권한을 가진 최고 관리자입니다.',
    color: 'bg-red-500',
    permissions: [
      { label: '지출결의서 작성', allowed: true },
      { label: '지출결의서 조회 (전체)', allowed: true },
      { label: '결재함 접근', allowed: true },
      { label: '간편 지출결의서', allowed: true },
      { label: '관리 메뉴 접근', allowed: true },
      { label: '사용자 관리', allowed: true },
      { label: '예산 관리', allowed: true },
      { label: '엑셀 다운로드', allowed: true },
    ],
  },
  {
    role: 'finance_head',
    name: '재정팀장',
    description: '3차(최종) 결재 권한을 가진 재정팀 책임자입니다.',
    color: 'bg-purple-500',
    permissions: [
      { label: '지출결의서 작성', allowed: true },
      { label: '지출결의서 조회 (전체)', allowed: true },
      { label: '결재함 접근 (3차 결재)', allowed: true },
      { label: '간편 지출결의서', allowed: true },
      { label: '관리 메뉴 접근', allowed: false },
      { label: '사용자 관리', allowed: false },
      { label: '예산 관리', allowed: false },
      { label: '엑셀 다운로드', allowed: true },
    ],
  },
  {
    role: 'accountant',
    name: '회계',
    description: '2차 결재 권한을 가진 회계 담당자입니다.',
    color: 'bg-blue-500',
    permissions: [
      { label: '지출결의서 작성', allowed: true },
      { label: '지출결의서 조회 (전체)', allowed: true },
      { label: '결재함 접근 (2차 결재)', allowed: true },
      { label: '간편 지출결의서', allowed: true },
      { label: '관리 메뉴 접근', allowed: false },
      { label: '사용자 관리', allowed: false },
      { label: '예산 관리', allowed: false },
      { label: '엑셀 다운로드', allowed: true },
    ],
  },
  {
    role: 'team_leader',
    name: '팀장',
    description: '1차 결재 권한을 가진 사역팀 팀장입니다.',
    color: 'bg-green-500',
    permissions: [
      { label: '지출결의서 작성', allowed: true },
      { label: '지출결의서 조회 (본인)', allowed: true },
      { label: '결재함 접근 (1차 결재)', allowed: true },
      { label: '간편 지출결의서', allowed: false },
      { label: '관리 메뉴 접근', allowed: false },
      { label: '사용자 관리', allowed: false },
      { label: '예산 관리', allowed: false },
      { label: '엑셀 다운로드', allowed: false },
    ],
  },
  {
    role: 'admin_assistant',
    name: '행정간사',
    description: '지출 관리 및 엑셀 다운로드 권한을 가진 행정 담당자입니다.',
    color: 'bg-orange-500',
    permissions: [
      { label: '지출결의서 작성', allowed: true },
      { label: '지출결의서 조회 (전체)', allowed: true },
      { label: '결재함 접근', allowed: false },
      { label: '간편 지출결의서', allowed: true },
      { label: '관리 메뉴 접근', allowed: false },
      { label: '사용자 관리', allowed: false },
      { label: '예산 관리', allowed: false },
      { label: '엑셀 다운로드', allowed: true },
    ],
  },
  {
    role: 'user',
    name: '사용자',
    description: '지출결의서 작성 및 조회 기본 권한을 가진 일반 사용자입니다.',
    color: 'bg-gray-500',
    permissions: [
      { label: '지출결의서 작성', allowed: true },
      { label: '지출결의서 조회 (본인)', allowed: true },
      { label: '결재함 접근', allowed: false },
      { label: '간편 지출결의서', allowed: false },
      { label: '관리 메뉴 접근', allowed: false },
      { label: '사용자 관리', allowed: false },
      { label: '예산 관리', allowed: false },
      { label: '엑셀 다운로드', allowed: false },
    ],
  },
];

export default function RolesPage() {
  return (
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">역할 안내</h1>
        </div>
        <p className="text-gray-600">
          시스템에서 사용되는 6개의 역할과 각 역할별 권한을 안내합니다.
        </p>
      </div>

      {/* 역할 카드 */}
      <div className="grid gap-6">
        {ROLES.map((roleInfo) => (
          <div
            key={roleInfo.role}
            className="bg-white rounded-lg shadow overflow-hidden"
          >
            {/* 역할 헤더 */}
            <div className="flex items-center gap-4 p-4 border-b">
              <div className={`w-12 h-12 ${roleInfo.color} rounded-lg flex items-center justify-center`}>
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {roleInfo.name}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({roleInfo.role})
                  </span>
                </h2>
                <p className="text-sm text-gray-600">{roleInfo.description}</p>
              </div>
            </div>

            {/* 권한 목록 */}
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {roleInfo.permissions.map((perm) => (
                  <div
                    key={perm.label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      perm.allowed
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {perm.allowed ? (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{perm.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>참고:</strong> 역할은 시스템에서 고정되어 있으며, 사용자의 역할 변경은
          관리자가 &apos;사용자 관리&apos; 또는 &apos;연도별 역할 관리&apos; 메뉴에서 할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
