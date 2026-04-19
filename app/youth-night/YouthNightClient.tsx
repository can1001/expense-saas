'use client';

import Link from 'next/link';
import Header from '@/components/Header';

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

const AGE_GROUP_CONFIG = {
  KIDS: {
    name: '유아부',
    age: '3-6세',
    emoji: '🧒',
    gradient: 'from-pink-400 to-rose-500',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200',
  },
  ELEMENTARY: {
    name: '초등부',
    age: '7-12세',
    emoji: '📚',
    gradient: 'from-blue-400 to-indigo-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  MIDDLE: {
    name: '중등부',
    age: '13-15세',
    emoji: '🎯',
    gradient: 'from-emerald-400 to-teal-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
  },
  HIGH: {
    name: '고등부',
    age: '16-18세',
    emoji: '🚀',
    gradient: 'from-violet-400 to-purple-500',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-200',
  },
  YOUNG_ADULT: {
    name: '청년부',
    age: '19-29세',
    emoji: '💪',
    gradient: 'from-amber-400 to-orange-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
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

  const totalLessons = curriculums.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-20 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/10 rounded-full translate-y-1/2" />

        <div className="relative px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
          <div className="max-w-lg mx-auto text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 sm:mb-6">
              <span className="text-3xl sm:text-4xl">🌙</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-3">
              청나잇
            </h1>
            <p className="text-base sm:text-lg text-white/90 font-medium mb-1">
              Youth Night
            </p>
            <p className="text-sm sm:text-base text-white/70">
              말씀과 함께 성장하는 시간
            </p>

            {/* Welcome message */}
            <div className="mt-4 sm:mt-6 inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
              <span className="text-sm text-white">
                👋 {user.username}님, 환영해요!
              </span>
            </div>

            {/* Admin button */}
            {isAdmin && (
              <div className="mt-4">
                <Link
                  href="/youth-night/admin"
                  className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-lg hover:bg-white/30 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  관리자
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 60V30C240 10 480 0 720 10C960 20 1200 50 1440 30V60H0Z" fill="#f8fafc"/>
          </svg>
        </div>
      </div>

      <main className="px-4 pb-8 sm:px-6 sm:pb-12 -mt-4">
        <div className="max-w-lg mx-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{curriculums.length}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">커리큘럼</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold text-purple-600">{totalLessons}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">레슨</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <p className="text-2xl sm:text-3xl font-bold text-pink-600">5</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">연령그룹</p>
            </div>
          </div>

          {/* Age Group Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 px-1">
              내 연령 그룹 선택하기
            </h2>

            {Object.entries(AGE_GROUP_CONFIG).map(([ageGroup, config]) => {
              const groupCurriculums = curriculumsByAge[ageGroup] || [];
              const lessonCount = groupCurriculums.reduce((sum, c) => sum + c.lessons.length, 0);

              return (
                <Link
                  key={ageGroup}
                  href={`/youth-night/${ageGroup.toLowerCase()}`}
                  className="block group"
                >
                  <div className={`relative overflow-hidden bg-white rounded-2xl shadow-sm border ${config.borderColor} transition-all duration-300 active:scale-[0.98] hover:shadow-md`}>
                    {/* Gradient accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${config.gradient}`} />

                    <div className="flex items-center p-4 pl-5">
                      {/* Emoji */}
                      <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 ${config.bgLight} rounded-2xl flex items-center justify-center`}>
                        <span className="text-3xl sm:text-4xl">{config.emoji}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 ml-4 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {config.name}
                          </h3>
                          <span className={`text-xs font-medium ${config.textColor} ${config.bgLight} px-2 py-0.5 rounded-full`}>
                            {config.age}
                          </span>
                        </div>

                        {groupCurriculums.length > 0 ? (
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>{groupCurriculums.length}개 커리큘럼</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span>{lessonCount}개 레슨</span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">준비 중...</p>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className={`flex-shrink-0 w-10 h-10 ${config.bgLight} rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1`}>
                        <svg className={`w-5 h-5 ${config.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    {/* Progress bar (if has content) */}
                    {lessonCount > 0 && (
                      <div className="px-5 pb-4">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${config.gradient} rounded-full`}
                            style={{ width: `${Math.min((lessonCount / 10) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Featured Section */}
          {curriculums.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-gray-900 px-1 mb-4">
                🔥 최신 커리큘럼
              </h2>
              <div className="space-y-3">
                {curriculums.slice(0, 2).map((curriculum) => {
                  const config = AGE_GROUP_CONFIG[curriculum.ageGroup as keyof typeof AGE_GROUP_CONFIG];
                  return (
                    <Link
                      key={curriculum.id}
                      href={`/youth-night/${curriculum.ageGroup.toLowerCase()}`}
                      className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center`}>
                          <span className="text-lg">{config.emoji}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${config.textColor} mb-1`}>
                            {config.name}
                          </p>
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                            {curriculum.title}
                          </h3>
                          {curriculum.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {curriculum.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {curriculum.lessons.length}개 레슨
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
