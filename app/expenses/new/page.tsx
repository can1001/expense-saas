'use client';

import ExpenseForm from '@/components/ExpenseForm';
import Header from '@/components/Header';

export default function NewExpensePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">새 지출결의서 작성</h1>
          <p className="mt-2 text-gray-600">
            지출결의서 정보를 입력하고 저장하세요.
          </p>
        </div>

        {/* 폼 */}
        <ExpenseForm />
      </div>
    </div>
  );
}
