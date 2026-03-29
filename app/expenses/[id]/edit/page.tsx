'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ExpenseForm from '@/components/ExpenseForm';
import Header from '@/components/Header';
import { SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/expenses/${id}`);
        if (res.ok) {
          const data = await res.json();
          const basicEditable = ['DRAFT', 'REJECTED', 'WITHDRAWN'];
          // 기본 수정 가능 상태이거나, 최종승인 + 지급대기 상태
          const isEditable = basicEditable.includes(data.status) ||
            (data.status === 'APPROVED_FINAL' && data.paymentStatus === 'PENDING');
          if (!isEditable) {
            alert('이 상태에서는 수정할 수 없습니다.');
            router.push(`/expenses/${id}`);
          } else {
            setCanEdit(true);
          }
        } else {
          alert('지출결의서를 찾을 수 없습니다.');
          router.push('/expenses');
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
