'use client';

import SimpleExpenseWizard from '@/components/simple-expense-form/SimpleExpenseWizard';
import GlobalShell from '@/components/layout/GlobalShell';

export default function NewSimpleExpensePage() {
  return (
    <GlobalShell title="간편 지출결의서">
      <div className="max-w-3xl mx-auto">
        <SimpleExpenseWizard />
      </div>
    </GlobalShell>
  );
}
