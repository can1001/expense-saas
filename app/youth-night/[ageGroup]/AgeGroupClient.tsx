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

const AGE_GROUP_HOVER_COLORS = {
  KIDS: 'hover:bg-pink-50',
  ELEMENTARY: 'hover:bg-blue-50',
  MIDDLE: 'hover:bg-green-50',
  HIGH: 'hover:bg-purple-50',
  YOUNG_ADULT: 'hover:bg-orange-50',
};

export default function AgeGroupClient({ user, curriculums, ageGroup, urlAgeGroup }: Props) {
  const ageGroupDisplayName = AGE_GROUP_NAMES[ageGroup as keyof typeof AGE_GROUP_NAMES];
  const colorClass = AGE_GROUP_COLORS[ageGroup as keyof typeof AGE_GROUP_COLORS];
  const hoverColorClass = AGE_GROUP_HOVER_COLORS[ageGroup as keyof typeof AGE_GROUP_HOVER_COLORS];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`${PADDING_PAGE} bg-gradient-to-br from-purple-50 to-pink-100`}>
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className={`text-center ${MARGIN_SECTION}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center justify-center flex-1">
                <Link
                  href="/youth-night"
                  className="text-gray-600 hover:text-gray-800 mr-2"
                >
                  청나잇
                </Link>
                <span className="text-gray-400 mx-2">/</span>
                <span className="text-gray-900 font-medium">{ageGroupDisplayName}</span>
              </div>
              <Link
                href={`/youth-night/${urlAgeGroup}/ranking`}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center space-x-2"
              >
                <span>🏆</span>
                <span className="hidden sm:inline">랭킹</span>
              </Link>
            </div>
            <div className={`w-12 h-12 ${colorClass} rounded-full flex items-center justify-center mx-auto mb-4`}>
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className={`${TEXT_HERO} text-gray-900 mb-2 sm:mb-4`}>
              {ageGroupDisplayName}
            </h1>
            <p className={`${TEXT_SUBTITLE} text-gray-600`}>
              {curriculums.length > 0
                ? `${curriculums.length}개의 커리큘럼으로 함께 성장해요`
                : '곧 새로운 커리큘럼이 시작됩니다'
              }
            </p>
          </div>

          {/* 커리큘럼 목록 */}
          {curriculums.length > 0 ? (
            <div className="space-y-6 sm:space-y-8">
              {curriculums.map((curriculum) => (
                <div key={curriculum.id} className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-2`}>
                          {curriculum.title}
                        </h2>
                        {curriculum.description && (
                          <p className="text-sm sm:text-base text-gray-600 mb-4">
                            {curriculum.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 text-xs sm:text-sm text-gray-500">
                          <span>{curriculum.lessons.length}개 레슨</span>
                          {curriculum.startDate && curriculum.endDate && (
                            <span>
                              {new Date(curriculum.startDate).toLocaleDateString('ko-KR')} - {new Date(curriculum.endDate).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/youth-night/curriculum/${curriculum.id}`}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1"
                      >
                        <span>상세보기</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>

                  {/* 레슨 목록 */}
                  {curriculum.lessons.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {curriculum.lessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/youth-night/${urlAgeGroup}/lessons/${lesson.id}`}
                          className={`group bg-gray-50 rounded-xl ${PADDING_CARD} ${hoverColorClass} hover:shadow-md transition-all hover:-translate-y-1 border border-gray-200`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                  레슨 {lesson.lessonNumber}
                                </span>
                                {lesson.questions.length > 0 && (
                                  <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    퀴즈 {lesson.questions.length}문제
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-2 line-clamp-2">
                                {lesson.title}
                              </h3>
                            </div>
                            <svg
                              className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
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

                          {lesson.bibleVerse && (
                            <p className="text-xs sm:text-sm text-blue-600 mb-2 font-medium">
                              📖 {lesson.bibleVerse}
                            </p>
                          )}

                          {lesson.keyPoint && (
                            <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">
                              💡 {lesson.keyPoint}
                            </p>
                          )}

                          {lesson.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {lesson.description}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              {lesson.publishedAt ? new Date(lesson.publishedAt).toLocaleDateString('ko-KR') : ''}
                            </span>
                            <div className="flex items-center space-x-1">
                              <svg
                                className="w-3 h-3 text-green-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="text-xs text-green-600">학습 가능</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg
                        className="w-12 h-12 text-gray-300 mx-auto mb-4"
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
                      <p className="text-gray-500">
                        아직 레슨이 준비되지 않았습니다
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center">
              <div className={`w-16 h-16 ${colorClass} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <svg
                  className="w-8 h-8 text-white"
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
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                곧 시작됩니다!
              </h3>
              <p className="text-gray-600 mb-6">
                {ageGroupDisplayName}을 위한 새로운 커리큘럼이 준비 중입니다.
                조금만 기다려 주세요!
              </p>
              <Link
                href="/youth-night"
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                청나잇 메인으로 돌아가기
              </Link>
            </div>
          )}

          {/* 하단 네비게이션 */}
          <div className="mt-8 sm:mt-12 text-center">
            <Link
              href="/youth-night"
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              다른 연령 그룹 보러가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}