'use client';

import { useEffect, useState } from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { SkeletonText } from '@/components/ui/Skeleton';
import { getFiscalYear } from '@/lib/utils/fiscal-year';

interface Department {
  id: string;
  name: string;
  budget: number;
  spent: number;
  executionRate: number;
}

interface Committee {
  id: string;
  name: string;
  departments: Department[];
}

interface BudgetExecutionResponse {
  committees: Committee[];
}

const WARN_THRESHOLD = 90;

export default function DepartmentBudgetPanel() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/budget-execution?year=${getFiscalYear()}`);
        if (!res.ok) throw new Error('요청 실패');
        const json: BudgetExecutionResponse = await res.json();
        const flattened = (json.committees ?? []).flatMap((committee) => committee.departments ?? []);
        if (!cancelled) setDepartments(flattened);
      } catch {
        if (!cancelled) setError('부서별 예산 집행 현황을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-border bg-white p-4 shadow-sm">
        <SkeletonText lines={5} />
      </div>
    );
  }

  if (error || !departments) {
    return (
      <div className="rounded-2xl border border-surface-border bg-white p-4 shadow-sm">
        <p className="text-sm text-status-rejected">
          {error ?? '부서별 예산 집행 현황을 불러오지 못했습니다.'}
        </p>
      </div>
    );
  }

  const overBudgetDepartments = departments.filter((dept) => dept.executionRate >= WARN_THRESHOLD);

  return (
    <div className="rounded-2xl border border-surface-border bg-white shadow-sm">
      <div className="border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">부서별 예산 집행</h2>
      </div>
      <div className="space-y-4 px-4 py-3">
        {departments.length === 0 ? (
          <p className="text-sm text-gray-400">부서별 예산 데이터가 없습니다.</p>
        ) : (
          departments.map((dept) => (
            <div key={dept.id} className="space-y-1">
              <div className="text-sm text-gray-900">{dept.name}</div>
              <ProgressBar
                value={dept.executionRate}
                warnThreshold={WARN_THRESHOLD}
                label={`${dept.name} 예산 집행률`}
              />
            </div>
          ))
        )}
      </div>
      {overBudgetDepartments.length > 0 && (
        <div className="space-y-1 border-t border-surface-border px-4 py-3">
          {overBudgetDepartments.map((dept) => (
            <p
              key={dept.id}
              className="rounded-lg bg-status-pending-bg px-3 py-2 text-xs font-medium text-status-pending"
            >
              ⚠ {dept.name} 예산 90% 초과
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
