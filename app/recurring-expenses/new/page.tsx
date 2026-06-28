'use client';

import Header from '@/components/Header';
import { RecurringExpenseForm } from '@/components/recurring-expense/RecurringExpenseForm';

export default function NewRecurringExpensePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">자동이체 등록</h1>
          <p className="mt-2 text-gray-600">
            정기적으로 자동 생성될 지출결의서 정보를 입력하세요.
          </p>
        </div>

        {/* 폼 */}
        <RecurringExpenseForm />
      </div>
    </div>
  );
}
