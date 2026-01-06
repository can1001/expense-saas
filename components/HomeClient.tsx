'use client';

import Link from 'next/link';
import { canAccessExtendedMenu, canAccessApprovalMenu, canAccessAdminMenu, ROLE_NAMES } from '@/lib/constants/menu-permissions';
import { UserRole } from '@prisma/client';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: UserRole;
  department?: string | null;
}

interface Props {
  user: UserInfo;
}

export default function HomeClient({ user }: Props) {
  const showExtendedMenu = canAccessExtendedMenu(user.role);
  const showApprovalMenu = canAccessApprovalMenu(user.role);
  const showAdminMenu = canAccessAdminMenu(user.role);

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            지출결의서 관리 시스템
          </h1>
          <p className="text-xl text-gray-600">
            교회 지출결의서를 간편하게 작성하고 관리하세요
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {user.username}님 ({ROLE_NAMES[user.role]})
          </p>
        </div>

        {/* 지출결의서 메뉴 */}
        <div className="mb-6">
          {showExtendedMenu && (
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              지출결의서
            </h2>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="/expenses/new"
              className="group bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                새 지출결의서 작성
              </h2>
              <p className="text-gray-600">
                위원회/사역팀 선택 방식의 지출결의서
              </p>
            </Link>

            <Link
              href="/expenses"
              className="group bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                지출결의서 목록
              </h2>
              <p className="text-gray-600">
                저장된 지출결의서를 조회하고 관리하세요
              </p>
            </Link>
          </div>
        </div>

        {/* 간편 지출결의서 (확장 메뉴 역할만) */}
        {showExtendedMenu && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              간편 지출결의서 (Ver.4.1.4) - 항목별 예산 선택
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Link
                href="/expenses/simple/new"
                className="group bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-indigo-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">NEW</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  간편 지출결의서 작성
                </h2>
                <p className="text-gray-600">
                  각 항목별로 예산(항/목/세목)을 선택하는 방식
                </p>
              </Link>

              <Link
                href="/expenses/simple"
                className="group bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-purple-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">NEW</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  간편 지출결의서 목록
                </h2>
                <p className="text-gray-600">
                  간편 양식 지출결의서를 조회하고 관리하세요
                </p>
              </Link>
            </div>
          </div>
        )}

        {/* 결재 & 관리 메뉴 */}
        {(showApprovalMenu || showAdminMenu) && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              결재 & 관리
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {showApprovalMenu && (
                <Link
                  href="/approvals"
                  className="group bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-amber-100"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-amber-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    결재함
                  </h2>
                  <p className="text-gray-600">
                    결재 대기 중인 지출결의서를 처리하세요
                  </p>
                </Link>
              )}

              {showAdminMenu && (
                <Link
                  href="/admin"
                  className="group bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-gray-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-gray-700 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    관리
                  </h2>
                  <p className="text-gray-600">
                    사용자, 예산, 역할 등 시스템 관리
                  </p>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 통계 (확장 메뉴 역할만) */}
        {showExtendedMenu && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">204</p>
              <p className="text-sm text-gray-600">예산 항목</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-green-600">7</p>
              <p className="text-sm text-gray-600">위원회</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">31</p>
              <p className="text-sm text-gray-600">부서/팀</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">21</p>
              <p className="text-sm text-gray-600">승인권자</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
