'use client';

import { useParams } from 'next/navigation';
import SimpleExpenseForm from '@/components/SimpleExpenseForm';
import GlobalShell from '@/components/layout/GlobalShell';

export default function EditSimpleExpensePage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <GlobalShell title="지출결의서 수정 (간편)">
      <div className="max-w-5xl mx-auto">
        <p className="mb-8 text-sm text-blue-600">
          예산항목: 하단 예산항목 참조 (Ver.4.1.4)
        </p>

        {/* 폼 */}
        <SimpleExpenseForm expenseId={id} />
      </div>
    </GlobalShell>
  );
}
