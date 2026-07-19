'use client';

import Link from 'next/link';
import GlobalShell from '@/components/layout/GlobalShell';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;
  department?: string | null;
}

interface Question {
  id: string;
  questionNumber: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  bibleVerse: string | null;
  keyPoint: string | null;
  lessonNumber: number;
  publishedAt: Date | null;
  questions: Question[];
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
  ageGroup: string;
  urlAgeGroup: string;
}

const AGE_GROUP_CONFIG = {
  KIDS: {
    name: '유아부',
    age: '3-6세',
    emoji: '🧒',
    gradient: 'from-pink-400 via-rose-400 to-pink-500',
    gradientBg: 'from-pink-500 via-rose-500 to-pink-600',
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
    gradientBg: 'from-blue-500 via-indigo-500 to-blue-600',
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
    gradientBg: 'from-emerald-500 via-teal-500 to-emerald-600',
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
    gradientBg: 'from-violet-500 via-purple-500 to-violet-600',
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
    gradientBg: 'from-amber-500 via-orange-500 to-amber-600',
    bgLight: 'bg-amber-50',
    bgMedium: 'bg-amber-100',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
    shadowColor: 'shadow-amber-200/50',
  },
};

export default function AgeGroupClient({ user, curriculums, ageGroup, urlAgeGroup }: Props) {
  const config = AGE_GROUP_CONFIG[ageGroup as keyof typeof AGE_GROUP_CONFIG];
  const totalLessons = curriculums.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <GlobalShell title={config.name}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradientBg}`} />

        {/* Decorative Elements */}
        <div className="absolute top-4 right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-12 left-8 w-20 h-20 bg-white/10 rounded-full blur-lg" />
        <div className="absolute top-16 left-1/4 text-white/30 text-lg">✦</div>
        <div className="absolute bottom-20 right-1/4 text-white/20 text-sm">✦</div>

        <div className="relative px-5 pt-6 pb-14 sm:pt-8 sm:pb-18">
          <div className="max-w-md mx-auto">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/youth-night"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 backdrop-blur-sm text-white rounded-xl hover:bg-white/25 transition-all border border-white/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">청나잇</span>
              </Link>

              <Link
                href={`/youth-night/${urlAgeGroup}/ranking`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-400/90 text-yellow-900 rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/30 font-semibold text-sm"
              >
                <span>🏆</span>
                <span>랭킹</span>
              </Link>
            </div>

            {/* Title Area */}
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-lg border border-white/20">
                  <span className="text-4xl sm:text-5xl">{config.emoji}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-400 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white">
                  ✓
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-1 tracking-tight">
                {config.name}
              </h1>
              <p className="text-base text-white/80 font-medium mb-5">
                {config.age}
              </p>

              {/* Stats */}
              <div className="inline-flex items-center gap-3">
                <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/10">
                  <span className="text-white font-bold">{curriculums.length}</span>
                  <span className="text-white/80 text-sm ml-1">커리큘럼</span>
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/10">
                  <span className="text-white font-bold">{totalLessons}</span>
                  <span className="text-white/80 text-sm ml-1">레슨</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full h-auto">
            <path d="M0 60V30C360 5 720 5 1080 30C1260 42 1350 25 1440 30V60H0Z" className="fill-slate-50" />
          </svg>
        </div>
      </div>

      <main className="px-5 pb-10 -mt-2">
        <div className="max-w-2xl mx-auto">
          {curriculums.length > 0 ? (
            <div className="space-y-8">
              {curriculums.map((curriculum) => (
                <div key={curriculum.id}>
                  {/* Curriculum Header */}
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <div className={`w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center shadow-lg ${config.shadowColor}`}>
                      <span className="text-lg">📖</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-gray-900 line-clamp-1">
                        {curriculum.title}
                      </h2>
                      {curriculum.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">
                          {curriculum.description}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/youth-night/curriculum/${curriculum.id}`}
                      className={`flex-shrink-0 px-3 py-1.5 ${config.bgLight} ${config.textColor} text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity`}
                    >
                      상세 →
                    </Link>
                  </div>

                  {/* Lessons */}
                  {curriculum.lessons.length > 0 ? (
                    <div className="space-y-3">
                      {curriculum.lessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/youth-night/${urlAgeGroup}/lessons/${lesson.id}`}
                          className="block group"
                        >
                          <div className={`relative bg-white rounded-2xl shadow-sm border-2 ${config.borderColor} overflow-hidden transition-all duration-200 active:scale-[0.98] hover:shadow-lg ${config.shadowColor}`}>
                            {/* Left Accent */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${config.gradient}`} />

                            <div className="p-4 pl-5">
                              <div className="flex items-start gap-4">
                                {/* Lesson Number Badge */}
                                <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${config.gradient} rounded-2xl flex items-center justify-center shadow-md transform group-hover:scale-105 transition-transform`}>
                                  <span className="text-white font-bold text-lg">
                                    {lesson.lessonNumber}
                                  </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-gray-900 text-base mb-1.5 line-clamp-2 group-hover:text-gray-700 transition-colors">
                                    {lesson.title}
                                  </h3>

                                  {lesson.bibleVerse && (
                                    <p className={`text-sm ${config.textColor} font-medium mb-1 flex items-center gap-1`}>
                                      <span>📖</span>
                                      <span className="line-clamp-1">{lesson.bibleVerse}</span>
                                    </p>
                                  )}

                                  {lesson.keyPoint && (
                                    <p className="text-sm text-gray-500 mb-2 flex items-start gap-1">
                                      <span>💡</span>
                                      <span className="line-clamp-1">{lesson.keyPoint}</span>
                                    </p>
                                  )}

                                  {/* Tags */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {lesson.questions.length > 0 && (
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 ${config.bgLight} ${config.textColor} text-xs font-bold rounded-full`}>
                                        🧩 퀴즈 {lesson.questions.length}문제
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full">
                                      ✓ 학습 가능
                                    </span>
                                  </div>
                                </div>

                                {/* Arrow */}
                                <div className={`flex-shrink-0 w-10 h-10 ${config.bgLight} rounded-xl flex items-center justify-center self-center transition-all group-hover:translate-x-1`}>
                                  <svg className={`w-5 h-5 ${config.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                      <div className={`w-14 h-14 ${config.bgMedium} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                        <span className="text-2xl">📝</span>
                      </div>
                      <p className="text-gray-500 font-medium">레슨이 준비 중입니다</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
              <div className={`w-24 h-24 bg-gradient-to-br ${config.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl ${config.shadowColor}`}>
                <span className="text-5xl">{config.emoji}</span>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                곧 시작됩니다!
              </h3>
              <p className="text-gray-500 mb-8">
                {config.name}을 위한 새로운 커리큘럼이<br />
                준비 중입니다. 조금만 기다려 주세요!
              </p>

              <Link
                href="/youth-night"
                className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${config.gradient} text-white font-semibold rounded-xl shadow-lg ${config.shadowColor} hover:opacity-90 transition-opacity`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                청나잇 메인으로
              </Link>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="mt-10 flex justify-center">
            <Link
              href="/youth-night"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-600 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98] font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              다른 연령 그룹 보기
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-400">
              Made with 💜 for {config.name}
            </p>
          </div>
        </div>
      </main>
    </GlobalShell>
  );
}
