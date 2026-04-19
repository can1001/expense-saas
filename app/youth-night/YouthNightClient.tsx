'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { TEXT_HERO, TEXT_SUBTITLE, TEXT_SECTION_TITLE, PADDING_PAGE, PADDING_CARD, MARGIN_SECTION } from '@/lib/constants/styles';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;
  department?: string | null;
}

interface Lesson {
  id: string;
  title: string;
  lessonNumber: number;
}

interface Curriculum {
  id: string;
  title: string;
  description: string | null;
  ageGroup: string;
  startDate: Date | null;
  endDate: Date | null;
  lessons: Lesson[];
}

interface Props {
  user: UserInfo;
  curriculums: Curriculum[];
}

const AGE_GROUP_NAMES = {
  KIDS: '유아부 (3-6세)',
  ELEMENTARY: '초등부 (7-12세)',
  MIDDLE: '중등부 (13-15세)',
  HIGH: '고등부 (16-18세)',
  YOUNG_ADULT: '청년부 (19-29세)',
};

const AGE_GROUP_COLORS = {
  KIDS: 'bg-pink-500',
  ELEMENTARY: 'bg-blue-500',
  MIDDLE: 'bg-green-500',
  HIGH: 'bg-purple-500',
  YOUNG_ADULT: 'bg-orange-500',
};

const AGE_GROUP_BORDER_COLORS = {
  KIDS: 'border-pink-100',
  ELEMENTARY: 'border-blue-100',
  MIDDLE: 'border-green-100',
  HIGH: 'border-purple-100',
  YOUNG_ADULT: 'border-orange-100',
};

export default function YouthNightClient({ user, curriculums }: Props) {
  // 연령별로 커리큘럼 그룹화
  const curriculumsByAge = curriculums.reduce((acc, curriculum) => {
    if (!acc[curriculum.ageGroup]) {
      acc[curriculum.ageGroup] = [];
    }
    acc[curriculum.ageGroup].push(curriculum);
    return acc;
  }, {} as Record<string, Curriculum[]>);

  // 관리자 권한 확인
  const isAdmin = ['admin', 'finance_head', 'accountant', 'team_leader'].includes(user.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`${PADDING_PAGE} bg-gradient-to-br from-purple-50 to-pink-100`}>
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className={`text-center ${MARGIN_SECTION}`}>
            <h1 className={`${TEXT_HERO} text-gray-900 mb-2 sm:mb-4`}>
              청나잇 (Youth Night)
            </h1>
            <p className={`${TEXT_SUBTITLE} text-gray-600`}>
              연령별 말씀 교육과 퀴즈로 함께 성장해요
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
              {user.username}님, 청나잇에 오신 것을 환영합니다!
            </p>

            {/* 관리자 메뉴 */}
            {isAdmin && (
              <div className="mt-4">
                <Link
                  href="/youth-night/admin"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                    />
                  </svg>
                  관리자 페이지
                </Link>
              </div>
            )}
          </div>

          {/* 연령별 섹션 */}
          <div className="space-y-6 sm:space-y-8">
            {Object.entries(AGE_GROUP_NAMES).map(([ageGroup, displayName]) => {
              const groupCurriculums = curriculumsByAge[ageGroup] || [];

              return (
                <div key={ageGroup} className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 ${AGE_GROUP_COLORS[ageGroup as keyof typeof AGE_GROUP_COLORS]} rounded-lg flex items-center justify-center`}>
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                      <h2 className={`${TEXT_SECTION_TITLE} text-gray-900`}>
                        {displayName}
                      </h2>
                    </div>
                    <Link
                      href={`/youth-night/${ageGroup.toLowerCase()}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      전체 보기 →
                    </Link>
                  </div>

                  {groupCurriculums.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupCurriculums.slice(0, 3).map((curriculum) => (
                        <Link
                          key={curriculum.id}
                          href={`/youth-night/${ageGroup.toLowerCase()}`}
                          className={`group bg-gray-50 rounded-xl ${PADDING_CARD} hover:shadow-md transition-all hover:-translate-y-1 border-2 ${AGE_GROUP_BORDER_COLORS[ageGroup as keyof typeof AGE_GROUP_BORDER_COLORS]}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2">
                              {curriculum.title}
                            </h3>
                            <svg
                              className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0"
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
                          {curriculum.description && (
                            <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">
                              {curriculum.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{curriculum.lessons.length}개 레슨</span>
                            {curriculum.startDate && (
                              <span>
                                {new Date(curriculum.startDate).getFullYear()}년
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <svg
                        className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      <p className="text-gray-500 text-sm sm:text-base">
                        아직 {displayName} 커리큘럼이 없습니다
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 전체 통계 */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                {curriculums.length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">활성 커리큘럼</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                {curriculums.reduce((sum, c) => sum + c.lessons.length, 0)}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">총 레슨 수</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {Object.keys(curriculumsByAge).length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">연령 그룹</p>
            </div>
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                100%
              </p>
              <p className="text-xs sm:text-sm text-gray-600">진행률</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}