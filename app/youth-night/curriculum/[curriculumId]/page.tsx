import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CurriculumDetailClient from './CurriculumDetailClient';

interface PageProps {
  params: Promise<{ curriculumId: string }>;
}

export default async function CurriculumDetailPage({ params }: PageProps) {
  const { curriculumId } = await params;

  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  // 커리큘럼 조회 (레슨 포함)
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    include: {
      lessons: {
        where: {
          isActive: true,
        },
        include: {
          questions: {
            select: {
              id: true,
              questionNumber: true,
            },
            orderBy: {
              questionNumber: 'asc',
            },
          },
          attendances: {
            where: {
              userId: user.id,
            },
            select: {
              id: true,
              attendedAt: true,
            },
          },
          studentPoints: {
            where: {
              userId: user.id,
            },
            select: {
              id: true,
              points: true,
              pointType: true,
            },
          },
        },
        orderBy: {
          lessonNumber: 'asc',
        },
      },
    },
  });

  if (!curriculum) {
    notFound();
  }

  // 사용자의 총 포인트 계산
  const userPoints = await prisma.studentPoints.aggregate({
    where: {
      userId: user.id,
      lesson: {
        curriculumId: curriculum.id,
      },
    },
    _sum: {
      points: true,
    },
  });

  // URL용 연령 그룹 변환
  const urlAgeGroup = curriculum.ageGroup.toLowerCase().replace('_', '_');

  return (
    <CurriculumDetailClient
      user={user}
      curriculum={curriculum}
      urlAgeGroup={urlAgeGroup}
      totalPoints={userPoints._sum.points || 0}
    />
  );
}
