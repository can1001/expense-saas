'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';

/**
 * 간편 지출결의서 목록 페이지
 *
 * 간편 지출결의서가 이제 Expense 테이블에 저장되므로,
 * 일반 지출결의서 목록 페이지(/expenses)로 리다이렉트합니다.
 */
export default function SimpleExpensesPage() {
  const router = useRouter();

  useEffect(() => {
    // /expenses 목록으로 리다이렉트
    router.replace('/expenses');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`${FLEX_CENTER} py-20`}>
        <div className="text-center">
          <div className={`inline-block ${SPINNER_LG}`}></div>
          <p className="mt-4 text-gray-600">지출결의서 목록으로 이동 중...</p>
        </div>
      </div>
    </div>
  );
}
