'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ExpenseForm from '@/components/ExpenseForm';
import Header from '@/components/Header';
import { SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';
import { APPROVED_EDIT_ROLES } from '@/lib/constants/menu-permissions';

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // 지출결의서 정보와 사용자 정보를 함께 조회
        const [expenseRes, userRes] = await Promise.all([
          fetch(`/api/expenses/${id}`),
          fetch('/api/auth/me'),
        ]);

        if (!expenseRes.ok) {
          alert('지출결의서를 찾을 수 없습니다.');
          router.push('/expenses');
          return;
        }

        const data = await expenseRes.json();
        const userData = userRes.ok ? await userRes.json() : null;
        const userRole = userData?.user?.role;

        const basicEditable = ['DRAFT', 'REJECTED', 'WITHDRAWN'];
        const isBasicEditable = basicEditable.includes(data.status);

        // 최종승인 + 지급대기 상태에서는 특정 역할만 수정 가능
        const isApprovedPending = data.status === 'APPROVED_FINAL' && data.paymentStatus === 'PENDING';
        const canEditApprovedPending = isApprovedPending && userRole && APPROVED_EDIT_ROLES.includes(userRole);

        const isEditable = isBasicEditable || canEditApprovedPending;

        if (!isEditable) {
          alert('이 상태에서는 수정할 수 없습니다.');
          router.push(`/expenses/${id}`);
        } else {
          setCanEdit(true);
        }
      } catch {
        alert('오류가 발생했습니다.');
        router.push('/expenses');
      }
    };
    checkStatus();
  }, [id, router]);

  if (canEdit === null) {
    return (
      <div className={`min-h-screen bg-gray-50 ${FLEX_CENTER}`}>
        <div className="text-center">
          <div className={`inline-block ${SPINNER_LG}`}></div>
          <p className="mt-4 text-gray-600">확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">지출결의서 수정</h1>
          <p className="mt-2 text-gray-600">
            지출결의서 정보를 수정하고 저장하세요.
          </p>
        </div>

        {/* 폼 */}
        <ExpenseForm expenseId={id} />
      </div>
    </div>
  );
}
