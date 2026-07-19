'use client';

import GlobalShell from '@/components/layout/GlobalShell';
import { RecurringExpenseForm } from '@/components/recurring-expense/RecurringExpenseForm';

export default function NewRecurringExpensePage() {
  return (
    <GlobalShell title="정기 지출 등록">
      <div className="max-w-5xl mx-auto">
        {/* 설명 */}
        <p className="mb-8 text-gray-600">
          정기적으로 자동 생성될 지출결의서 정보를 입력하세요.
        </p>

        {/* 폼 */}
        <RecurringExpenseForm />
      </div>
    </GlobalShell>
  );
}
