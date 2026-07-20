'use client';

import { useCallback, useEffect, useState } from 'react';
import GlobalShell from '@/components/layout/GlobalShell';
import ReceiptGallery, { ReceiptItem } from '@/components/receipts/ReceiptGallery';
import MissingReceiptList, { MissingReceiptExpense } from '@/components/receipts/MissingReceiptList';
import { ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { SELECT_BASE, INPUT_BASE, TAB_ACTIVE, TAB_INACTIVE, ALERT_ERROR } from '@/lib/constants/styles';

type Tab = 'gallery' | 'missing';

const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '1차 결재대기' },
  { value: 'APPROVED_STEP_1', label: '2차 결재대기' },
  { value: 'APPROVED_STEP_2', label: '3차 결재대기' },
  { value: 'APPROVED_FINAL', label: '최종승인' },
  { value: 'REJECTED', label: '반려' },
];

export default function ReceiptsPage() {
  const [tab, setTab] = useState<Tab>('gallery');
  const [month, setMonth] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [missing, setMissing] = useState<MissingReceiptExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/expenses/filter-options')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => {
        // 옵션 조회 실패는 무시 (드롭다운만 빈 상태)
      });
  }, []);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (department) params.set('department', department);
    return params;
  }, [month, department]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (tab === 'gallery') {
          const params = buildParams();
          if (status) params.set('status', status);
          const res = await fetch(`/api/receipts?${params}`, { signal: controller.signal });
          if (!res.ok) throw new Error('영수증 목록을 불러오는데 실패했습니다.');
          const data = await res.json();
          setReceipts(data.receipts ?? []);
        } else {
          const params = buildParams();
          const res = await fetch(`/api/receipts/missing?${params}`, { signal: controller.signal });
          if (!res.ok) throw new Error('미첨부 현황을 불러오는데 실패했습니다.');
          const data = await res.json();
          const expenses: MissingReceiptExpense[] = data.expenses ?? [];
          setMissing(status ? expenses.filter((e) => e.status === status) : expenses);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [tab, buildParams, status]);

  return (
    <GlobalShell title="영수증 관리">
      <div className="max-w-5xl mx-auto">
        <p className="mb-6 text-gray-600">
          결의서를 열지 않고도 영수증을 모아보고, 미첨부 결의서를 확인할 수 있습니다.
        </p>

        {/* 필터 바 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={INPUT_BASE}
            aria-label="기간(월)"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={SELECT_BASE}
            aria-label="부서"
          >
            <option value="">전체 부서</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={SELECT_BASE}
            aria-label="결재상태"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 세그먼트 탭 */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => setTab('gallery')}
            className={tab === 'gallery' ? TAB_ACTIVE : TAB_INACTIVE}
          >
            영수증 갤러리
          </button>
          <button
            type="button"
            onClick={() => setTab('missing')}
            className={tab === 'missing' ? TAB_ACTIVE : TAB_INACTIVE}
          >
            미첨부 현황
          </button>
        </div>

        {error && <div className={`${ALERT_ERROR} mb-4`}>{error}</div>}

        {isLoading && <ExpenseListSkeleton count={5} />}

        {!isLoading && !error && tab === 'gallery' && <ReceiptGallery receipts={receipts} />}
        {!isLoading && !error && tab === 'missing' && <MissingReceiptList expenses={missing} />}
      </div>
    </GlobalShell>
  );
}
