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

interface Attendance {
  id: string;
  attendedAt: Date;
}

interface StudentPoint {
  id: string;
  points: number;
  pointType: string;
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
  attendances: Attendance[];
  studentPoints: StudentPoint[];
}

interface Curriculum {
  id: string;
  title: string;
  description: string | null;
  ageGroup: string;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  lessons: Lesson[];
}

interface Props {
  user: UserInfo;
  curriculum: Curriculum;
  urlAgeGroup: string;
  totalPoints: number;
}

const AGE_GROUP_NAMES: Record<string, string> = {
  KIDS: '유아부 (3-6세)',
  ELEMENTARY: '초등부 (7-12세)',
  MIDDLE: '중등부 (13-15세)',
  HIGH: '고등부 (16-18세)',
  YOUNG_ADULT: '청년부 (19-29세)',
};

const AGE_GROUP_COLORS: Record<string, string> = {
  KIDS: 'bg-pink-500',
  ELEMENTARY: 'bg-blue-500',
  MIDDLE: 'bg-green-500',
  HIGH: 'bg-purple-500',
  YOUNG_ADULT: 'bg-orange-500',
};

const AGE_GROUP_LIGHT_COLORS: Record<string, string> = {
  KIDS: 'bg-pink-50 border-pink-200',
  ELEMENTARY: 'bg-blue-50 border-blue-200',
  MIDDLE: 'bg-green-50 border-green-200',
  HIGH: 'bg-purple-50 border-purple-200',
  YOUNG_ADULT: 'bg-orange-50 border-orange-200',
};

const AGE_GROUP_HOVER_COLORS: Record<string, string> = {
  KIDS: 'hover:bg-pink-100',
  ELEMENTARY: 'hover:bg-blue-100',
  MIDDLE: 'hover:bg-green-100',
  HIGH: 'hover:bg-purple-100',
  YOUNG_ADULT: 'hover:bg-orange-100',
};

