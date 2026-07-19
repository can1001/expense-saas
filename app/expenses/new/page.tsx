'use client';

import ExpenseForm from '@/components/ExpenseForm';
import GlobalShell from '@/components/layout/GlobalShell';

export default function NewExpensePage() {
  return (
    <GlobalShell title="새 지출결의서 작성">
      <div className="max-w-5xl mx-auto">
        <ExpenseForm />
      </div>
    </GlobalShell>
  );
}
