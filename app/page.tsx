import { redirect } from 'next/navigation';
import { getCurrentUserSession } from '@/lib/auth/user';
import { withTenantAsync } from '@/lib/tenant-context';
import { prisma } from '@/lib/prisma';
import HomeClient from '@/components/HomeClient';

export default async function Home() {
  const user = await getCurrentUserSession();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  // 현재 연도의 세목 담당자인지 확인
  const currentYear = new Date().getFullYear();

  // 병렬로 모든 카운트 조회 (테넌트 컨텍스트 내에서 실행하여 조직별로 격리)
  const [budgetManagerCount, budgetCount, committeeCount, departmentCount, approverCount] =
    await withTenantAsync({ tenantId: user.tenantId, subdomain: '' }, () =>
      Promise.all([
        prisma.budgetDetailYear.count({
          where: {
            managerId: user.id,
            year: currentYear,
            isActive: true,
          },
        }),
        prisma.budgetDetail.count({ where: { isActive: true } }),
        prisma.committee.count({ where: { isActive: true } }),
        prisma.department.count({ where: { isActive: true } }),
        prisma.userYearRole.groupBy({
          by: ['userId'],
          where: { role: 'team_leader', year: currentYear },
        }).then(result => result.length),
      ])
    );

  const isBudgetManager = budgetManagerCount > 0;

  return (
    <HomeClient
      user={user}
      isBudgetManager={isBudgetManager}
      stats={{ budgetCount, committeeCount, departmentCount, approverCount }}
    />
  );
}
