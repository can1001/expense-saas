'use client';

import Link from 'next/link';
import GlobalShell from '@/components/layout/GlobalShell';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';

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
    gradient: 'from-pink-400 via-rose-400 to-pink-500',
    bgLight: 'bg-pink-50',
    bgMedium: 'bg-pink-100',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200',
    shadowColor: 'shadow-pink-200/50',
  },
  ELEMENTARY: {
    name: '초등부',
    age: '7-12세',
    emoji: '📚',
    gradient: 'from-blue-400 via-indigo-400 to-blue-500',
    bgLight: 'bg-blue-50',
    bgMedium: 'bg-blue-100',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    shadowColor: 'shadow-blue-200/50',
  },
  MIDDLE: {
    name: '중등부',
    age: '13-15세',
    emoji: '🎯',
    gradient: 'from-emerald-400 via-teal-400 to-emerald-500',
    bgLight: 'bg-emerald-50',
    bgMedium: 'bg-emerald-100',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    shadowColor: 'shadow-emerald-200/50',
  },
  HIGH: {
    name: '고등부',
    age: '16-18세',
    emoji: '🚀',
    gradient: 'from-violet-400 via-purple-400 to-violet-500',
    bgLight: 'bg-violet-50',
    bgMedium: 'bg-violet-100',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-200',
    shadowColor: 'shadow-violet-200/50',
  },
  YOUNG_ADULT: {
    name: '청년부',
    age: '19-29세',
    emoji: '💪',
    gradient: 'from-amber-400 via-orange-400 to-amber-500',
    bgLight: 'bg-amber-50',
    bgMedium: 'bg-amber-100',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    shadowColor: 'shadow-amber-200/50',
  },
};

