import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 퀴즈 제출 (POST)
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();
    const { lessonId, answers } = body;

    if (!lessonId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다' }, { status: 400 });
    }

    // 레슨과 질문들 조회
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        isActive: true,
        publishedAt: { not: null },
      },
      include: {
        questions: {
          orderBy: { questionNumber: 'asc' },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: '유효하지 않은 레슨입니다' }, { status: 404 });
    }

    // 트랜잭션으로 모든 답안 처리
    const results = await prisma.$transaction(async (tx) => {
      const responseResults = [];

      for (const answer of answers) {
        const { questionId, userAnswer } = answer;

        // 질문 찾기
        const question = lesson.questions.find(q => q.id === questionId);
        if (!question) {
          throw new Error(`Invalid question ID: ${questionId}`);
        }

        // 정답 여부 확인
        const isCorrect = question.correctAnswer === userAnswer;
        const score = isCorrect ? 10 : 0; // 정답 시 10점

        // 기존 응답 확인
        const existingResponse = await tx.quizResponse.findUnique({
          where: {
            userId_questionId: {
              userId: user.id,
              questionId: questionId,
            },
          },
        });

        if (existingResponse) {
          // 기존 응답 업데이트 (재시도 가능)
          const updatedResponse = await tx.quizResponse.update({
            where: {
              userId_questionId: {
                userId: user.id,
                questionId: questionId,
              },
            },
            data: {
              userAnswer,
              isCorrect,
              score,
              submittedAt: new Date(),
            },
          });
          responseResults.push(updatedResponse);
        } else {
          // 새로운 응답 생성
          const newResponse = await tx.quizResponse.create({
            data: {
              userId: user.id,
              questionId,
              userAnswer,
              isCorrect,
              score,
            },
          });
          responseResults.push(newResponse);
        }
      }

      // 퀴즈 포인트 계산 및 부여
      const totalScore = responseResults.reduce((sum, result) => sum + result.score, 0);
      const maxScore = lesson.questions.length * 10;
      const percentage = Math.round((totalScore / maxScore) * 100);

      // 기존 퀴즈 포인트 삭제 (재시도 시)
      await tx.studentPoints.deleteMany({
        where: {
          userId: user.id,
          pointType: { in: ['QUIZ_PERFECT', 'QUIZ_GOOD'] },
          lessonId: lessonId,
        },
      });

      let quizPoints = null;
      let pointsEarned = 0;

      // 포인트 부여 규칙
      if (percentage === 100) {
        // 만점 시 15점
        quizPoints = await tx.studentPoints.create({
          data: {
            userId: user.id,
            pointType: 'QUIZ_PERFECT',
            points: 15,
            description: `${lesson.title} 퀴즈 만점 포인트`,
            lessonId: lessonId,
          },
        });
        pointsEarned = 15;
      } else if (percentage >= 80) {
        // 80% 이상 시 10점
        quizPoints = await tx.studentPoints.create({
          data: {
            userId: user.id,
            pointType: 'QUIZ_GOOD',
            points: 10,
            description: `${lesson.title} 퀴즈 우수 포인트 (${percentage}%)`,
            lessonId: lessonId,
          },
        });
        pointsEarned = 10;
      }

      return {
        responseResults,
        totalScore,
        maxScore,
        percentage,
        pointsEarned,
        quizPoints,
      };
    });

    return NextResponse.json({
      message: '퀴즈가 제출되었습니다',
      results: {
        totalQuestions: lesson.questions.length,
        correctAnswers: results.responseResults.filter(r => r.isCorrect).length,
        totalScore: results.totalScore,
        maxScore: results.maxScore,
        percentage: results.percentage,
        pointsEarned: results.pointsEarned,
      },
      responses: results.responseResults,
    });

  } catch (error) {
    console.error('퀴즈 제출 오류:', error);
    return NextResponse.json({ error: '퀴즈 제출 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
};

// 퀴즈 응답 조회 (GET)
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId가 필요합니다' }, { status: 400 });
    }

    // 해당 레슨의 사용자 퀴즈 응답 조회
    const responses = await prisma.quizResponse.findMany({
      where: {
        userId: user.id,
        question: {
          lessonId: lessonId,
        },
      },
      include: {
        question: {
          select: {
            id: true,
            questionNumber: true,
            questionText: true,
            correctAnswer: true,
            explanation: true,
          },
        },
      },
      orderBy: {
        question: {
          questionNumber: 'asc',
        },
      },
    });

    // 점수 통계 계산
    const totalQuestions = await prisma.question.count({
      where: {
        lessonId: lessonId,
      },
    });

    const totalScore = responses.reduce((sum, response) => sum + response.score, 0);
    const maxScore = totalQuestions * 10;
    const percentage = totalQuestions > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return NextResponse.json({
      responses,
      statistics: {
        totalQuestions,
        answeredQuestions: responses.length,
        correctAnswers: responses.filter(r => r.isCorrect).length,
        totalScore,
        maxScore,
        percentage,
      },
    });

  } catch (error) {
    console.error('퀴즈 응답 조회 오류:', error);
    return NextResponse.json({ error: '퀴즈 응답 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
};

export const POST = withAuth(handlePost);
export const GET = withAuth(handleGet);
