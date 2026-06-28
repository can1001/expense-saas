'use client';

import SimpleExpenseWizard from '@/components/simple-expense-form/SimpleExpenseWizard';
import Header from '@/components/Header';

export default function NewSimpleExpensePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            간편 지출결의서
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            2단계로 빠르게 지출결의서를 작성하세요
          </p>
        </div>

        {/* 마법사 폼 */}
        <SimpleExpenseWizard />
      </div>
    </div>
  );
}
