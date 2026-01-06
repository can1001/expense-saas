import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import HomeClient from '@/components/HomeClient';

export default async function Home() {
  const user = await getCurrentUser();

  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!user) {
    redirect('/login');
  }

  return <HomeClient user={user} />;
}