export default function CurriculumDetailClient({ user, curriculum, urlAgeGroup, totalPoints }: Props) {
  const ageGroupDisplayName = AGE_GROUP_NAMES[curriculum.ageGroup] || curriculum.ageGroup;
  const colorClass = AGE_GROUP_COLORS[curriculum.ageGroup] || 'bg-gray-500';
  const lightColorClass = AGE_GROUP_LIGHT_COLORS[curriculum.ageGroup] || 'bg-gray-50 border-gray-200';
  const hoverColorClass = AGE_GROUP_HOVER_COLORS[curriculum.ageGroup] || 'hover:bg-gray-100';

  // 공개된 레슨만 필터링
  const publishedLessons = curriculum.lessons.filter(lesson => lesson.publishedAt);

  // 완료된 레슨 수 계산 (출석 체크된 레슨)
  const completedLessons = publishedLessons.filter(lesson => lesson.attendances.length > 0);
  const progressPercent = publishedLessons.length > 0
    ? Math.round((completedLessons.length / publishedLessons.length) * 100)
    : 0;

  // 총 획득 가능 포인트 계산 (대략적)
  const maxPossiblePoints = publishedLessons.length * 30; // 출석 5 + 퀴즈 15 + 암송 10 정도로 예상

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`${PADDING_PAGE} bg-gradient-to-br from-purple-50 to-pink-100`}>
        <div className="max-w-4xl mx-auto">
          {/* 브레드크럼 */}
          <div className="flex items-center text-sm text-gray-600 mb-6">
            <Link href="/youth-night" className="hover:text-gray-900">
              청나잇
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/youth-night/${urlAgeGroup}`} className="hover:text-gray-900">
              {ageGroupDisplayName}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">{curriculum.title}</span>
          </div>

          {/* 커리큘럼 헤더 */}
          <div className={`bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-6 border-l-4 ${lightColorClass}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-10 h-10 ${colorClass} rounded-full flex items-center justify-center`}>
                    <svg
                      className="w-5 h-5 text-white"
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
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${colorClass} text-white`}>
                    {ageGroupDisplayName}
                  </span>
                </div>

                <h1 className={`${TEXT_HERO} text-gray-900 mb-3`}>
                  {curriculum.title}
                </h1>

                {curriculum.description && (
                  <p className="text-base sm:text-lg text-gray-600 mb-4">
                    {curriculum.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {publishedLessons.length}개 레슨 (전체 {curriculum.lessons.length}개)
                  </span>
                  {curriculum.startDate && (
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(curriculum.startDate).toLocaleDateString('ko-KR')}
                      {curriculum.endDate && ` ~ ${new Date(curriculum.endDate).toLocaleDateString('ko-KR')}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 진행 상황 카드 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{progressPercent}%</div>
              <div className="text-xs sm:text-sm text-gray-600">진행률</div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colorClass} transition-all duration-500`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-600">
                {completedLessons.length}/{publishedLessons.length}
              </div>
              <div className="text-xs sm:text-sm text-gray-600">완료 레슨</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600">{totalPoints}</div>
              <div className="text-xs sm:text-sm text-gray-600">획득 포인트</div>
            </div>
          </div>

          {/* 레슨 목록 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <h2 className={`${TEXT_SECTION_TITLE} text-gray-900 mb-4`}>
              레슨 목록
            </h2>

            {curriculum.lessons.length > 0 ? (
              <div className="space-y-3">
                {curriculum.lessons.map((lesson, index) => {
                  const isPublished = lesson.publishedAt !== null;
                  const isCompleted = lesson.attendances.length > 0;
                  const lessonPoints = lesson.studentPoints.reduce((sum, sp) => sum + sp.points, 0);

                  return (
                    <div
                      key={lesson.id}
                      className={`rounded-xl border ${
                        isPublished
                          ? `${lightColorClass} ${hoverColorClass}`
                          : 'bg-gray-100 border-gray-200'
                      } transition-all`}
                    >
                      {isPublished ? (
                        <Link
                          href={`/youth-night/${urlAgeGroup}/lessons/${lesson.id}`}
                          className={`block ${PADDING_CARD}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                                isCompleted ? 'bg-green-500' : colorClass
                              }`}>
                                {isCompleted ? (
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  lesson.lessonNumber
                                )}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500">
                                    레슨 {lesson.lessonNumber}
                                  </span>
                                  {lesson.questions.length > 0 && (
                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                      퀴즈 {lesson.questions.length}문제
                                    </span>
                                  )}
                                  {lessonPoints > 0 && (
                                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                      +{lessonPoints}점
                                    </span>
                                  )}
                                </div>
                                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                  {lesson.title}
                                </h3>
                                {lesson.bibleVerse && (
                                  <p className="text-xs sm:text-sm text-blue-600 mt-1">
                                    {lesson.bibleVerse}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {isCompleted && (
                                <span className="text-xs text-green-600 font-medium">완료</span>
                              )}
                              <svg
                                className="w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <div className={`${PADDING_CARD} opacity-60`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-300 text-gray-500 font-bold">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500">
                                    레슨 {lesson.lessonNumber}
                                  </span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                    준비중
                                  </span>
                                </div>
                                <h3 className="font-semibold text-gray-500 text-sm sm:text-base">
                                  {lesson.title}
                                </h3>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
                <p className="text-gray-500 text-lg">
                  아직 레슨이 준비되지 않았습니다
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  곧 새로운 레슨이 추가될 예정입니다
                </p>
              </div>
            )}
          </div>

          {/* 하단 네비게이션 */}
          <div className="mt-8 flex justify-center space-x-4">
            <Link
              href={`/youth-night/${urlAgeGroup}`}
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
              목록으로 돌아가기
            </Link>
            <Link
              href={`/youth-night/${urlAgeGroup}/ranking`}
              className="inline-flex items-center px-6 py-3 bg-yellow-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
            >
              <span className="mr-2">🏆</span>
              랭킹 보기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