export default function YouthNightClient({ user, curriculums }: Props) {
  const curriculumsByAge = curriculums.reduce((acc, curriculum) => {
    if (!acc[curriculum.ageGroup]) {
      acc[curriculum.ageGroup] = [];
    }
    acc[curriculum.ageGroup].push(curriculum);
    return acc;
  }, {} as Record<string, Curriculum[]>);

  const isAdmin = roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE);
  const totalLessons = curriculums.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <GlobalShell title="청나잇">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" />

        {/* Animated Decorative Circles */}
        <div className="absolute top-4 left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <div className="absolute top-16 right-8 w-32 h-32 bg-yellow-300/20 rounded-full blur-2xl" />
        <div className="absolute bottom-8 left-1/4 w-24 h-24 bg-pink-300/20 rounded-full blur-xl" />
        <div className="absolute -bottom-4 right-1/3 w-16 h-16 bg-blue-300/20 rounded-full blur-lg" />

        {/* Stars decoration */}
        <div className="absolute top-8 right-12 text-yellow-200/60 text-lg">✦</div>
        <div className="absolute top-20 left-16 text-white/40 text-sm">✦</div>
        <div className="absolute bottom-16 right-20 text-pink-200/50 text-base">✦</div>

        <div className="relative px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
          <div className="max-w-md mx-auto text-center">
            {/* Logo */}
            <div className="relative inline-block mb-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/20 border border-white/20">
                <span className="text-4xl sm:text-5xl">🌙</span>
              </div>
              {/* Sparkle */}
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-300 rounded-full flex items-center justify-center text-xs shadow-lg">
                ✨
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
              청나잇
            </h1>
            <p className="text-lg text-white/90 font-medium mb-1">
              Youth Night
            </p>
            <p className="text-sm text-white/70 mb-6">
              말씀과 함께 성장하는 시간 ✨
            </p>

            {/* Welcome Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
              <div className="w-7 h-7 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full flex items-center justify-center text-sm shadow-inner">
                👋
              </div>
              <span className="text-sm font-medium text-white">
                {user.username}님, 환영해요!
              </span>
            </div>

            {/* Admin Button */}
            {isAdmin && (
              <div className="mt-4">
                <Link
                  href="/youth-night/admin"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white/90 text-sm font-medium rounded-xl hover:bg-white/20 transition-all border border-white/10"
                >
                  <span>⚙️</span>
                  <span>관리자</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" className="w-full h-auto">
            <path
              d="M0 80V40C180 65 360 20 540 30C720 40 900 70 1080 50C1260 30 1350 55 1440 40V80H0Z"
              className="fill-slate-50"
            />
          </svg>
        </div>
      </div>

      <main className="px-4 pb-10 -mt-2">
        <div className="max-w-3xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { value: curriculums.length, label: '커리큘럼', color: 'from-indigo-500 to-indigo-600', emoji: '📖' },
              { value: totalLessons, label: '레슨', color: 'from-purple-500 to-purple-600', emoji: '🎓' },
              { value: 5, label: '연령그룹', color: 'from-pink-500 to-pink-600', emoji: '👥' },
            ].map((stat, i) => (
              <div
                key={i}
                className="relative bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color}`} />
                <div className="text-center">
                  <span className="text-2xl mb-1 block">{stat.emoji}</span>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Section Title */}
          <div className="flex items-center gap-3 mb-5 px-1">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-lg">🎯</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">연령 그룹 선택</h2>
              <p className="text-sm text-gray-500">나에게 맞는 그룹을 선택하세요</p>
            </div>
          </div>

          {/* Age Group Cards */}
          <div className="space-y-4">
            {Object.entries(AGE_GROUP_CONFIG).map(([ageGroup, config]) => {
              const groupCurriculums = curriculumsByAge[ageGroup] || [];
              const lessonCount = groupCurriculums.reduce((sum, c) => sum + c.lessons.length, 0);
              const hasContent = lessonCount > 0;

              return (
                <Link
                  key={ageGroup}
                  href={`/youth-night/${ageGroup.toLowerCase()}`}
                  className="block group"
                >
                  <div className={`relative bg-white rounded-3xl shadow-sm border-2 ${config.borderColor} overflow-hidden transition-all duration-300 active:scale-[0.98] hover:shadow-lg ${config.shadowColor}`}>
                    {/* Left Gradient Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${config.gradient}`} />

                    <div className="flex items-center p-4 pl-6">
                      {/* Emoji Avatar */}
                      <div className={`relative flex-shrink-0 w-16 h-16 ${config.bgMedium} rounded-2xl flex items-center justify-center shadow-inner`}>
                        <span className="text-4xl transform group-hover:scale-110 transition-transform">
                          {config.emoji}
                        </span>
                        {hasContent && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white">
                            ✓
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 ml-4 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-xl font-bold text-gray-900">
                            {config.name}
                          </h3>
                          <span className={`text-xs font-bold ${config.textColor} ${config.bgLight} px-2.5 py-1 rounded-full`}>
                            {config.age}
                          </span>
                        </div>

                        {hasContent ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`font-semibold ${config.textColor}`}>
                              {groupCurriculums.length}개 커리큘럼
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500">
                              {lessonCount}개 레슨
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 flex items-center gap-1">
                            <span>🚧</span> 준비 중...
                          </p>
                        )}

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${config.gradient} rounded-full transition-all duration-500`}
                              style={{ width: hasContent ? `${Math.min((lessonCount / 10) * 100, 100)}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className={`flex-shrink-0 w-12 h-12 ${config.bgLight} rounded-2xl flex items-center justify-center ml-3 transition-all group-hover:translate-x-1 group-hover:shadow-md`}>
                        <svg className={`w-6 h-6 ${config.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Featured Curriculums */}
          {curriculums.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-3 mb-5 px-1">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                  <span className="text-lg">🔥</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">최신 커리큘럼</h2>
                  <p className="text-sm text-gray-500">새로 추가된 커리큘럼</p>
                </div>
              </div>

              <div className="grid gap-4">
                {curriculums.slice(0, 3).map((curriculum) => {
                  const config = AGE_GROUP_CONFIG[curriculum.ageGroup as keyof typeof AGE_GROUP_CONFIG];
                  return (
                    <Link
                      key={curriculum.id}
                      href={`/youth-night/${curriculum.ageGroup.toLowerCase()}`}
                      className="block group"
                    >
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                          <div className={`flex-shrink-0 w-14 h-14 bg-gradient-to-br ${config.gradient} rounded-2xl flex items-center justify-center shadow-md`}>
                            <span className="text-2xl">{config.emoji}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold ${config.textColor} ${config.bgLight} px-2 py-0.5 rounded-full`}>
                                {config.name}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-900 line-clamp-1">
                              {curriculum.title}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {curriculum.lessons.length}개 레슨
                            </p>
                          </div>
                          <div className={`flex-shrink-0 w-10 h-10 ${config.bgLight} rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-transform`}>
                            <svg className={`w-5 h-5 ${config.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Decoration */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400">
              Made with 💜 for Youth Night
            </p>
          </div>
        </div>
      </main>
    </GlobalShell>
  );
}
