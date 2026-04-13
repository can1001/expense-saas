/**
 * 수지개황 요약 테이블
 */

import type { SummaryData } from '@/lib/data/financial-reports/types';
import { formatAmount } from './utils';

interface SummaryTableProps {
  summary: SummaryData;
}

export function SummaryTable({ summary }: SummaryTableProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">I. 수지개황</h2>
      <p className="text-sm text-gray-700 mb-3">기 간 : {summary.period}</p>
      <p className="text-right text-sm text-gray-500 mb-2">(단위: 원)</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-3 text-left font-semibold">구분</th>
              <th className="px-4 py-3 text-right font-semibold">전기이월</th>
              <th className="px-4 py-3 text-right font-semibold">수입총계</th>
              <th className="px-4 py-3 text-right font-semibold">지출총계</th>
              <th className="px-4 py-3 text-right font-semibold">차액</th>
              <th className="px-4 py-3 text-right font-semibold">차기이월</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-blue-50 font-semibold">
              <td className="px-4 py-3 text-gray-900">당기누계</td>
              <td className="px-4 py-3 text-right text-gray-900">
                {formatAmount(summary.previousCarryover)}
              </td>
              <td className="px-4 py-3 text-right text-green-600">
                {formatAmount(summary.totalIncome)}
              </td>
              <td className="px-4 py-3 text-right text-red-600">
                {formatAmount(summary.totalExpense)}
              </td>
              <td className={`px-4 py-3 text-right ${summary.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(summary.difference)}
              </td>
              <td className="px-4 py-3 text-right font-bold text-blue-600">
                {formatAmount(summary.nextCarryover)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
