'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { TEXT_HERO, TEXT_SUBTITLE, TEXT_SECTION_TITLE, PADDING_PAGE, PADDING_CARD, MARGIN_SECTION } from '@/lib/constants/styles';
import { parseLessonContent, getStepIcon, getStepColorClass, LessonStep } from '@/lib/utils/lesson-parser';
import { FlashcardStudy, FlashcardItem } from '@/components/flashcard';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;
  department?: string | null;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  option4: string | null;
  correctAnswer: string;
  explanation: string | null;
  questionNumber: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  bibleVerse: string | null;
  keyPoint: string | null;
  content: string | null;
  videoUrl: string | null;
  materialUrl: string | null;
  lessonNumber: number;
  publishedAt: Date | null;
  curriculum: {
    id: string;
    title: string;
    ageGroup: string;
  };
  questions: Question[];
}

interface SiblingLesson {
  id: string;
  title: string;
  lessonNumber: number;
}

interface Props {
  user: UserInfo;
  lesson: Lesson;
  siblingLessons: SiblingLesson[];
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

const AGE_GROUP_FLASHCARD_THEMES = {
  KIDS: {
    gradient: 'from-pink-400 via-rose-400 to-pink-500',
    gradientBg: 'from-pink-500 via-rose-500 to-pink-600',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-600',
  },
  ELEMENTARY: {
    gradient: 'from-blue-400 via-indigo-400 to-blue-500',
    gradientBg: 'from-blue-500 via-indigo-500 to-blue-600',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
  },
  MIDDLE: {
    gradient: 'from-emerald-400 via-teal-400 to-emerald-500',
    gradientBg: 'from-emerald-500 via-teal-500 to-emerald-600',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
  },
  HIGH: {
    gradient: 'from-violet-400 via-purple-400 to-violet-500',
    gradientBg: 'from-violet-500 via-purple-500 to-violet-600',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
  },
  YOUNG_ADULT: {
    gradient: 'from-amber-400 via-orange-400 to-amber-500',
    gradientBg: 'from-amber-500 via-orange-500 to-amber-600',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
  },
};

export default function LessonDetailClient({
  user,
  lesson,
  siblingLessons,
  ageGroup,
  urlAgeGroup
}: Props) {
  const [activeTab, setActiveTab] = useState<'lesson' | 'quiz'>('lesson');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isAttended, setIsAttended] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizStats, setQuizStats] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState<number>(0);

  // Step-based learning state
  const [currentStep, setCurrentStep] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Fullscreen reader mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Flashcard study mode
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);

  // Parse lesson content into steps
  const steps = useMemo(() => {
    return parseLessonContent(lesson.content, lesson.bibleVerse, lesson.keyPoint);
  }, [lesson.content, lesson.bibleVerse, lesson.keyPoint]);

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const ageGroupDisplayName = AGE_GROUP_NAMES[ageGroup as keyof typeof AGE_GROUP_NAMES];
  const colorClass = AGE_GROUP_COLORS[ageGroup as keyof typeof AGE_GROUP_COLORS];
  const flashcardTheme = AGE_GROUP_FLASHCARD_THEMES[ageGroup as keyof typeof AGE_GROUP_FLASHCARD_THEMES];

  // Convert questions to flashcard format
  const flashcards: FlashcardItem[] = useMemo(() => {
    return lesson.questions.map((q) => {
      // Get the correct answer text
      const options = [q.option1, q.option2, q.option3, q.option4].filter(Boolean);
      const correctAnswerIndex = parseInt(q.correctAnswer) - 1;
      const correctAnswerText = options[correctAnswerIndex] || q.correctAnswer;

      return {
        id: q.id,
        question: q.questionText,
        answer: correctAnswerText,
        explanation: q.explanation || undefined,
      };
    });
  }, [lesson.questions]);

  // 출석 상태 및 퀴즈 응답 확인
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // 출석 상태 확인
        const attendanceResponse = await fetch(`/api/youth-night/attendance?lessonId=${lesson.id}`);
        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          setIsAttended(!!attendanceData.attendance);
        }

        // 퀴즈 응답 확인
        if (lesson.questions.length > 0) {
          const quizResponse = await fetch(`/api/youth-night/quiz?lessonId=${lesson.id}`);
          if (quizResponse.ok) {
            const quizData = await quizResponse.json();
            if (quizData.responses && quizData.responses.length > 0) {
              setQuizSubmitted(true);
              setShowResults(true);
              setQuizStats(quizData.statistics);

              // 기존 답안 복원
              const existingAnswers: Record<string, string> = {};
              quizData.responses.forEach((response: any) => {
                existingAnswers[response.question.id] = response.userAnswer;
              });
              setQuizAnswers(existingAnswers);
            }
          }
        }

        // 총 포인트 조회
        const pointsResponse = await fetch('/api/youth-night/points?limit=1');
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json();
          setTotalPoints(pointsData.totalPoints || 0);
        }
      } catch (error) {
        console.error('상태 확인 오류:', error);
      }
    };

    checkStatus();
  }, [lesson.id, lesson.questions.length]);

  // Fullscreen mode handlers
  const enterFullscreen = useCallback(async () => {
    try {
      if (fullscreenRef.current) {
        await fullscreenRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      // Fullscreen API not supported, use CSS fallback
      setIsFullscreen(true);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      }
      // Arrow key navigation in fullscreen
      if (isFullscreen) {
        if (e.key === 'ArrowRight' && !isLastStep) {
          setCurrentStep(prev => prev + 1);
          setShowHint(false);
        } else if (e.key === 'ArrowLeft' && !isFirstStep) {
          setCurrentStep(prev => prev - 1);
          setShowHint(false);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, isFirstStep, isLastStep, exitFullscreen]);

  // 출석 체크 처리
  const handleAttendance = async () => {
    if (isAttended || attendanceLoading) return;

    setAttendanceLoading(true);
    try {
      const response = await fetch('/api/youth-night/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId: lesson.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsAttended(true);
        const pointsMessage = data.pointsEarned > 0 ? ` (+${data.pointsEarned} 포인트 획득!)` : '';
        alert((data.message || '출석 체크가 완료되었습니다!') + pointsMessage);

        // 포인트 업데이트
        if (data.pointsEarned > 0) {
          setTotalPoints(prev => prev + data.pointsEarned);
        }
      } else {
        const error = await response.json();
        alert(error.error || '출석 체크에 실패했습니다.');
      }
    } catch (error) {
      console.error('출석 체크 오류:', error);
      alert('출석 체크 중 오류가 발생했습니다.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleQuizAnswer = (questionId: string, answer: string) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitQuiz = async () => {
    if (quizLoading || quizSubmitted) return;

    setQuizLoading(true);
    try {
      // 답안을 API 형식으로 변환
      const answers = Object.entries(quizAnswers).map(([questionId, userAnswer]) => ({
        questionId,
        userAnswer,
      }));

      const response = await fetch('/api/youth-night/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          answers,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowResults(true);
        setQuizSubmitted(true);
        setQuizStats(data.results);

        const pointsMessage = data.results.pointsEarned > 0 ? ` (+${data.results.pointsEarned} 포인트 획득!)` : '';
        alert(`퀴즈 제출 완료! 점수: ${data.results.totalScore}/${data.results.maxScore} (${data.results.percentage}%)${pointsMessage}`);

        // 포인트 업데이트
        if (data.results.pointsEarned > 0) {
          setTotalPoints(prev => prev + data.results.pointsEarned);
        }
      } else {
        const error = await response.json();
        alert(error.error || '퀴즈 제출에 실패했습니다.');
      }
    } catch (error) {
      console.error('퀴즈 제출 오류:', error);
      alert('퀴즈 제출 중 오류가 발생했습니다.');
    } finally {
      setQuizLoading(false);
    }
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setShowResults(false);
    setQuizSubmitted(false);
    setQuizStats(null);
  };

  const getQuizScore = () => {
    if (quizStats) {
      return {
        correct: quizStats.correctAnswers,
        total: quizStats.totalQuestions,
        percentage: quizStats.percentage,
      };
    }

    const totalQuestions = lesson.questions.length;
    const correctAnswers = lesson.questions.filter(q =>
      quizAnswers[q.id] === q.correctAnswer
    ).length;
    return {
      correct: correctAnswers,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
    };
  };

  const score = getQuizScore();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className={`${PADDING_PAGE} bg-gradient-to-br from-purple-50 to-pink-100`}>
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className={`text-center ${MARGIN_SECTION}`}>
            <div className="flex items-center justify-center mb-4 text-sm">
              <Link
                href="/youth-night"
                className="text-gray-600 hover:text-gray-800"
              >
                청나잇
              </Link>
              <span className="text-gray-400 mx-2">/</span>
              <Link
                href={`/youth-night/${urlAgeGroup}`}
                className="text-gray-600 hover:text-gray-800"
              >
                {ageGroupDisplayName}
              </Link>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-900 font-medium">레슨 {lesson.lessonNumber}</span>
            </div>
            <div className={`w-12 h-12 ${colorClass} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <span className="text-white font-bold text-lg">{lesson.lessonNumber}</span>
            </div>
            <h1 className={`${TEXT_HERO} text-gray-900 mb-2 sm:mb-4`}>
              {lesson.title}
            </h1>
            {lesson.bibleVerse && (
              <p className={`${TEXT_SUBTITLE} text-blue-600 font-medium mb-2`}>
                📖 {lesson.bibleVerse}
              </p>
            )}
            {lesson.keyPoint && (
              <p className={`${TEXT_SUBTITLE} text-gray-600`}>
                💡 {lesson.keyPoint}
              </p>
            )}

            {/* 포인트 및 출석 상태 표시 */}
            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                ⭐ {totalPoints} 포인트
              </span>
              {isAttended && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  ✓ 출석 완료
                </span>
              )}
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="bg-white rounded-xl shadow-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('lesson')}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                    activeTab === 'lesson'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📖 레슨 내용
                </button>
                {lesson.questions.length > 0 && (
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                      activeTab === 'quiz'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🧩 퀴즈 ({lesson.questions.length}문제)
                  </button>
                )}
              </nav>
            </div>

            <div className={PADDING_CARD}>
              {activeTab === 'lesson' && (
                <div className="space-y-6">
                  {/* 집중 모드 버튼 */}
                  <div className="flex justify-end">
                    <button
                      onClick={enterFullscreen}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      집중 모드
                    </button>
                    {flashcards.length > 0 && (
                      <button
                        onClick={() => setIsFlashcardMode(true)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r ${flashcardTheme.gradient} rounded-lg hover:opacity-90 transition-all shadow-sm`}
                      >
                        <span>🃏</span>
                        플래시카드
                      </button>
                    )}
                  </div>

                  {/* 진행 바 */}
                  {steps.length > 1 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                          Step {currentStep + 1} / {steps.length}
                        </span>
                        <span className="text-sm text-gray-500">
                          {currentStepData?.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {steps.map((_, index) => (
                          <div
                            key={index}
                            className={`h-2 flex-1 rounded-full transition-colors cursor-pointer ${
                              index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                            }`}
                            onClick={() => {
                              setCurrentStep(index);
                              setShowHint(false);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 현재 Step 내용 */}
                  {currentStepData && (
                    <div className={`p-6 rounded-xl border-2 ${getStepColorClass(currentStepData.type)}`}>
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-2xl">{getStepIcon(currentStepData.type)}</span>
                        {currentStepData.title}
                      </h3>

                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-lg">
                          {currentStepData.content}
                        </div>
                      </div>

                      {/* 힌트 토글 (질문 타입일 때만) */}
                      {currentStepData.type === 'question' && currentStepData.hint && (
                        <div className="mt-6">
                          <button
                            onClick={() => setShowHint(!showHint)}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
                          >
                            <span className="mr-2">{showHint ? '🔒' : '💡'}</span>
                            {showHint ? '힌트 숨기기' : '힌트 보기'}
                          </button>

                          {showHint && (
                            <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200 shadow-sm">
                              <p className="text-gray-600 italic whitespace-pre-wrap">
                                {currentStepData.hint}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 마지막 Step에서 출석 체크 버튼 */}
                      {isLastStep && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <button
                            onClick={handleAttendance}
                            disabled={isAttended || attendanceLoading}
                            className={`w-full inline-flex items-center justify-center px-6 py-4 rounded-xl font-medium text-lg transition-all transform ${
                              isAttended
                                ? 'bg-green-100 text-green-800 cursor-not-allowed'
                                : attendanceLoading
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                            }`}
                          >
                            {attendanceLoading ? (
                              <>
                                <svg
                                  className="animate-spin -ml-1 mr-3 h-5 w-5"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                처리 중...
                              </>
                            ) : isAttended ? (
                              <>
                                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                레슨 완료!
                              </>
                            ) : (
                              <>
                                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                레슨 완료하기
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 네비게이션 버튼 */}
                  {steps.length > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <button
                        onClick={() => {
                          setCurrentStep(prev => Math.max(0, prev - 1));
                          setShowHint(false);
                        }}
                        disabled={isFirstStep}
                        className={`inline-flex items-center px-5 py-3 rounded-xl font-medium transition-all ${
                          isFirstStep
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                        }`}
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        이전
                      </button>

                      <button
                        onClick={() => {
                          setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
                          setShowHint(false);
                        }}
                        disabled={isLastStep}
                        className={`inline-flex items-center px-5 py-3 rounded-xl font-medium transition-all ${
                          isLastStep
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                        }`}
                      >
                        다음
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* 비디오/교재 자료 링크 (접혀있는 섹션으로) */}
                  {(lesson.videoUrl || lesson.materialUrl) && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                      <h4 className="text-sm font-semibold text-gray-600 mb-3">추가 자료</h4>
                      <div className="flex flex-wrap gap-3">
                        {lesson.videoUrl && (
                          <a
                            href={lesson.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors text-sm"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            영상 보기
                          </a>
                        )}
                        {lesson.materialUrl && (
                          <a
                            href={lesson.materialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors text-sm"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            교재 다운로드
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'quiz' && lesson.questions.length > 0 && (
                <div className="space-y-6">
                  {/* Flashcard Study Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsFlashcardMode(true)}
                      className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${flashcardTheme.gradient} text-white font-semibold rounded-2xl shadow-lg hover:opacity-90 transition-all active:scale-[0.98]`}
                    >
                      <span className="text-xl">🃏</span>
                      <span>플래시카드로 학습하기</span>
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-white text-sm text-gray-500">또는 퀴즈 풀기</span>
                    </div>
                  </div>

                  {showResults && (
                    <div className={`p-4 rounded-lg mb-6 ${
                      score.correct === score.total
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <h3 className="font-semibold mb-2">
                        퀴즈 결과: {score.correct} / {score.total} ({score.percentage}%)
                        {quizStats && ` - 점수: ${quizStats.totalScore}/${quizStats.maxScore}`}
                      </h3>
                      <div className="flex space-x-2">
                        {!quizSubmitted && (
                          <button
                            onClick={resetQuiz}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            다시 풀기
                          </button>
                        )}
                        {quizSubmitted && (
                          <span className="text-sm text-green-600 font-medium">
                            ✓ 제출 완료
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {lesson.questions.map((question) => {
                    const userAnswer = quizAnswers[question.id];
                    const isCorrect = showResults && userAnswer === question.correctAnswer;
                    const isIncorrect = showResults && userAnswer && userAnswer !== question.correctAnswer;

                    return (
                      <div
                        key={question.id}
                        className={`p-4 rounded-lg border ${
                          showResults
                            ? isCorrect
                              ? 'bg-green-50 border-green-200'
                              : isIncorrect
                              ? 'bg-red-50 border-red-200'
                              : 'bg-gray-50 border-gray-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <h4 className="font-semibold text-gray-900 mb-3">
                          Q{question.questionNumber}. {question.questionText}
                        </h4>

                        {question.questionType === 'MULTIPLE_CHOICE' && (
                          <div className="space-y-2">
                            {[
                              { value: '1', text: question.option1 },
                              { value: '2', text: question.option2 },
                              { value: '3', text: question.option3 },
                              { value: '4', text: question.option4 },
                            ].filter(option => option.text).map((option) => {
                              const isSelected = userAnswer === option.value;
                              const isCorrectOption = question.correctAnswer === option.value;

                              return (
                                <label
                                  key={option.value}
                                  className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                    showResults
                                      ? isCorrectOption
                                        ? 'bg-green-100'
                                        : isSelected && !isCorrectOption
                                        ? 'bg-red-100'
                                        : 'bg-white'
                                      : isSelected
                                      ? 'bg-blue-50 border border-blue-200'
                                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.value}
                                    checked={isSelected}
                                    onChange={(e) => handleQuizAnswer(question.id, e.target.value)}
                                    disabled={showResults}
                                    className="text-blue-600"
                                  />
                                  <span className={`${
                                    showResults && isCorrectOption
                                      ? 'font-semibold text-green-800'
                                      : showResults && isSelected && !isCorrectOption
                                      ? 'text-red-800'
                                      : 'text-gray-700'
                                  }`}>
                                    {option.text}
                                  </span>
                                  {showResults && isCorrectOption && (
                                    <span className="text-green-600 ml-auto">✓</span>
                                  )}
                                  {showResults && isSelected && !isCorrectOption && (
                                    <span className="text-red-600 ml-auto">✗</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {showResults && question.explanation && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>해설:</strong> {question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!showResults && (
                    <button
                      onClick={submitQuiz}
                      disabled={Object.keys(quizAnswers).length !== lesson.questions.length || quizLoading}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {quizLoading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          제출 중...
                        </>
                      ) : (
                        '퀴즈 제출하기'
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 다른 레슨 네비게이션 */}
          {siblingLessons.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                이 시리즈의 다른 레슨
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {siblingLessons.map((siblingLesson) => (
                  <Link
                    key={siblingLesson.id}
                    href={`/youth-night/${urlAgeGroup}/lessons/${siblingLesson.id}`}
                    className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 mr-3">
                      {siblingLesson.lessonNumber}
                    </span>
                    <span className="text-sm text-gray-700 font-medium truncate">
                      {siblingLesson.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 하단 네비게이션 */}
          <div className="mt-8 flex justify-center">
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
              {ageGroupDisplayName} 목록으로 돌아가기
            </Link>
          </div>
        </div>
      </main>

      {/* 풀스크린 집중 모드 */}
      <div
        ref={fullscreenRef}
        className={`${
          isFullscreen ? 'fixed inset-0 z-50 flex flex-col' : 'hidden'
        } bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`}
      >
        {/* 상단 바 */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/20">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${colorClass} rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">{lesson.lessonNumber}</span>
            </div>
            <h2 className="text-white font-semibold text-lg">{lesson.title}</h2>
          </div>
          <button
            onClick={exitFullscreen}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="집중 모드 종료 (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 진행 표시 */}
        {steps.length > 1 && (
          <div className="px-6 py-3">
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentStep(index);
                    setShowHint(false);
                  }}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    index === currentStep
                      ? 'bg-white'
                      : index < currentStep
                        ? 'bg-white/50'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-white/60">
              <span>Step {currentStep + 1} / {steps.length}</span>
              <span>{currentStepData?.title}</span>
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div className="flex-1 overflow-auto px-6 py-8">
          <div className="max-w-3xl mx-auto">
            {currentStepData && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">{getStepIcon(currentStepData.type)}</span>
                  <h3 className="text-2xl font-bold text-white">{currentStepData.title}</h3>
                </div>

                <div className="text-white/90 text-xl leading-relaxed whitespace-pre-wrap">
                  {currentStepData.content}
                </div>

                {/* 힌트 (질문 타입) */}
                {currentStepData.type === 'question' && currentStepData.hint && (
                  <div className="mt-8">
                    <button
                      onClick={() => setShowHint(!showHint)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <span className="mr-2">{showHint ? '🔒' : '💡'}</span>
                      {showHint ? '힌트 숨기기' : '힌트 보기'}
                    </button>

                    {showHint && (
                      <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                        <p className="text-white/70 italic whitespace-pre-wrap">
                          {currentStepData.hint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 마지막 Step에서 출석 체크 버튼 */}
                {isLastStep && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <button
                      onClick={handleAttendance}
                      disabled={isAttended || attendanceLoading}
                      className={`w-full inline-flex items-center justify-center px-6 py-4 rounded-xl font-medium text-lg transition-all ${
                        isAttended
                          ? 'bg-green-500/20 text-green-300 cursor-not-allowed'
                          : attendanceLoading
                          ? 'bg-white/10 text-white/50 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg'
                      }`}
                    >
                      {attendanceLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          처리 중...
                        </>
                      ) : isAttended ? (
                        <>✓ 레슨 완료!</>
                      ) : (
                        <>레슨 완료하기</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-6 py-4 bg-black/20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentStep(prev => Math.max(0, prev - 1));
                setShowHint(false);
              }}
              disabled={isFirstStep}
              className={`inline-flex items-center px-5 py-3 rounded-xl font-medium transition-all ${
                isFirstStep
                  ? 'text-white/30 cursor-not-allowed'
                  : 'text-white bg-white/10 hover:bg-white/20'
              }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              이전
            </button>

            <div className="text-white/50 text-sm">
              ← → 화살표 키로 이동
            </div>

            <button
              onClick={() => {
                setCurrentStep(prev => Math.min(steps.length - 1, prev + 1));
                setShowHint(false);
              }}
              disabled={isLastStep}
              className={`inline-flex items-center px-5 py-3 rounded-xl font-medium transition-all ${
                isLastStep
                  ? 'text-white/30 cursor-not-allowed'
                  : 'text-white bg-white/10 hover:bg-white/20'
              }`}
            >
              다음
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Flashcard Study Mode */}
      {isFlashcardMode && flashcards.length > 0 && (
        <FlashcardStudy
          cards={flashcards}
          title={`${lesson.title} - 플래시카드`}
          colorTheme={flashcardTheme}
          onClose={() => setIsFlashcardMode(false)}
          onComplete={(results) => {
            console.log('Flashcard study complete:', results);
          }}
        />
      )}
    </div>
  );
}