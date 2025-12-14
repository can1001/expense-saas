'use client';

import SimpleExpenseForm from '@/components/SimpleExpenseForm';
import Header from '@/components/Header';

export default function NewSimpleExpensePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">새 지출결의서 작성 (간편)</h1>
          <p className="mt-2 text-gray-600">
            항목별로 예산을 선택하여 지출결의서를 작성하세요.
          </p>
          <p className="mt-1 text-sm text-blue-600">
            예산항목: 하단 예산항목 참조 (Ver.4.1.4)
          </p>
        </div>

        {/* 폼 */}
        <SimpleExpenseForm />
      </div>
    </div>
  );
}
