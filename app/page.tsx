import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import HomeClient from '@/components/HomeClient';

export default async function Home() {
  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  // 현재 연도의 세목 담당자인지 확인
  const currentYear = new Date().getFullYear();
  const budgetManagerCount = await prisma.budgetDetailYear.count({
    where: {
      managerId: user.id,
      year: currentYear,
      isActive: true,
    },
  });
  const isBudgetManager = budgetManagerCount > 0;

  return <HomeClient user={user} isBudgetManager={isBudgetManager} />;
}
