import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import LessonDetailClient from './LessonDetailClient';

interface PageProps {
  params: Promise<{ ageGroup: string; lessonId: string }>;
}

const VALID_AGE_GROUPS = ['kids', 'elementary', 'middle', 'high', 'young_adult'];

const AGE_GROUP_MAPPING = {
  'kids': 'KIDS',
  'elementary': 'ELEMENTARY',
  'middle': 'MIDDLE',
  'high': 'HIGH',
  'young_adult': 'YOUNG_ADULT',
};

export default async function LessonDetailPage({ params }: PageProps) {
  const { ageGroup, lessonId } = await params;

  // URL에서 받은 ageGroup을 소문자로 변환
  const normalizedAgeGroup = ageGroup.toLowerCase();

  // 유효한 연령 그룹인지 확인
  if (!VALID_AGE_GROUPS.includes(normalizedAgeGroup)) {
    notFound();
  }

  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  // DB에서 사용하는 enum 값으로 변환
  const dbAgeGroup = AGE_GROUP_MAPPING[normalizedAgeGroup as keyof typeof AGE_GROUP_MAPPING] as any;

  // 레슨 상세 정보 조회
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      isActive: true,
      publishedAt: { not: null },
      curriculum: {
        isActive: true,
        type: 'YOUTH_NIGHT',
        ageGroup: dbAgeGroup,
      },
    },
    include: {
      curriculum: {
        select: {
          id: true,
          title: true,
          ageGroup: true,
        },
      },
      questions: {
        where: {},
        orderBy: {
          questionNumber: 'asc',
        },
      },
    },
  });

  if (!lesson) {
    notFound();
  }

  // 같은 커리큘럼의 다른 레슨들 조회 (네비게이션용)
  const siblingLessons = await prisma.lesson.findMany({
    where: {
      curriculumId: lesson.curriculum.id,
      isActive: true,
      publishedAt: { not: null },
      id: { not: lessonId }, // 현재 레슨 제외
    },
    select: {
      id: true,
      title: true,
      lessonNumber: true,
    },
    orderBy: {
      lessonNumber: 'asc',
    },
  });

  return (
    <LessonDetailClient
      user={user}
      lesson={lesson}
      siblingLessons={siblingLessons}
      ageGroup={dbAgeGroup}
      urlAgeGroup={normalizedAgeGroup}
    />
  );
}