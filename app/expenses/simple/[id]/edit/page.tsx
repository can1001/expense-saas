'use client';

import { useParams } from 'next/navigation';
import SimpleExpenseForm from '@/components/SimpleExpenseForm';
import Header from '@/components/Header';

export default function EditSimpleExpensePage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">지출결의서 수정 (간편)</h1>
          <p className="mt-2 text-gray-600">지출결의서 정보를 수정하세요.</p>
          <p className="mt-1 text-sm text-blue-600">
            예산항목: 하단 예산항목 참조 (Ver.4.1.4)
          </p>
        </div>

        {/* 폼 */}
        <SimpleExpenseForm expenseId={id} />
      </div>
    </div>
  );
}
