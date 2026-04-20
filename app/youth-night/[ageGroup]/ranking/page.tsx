import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import RankingClient from './RankingClient';

interface PageProps {
  params: Promise<{ ageGroup: string }>;
}

const VALID_AGE_GROUPS = ['kids', 'elementary', 'middle', 'high', 'young_adult'];

const AGE_GROUP_MAPPING = {
  'kids': 'KIDS',
  'elementary': 'ELEMENTARY',
  'middle': 'MIDDLE',
  'high': 'HIGH',
  'young_adult': 'YOUNG_ADULT',
};

export default async function RankingPage({ params }: PageProps) {
  const { ageGroup } = await params;

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

  // 해당 연령 그룹의 커리큘럼 조회 (필터링용)
  const curriculums = await prisma.curriculum.findMany({
    where: {
      isActive: true,
      type: 'YOUTH_NIGHT',
      ageGroup: dbAgeGroup,
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  return (
    <RankingClient
      user={user}
      ageGroup={dbAgeGroup}
      urlAgeGroup={normalizedAgeGroup}
      curriculums={curriculums}
    />
  );
}