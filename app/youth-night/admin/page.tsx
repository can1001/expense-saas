import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import YouthNightAdminClient from './YouthNightAdminClient';

export default async function YouthNightAdminPage() {
  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  // 관리자/교사 권한 확인 (admin, finance_head, accountant, team_leader)
  const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
  if (!ALLOWED_ROLES.includes(user.role)) {
    redirect('/youth-night');
  }

  // 모든 커리큘럼 조회 (비활성 포함)
  const curriculums = await prisma.curriculum.findMany({
    where: {
      type: 'YOUTH_NIGHT',
    },
    include: {
      lessons: {
        select: {
          id: true,
          title: true,
          lessonNumber: true,
          isActive: true,
          publishedAt: true,
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

  return <YouthNightAdminClient user={user} curriculums={curriculums} />;
}