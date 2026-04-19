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
    gradient: 'from-pink-400 to-rose-500',
    gradientBg: 'from-pink-500 via-rose-500 to-pink-600',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200',
  },
  ELEMENTARY: {
    name: '초등부',
    age: '7-12세',
    emoji: '📚',
    gradient: 'from-blue-400 to-indigo-500',
    gradientBg: 'from-blue-500 via-indigo-500 to-blue-600',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  MIDDLE: {
    name: '중등부',
    age: '13-15세',
    emoji: '🎯',
    gradient: 'from-emerald-400 to-teal-500',
    gradientBg: 'from-emerald-500 via-teal-500 to-emerald-600',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
  },
  HIGH: {
    name: '고등부',
    age: '16-18세',
    emoji: '🚀',
    gradient: 'from-violet-400 to-purple-500',
    gradientBg: 'from-violet-500 via-purple-500 to-violet-600',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-200',
  },
  YOUNG_ADULT: {
    name: '청년부',
    age: '19-29세',
    emoji: '💪',
    gradient: 'from-amber-400 to-orange-500',
    gradientBg: 'from-amber-500 via-orange-500 to-amber-600',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
};

export default function AgeGroupClient({ user, curriculums, ageGroup, urlAgeGroup }: Props) {
  const config = AGE_GROUP_CONFIG[ageGroup as keyof typeof AGE_GROUP_CONFIG];
  const totalLessons = curriculums.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hero Section */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${config.gradientBg}`}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 translate-y-1/2" />

        <div className="relative px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
          <div className="max-w-lg mx-auto">
            {/* Back + Ranking */}
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/youth-night"
                className="inline-flex items-center text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">청나잇</span>
              </Link>

              <Link
                href={`/youth-night/${urlAgeGroup}/ranking`}
                className="inline-flex items-center px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full hover:bg-white/30 transition-colors"
              >
                <span className="mr-1">🏆</span>
                <span>랭킹</span>
              </Link>
            </div>

            {/* Title Area */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
                <span className="text-3xl sm:text-4xl">{config.emoji}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {config.name}
              </h1>
              <p className="text-sm sm:text-base text-white/80">
                {config.age}
              </p>

              {/* Stats Pills */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white">
                  {curriculums.length}개 커리큘럼
                </span>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white">
                  {totalLessons}개 레슨
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 40V20C360 0 720 0 1080 20C1260 30 1350 35 1440 20V40H0Z" fill="#f8fafc"/>
          </svg>
        </div>
      </div>

      <main className="px-4 pb-8 sm:px-6 sm:pb-12 -mt-2">
        <div className="max-w-lg mx-auto">
          {curriculums.length > 0 ? (
            <div className="space-y-6">
              {curriculums.map((curriculum) => (
                <div key={curriculum.id}>
                  {/* Curriculum Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {curriculum.title}
                      </h2>
                      {curriculum.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                          {curriculum.description}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/youth-night/curriculum/${curriculum.id}`}
                      className={`flex-shrink-0 text-sm font-medium ${config.textColor}`}
                    >
                      상세 →
                    </Link>
                  </div>

                  {/* Lessons */}
                  {curriculum.lessons.length > 0 ? (
                    <div className="space-y-3">
                      {curriculum.lessons.map((lesson, index) => (
                        <Link
                          key={lesson.id}
                          href={`/youth-night/${urlAgeGroup}/lessons/${lesson.id}`}
                          className="block group"
                        >
                          <div className={`relative bg-white rounded-2xl shadow-sm border ${config.borderColor} overflow-hidden transition-all duration-200 active:scale-[0.98] hover:shadow-md`}>
                            {/* Left accent */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${config.gradient}`} />

                            <div className="p-4 pl-5">
                              <div className="flex items-start gap-3">
                                {/* Lesson Number */}
                                <div className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center shadow-sm`}>
                                  <span className="text-white font-bold text-sm">
                                    {lesson.lessonNumber}
                                  </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-semibold text-gray-900 text-base line-clamp-2">
                                      {lesson.title}
                                    </h3>
                                    <svg
                                      className="flex-shrink-0 w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors mt-0.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>

                                  {/* Bible Verse */}
                                  {lesson.bibleVerse && (
                                    <p className={`text-sm ${config.textColor} mt-1.5 font-medium`}>
                                      📖 {lesson.bibleVerse}
                                    </p>
                                  )}

                                  {/* Key Point */}
                                  {lesson.keyPoint && (
                                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                      💡 {lesson.keyPoint}
                                    </p>
                                  )}

                                  {/* Tags */}
                                  <div className="flex items-center gap-2 mt-3">
                                    {lesson.questions.length > 0 && (
                                      <span className={`inline-flex items-center px-2 py-0.5 ${config.bgLight} ${config.textColor} text-xs font-medium rounded-full`}>
                                        🧩 퀴즈 {lesson.questions.length}문제
                                      </span>
                                    )}
                                    <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
                                      ✓ 학습 가능
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                      <div className={`w-12 h-12 ${config.bgLight} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                        <span className="text-2xl">📝</span>
                      </div>
                      <p className="text-gray-500 text-sm">
                        레슨이 준비 중입니다
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-sm">
              <div className={`w-20 h-20 bg-gradient-to-br ${config.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                <span className="text-4xl">{config.emoji}</span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                곧 시작됩니다!
              </h3>
              <p className="text-gray-500 mb-6">
                {config.name}을 위한 새로운 커리큘럼이<br />
                준비 중입니다. 조금만 기다려 주세요!
              </p>

              <Link
                href="/youth-night"
                className={`inline-flex items-center px-5 py-2.5 ${config.bgLight} ${config.textColor} font-medium rounded-xl transition-colors`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                청나잇 메인으로
              </Link>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/youth-night"
              className="inline-flex items-center px-5 py-3 bg-white text-gray-600 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              다른 연령 그룹 보기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
