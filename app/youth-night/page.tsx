import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import YouthNightClient from './YouthNightClient';

export default async function YouthNightPage() {
  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  // 활성화된 커리큘럼 조회
  const curriculums = await prisma.curriculum.findMany({
    where: {
      isActive: true,
      type: 'YOUTH_NIGHT',
    },
    include: {
      lessons: {
        where: {
          isActive: true,
          publishedAt: { not: null },
        },
        select: {
          id: true,
          title: true,
          lessonNumber: true,
        },
        orderBy: {
          lessonNumber: 'asc',
        },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  return <YouthNightClient user={user} curriculums={curriculums} />;
}