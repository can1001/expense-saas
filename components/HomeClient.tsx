'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { canAccessExtendedMenu, canAccessApprovalMenu, canAccessAdminMenu, ROLE_NAMES } from '@/lib/constants/menu-permissions';
import { TEXT_HERO, TEXT_SUBTITLE, TEXT_SECTION_TITLE, TEXT_STAT, PADDING_PAGE, PADDING_CARD, MARGIN_SECTION } from '@/lib/constants/styles';
import { usePendingApprovalCount } from '@/hooks/usePendingApprovalCount';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;  // 역할 코드 (string으로 DB에서 반환)
  department?: string | null;
}

interface HomeStats {
  budgetCount: number;
  committeeCount: number;
  departmentCount: number;
  approverCount: number;
}

interface Props {
  user: UserInfo;
  isBudgetManager?: boolean;  // 세목 담당자 여부
  stats?: HomeStats;  // 홈 화면 통계
}

export default function HomeClient({ user, isBudgetManager = false, stats }: Props) {
  const showExtendedMenu = canAccessExtendedMenu(user.role);
  // 세목 담당자도 결재함 접근 가능
  const showApprovalMenu = canAccessApprovalMenu(user.role) || isBudgetManager;
  const showAdminMenu = canAccessAdminMenu(user.role);

  // 결재 대기 건수 조회
  const { count: pendingCount } = usePendingApprovalCount({
    enabled: showApprovalMenu,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`${PADDING_PAGE} bg-gradient-to-br from-blue-50 to-indigo-100`}>
        <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className={`text-center ${MARGIN_SECTION}`}>
          <h1 className={`${TEXT_HERO} text-gray-900 mb-2 sm:mb-4`}>
            지출결의서 관리 시스템
          </h1>
          <p className={`${TEXT_SUBTITLE} text-gray-600`}>
            교회 지출결의서를 간편하게 작성하고 관리하세요
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            {user.username}님 ({ROLE_NAMES[user.role]})
          </p>
        </div>

        {/* 지출결의서 메뉴 */}
        <div className="mb-4 sm:mb-6">
          {showExtendedMenu && (
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
              지출결의서
            </h2>
          )}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <Link
              href="/expenses/new"
              className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              <div>
                <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2`}>
                  새 지출결의서 작성
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  위원회/사역팀 선택 방식의 지출결의서
                </p>
              </div>
            </Link>

            <Link
              href="/expenses"
              className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
              <div>
                <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2`}>
                  지출결의서 목록
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  저장된 지출결의서를 조회하고 관리하세요
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* 간편 지출결의서 (확장 메뉴 역할만) */}
        {showExtendedMenu && (
          <div className="mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
              간편 지출결의서 (Ver.4.1.4) - 항목별 예산 선택
            </h2>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <Link
                href="/expenses/simple/new"
                className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-indigo-100`}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
                <div>
                  <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2`}>
                    간편 지출결의서 작성
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    각 항목별로 예산(항/목/세목)을 선택하는 방식
                  </p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* 결재 & 관리 메뉴 */}
        {(showApprovalMenu || showAdminMenu) && (
          <div className={MARGIN_SECTION}>
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
              결재 & 관리
            </h2>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              {showApprovalMenu && (
                <Link
                  href="/approvals"
                  className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-amber-100`}
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
                  <div>
                    <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2 flex items-center`}>
                      결재함
                      {pendingCount > 0 && (
                        <span
                          className="ml-2 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full"
                          aria-label={`결재 대기 ${pendingCount}건`}
                        >
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600">
                      결재 대기 중인 지출결의서를 처리하세요
                    </p>
                  </div>
                </Link>
              )}

              {showAdminMenu && (
                <Link
                  href="/admin"
                  className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-gray-200`}
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
                  <div>
                    <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2`}>
                      관리
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600">
                      사용자, 예산, 역할 등 시스템 관리
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 내 정보 메뉴 */}
        <div className={MARGIN_SECTION}>
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
            내 정보
          </h2>
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <Link
              href="/mypage"
              className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-teal-100`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-teal-500 transition-colors"
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
              <div>
                <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2`}>
                  마이페이지
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  비밀번호 변경, 서명/도장 관리
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* 청나잇 메뉴 (임시 숨김) */}
        <div className={`${MARGIN_SECTION} hidden`}>
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
            청소년 사역
          </h2>
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <Link
              href="/youth-night"
              className={`group bg-white rounded-xl shadow-lg ${PADDING_CARD} hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-purple-100`}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors"
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
              <div>
                <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-1 sm:mb-2`}>
                  청나잇
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  청소년/어린이 예배 교안, 퀴즈, 암송
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* 통계 (확장 메뉴 역할만) */}
        {showExtendedMenu && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className={`${TEXT_STAT} text-blue-600`}>{stats.budgetCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">예산 항목</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className={`${TEXT_STAT} text-green-600`}>{stats.committeeCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">위원회</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className={`${TEXT_STAT} text-purple-600`}>{stats.departmentCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">부서/팀</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className={`${TEXT_STAT} text-orange-600`}>{stats.approverCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">승인권자</p>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
