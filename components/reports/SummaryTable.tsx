/**
 * 수지개황 요약 테이블
 */

import type { SummaryData } from '@/lib/data/financial-reports/types';
import { formatAmount } from './utils';

interface SummaryTableProps {
  summary: SummaryData;
}

export function SummaryTable({ summary }: SummaryTableProps) {
  const prevYear = summary.prevYear;

  // 전년 대비 증감 계산
  const incomeDiff = prevYear ? summary.totalIncome - prevYear.totalIncome : 0;
  const expenseDiff = prevYear ? summary.totalExpense - prevYear.totalExpense : 0;

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
              <th className="px-4 py-3 text-right font-semibold">차기이월</th>
            </tr>
          </thead>
          <tbody>
            {/* 당기누계 */}
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
              <td className="px-4 py-3 text-right font-bold text-blue-600">
                {formatAmount(summary.nextCarryover)}
              </td>
            </tr>

            {/* 전년(동분기)누계 */}
            {prevYear && (
              <tr className="border-b bg-yellow-50">
                <td className="px-4 py-3 text-gray-900">전년(동분기)누계</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatAmount(prevYear.previousCarryover)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatAmount(prevYear.totalIncome)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatAmount(prevYear.totalExpense)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatAmount(prevYear.nextCarryover)}
                </td>
              </tr>
            )}

            {/* 전년 대비 증감 */}
            {prevYear && (
              <tr className="bg-gray-100 font-medium">
                <td className="px-4 py-3 text-gray-900">전년 대비 증감</td>
                <td className="px-4 py-3 text-right text-gray-400">-</td>
                <td className={`px-4 py-3 text-right ${incomeDiff >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {incomeDiff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(incomeDiff))}
                </td>
                <td className={`px-4 py-3 text-right ${expenseDiff >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {expenseDiff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(expenseDiff))}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">-</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 주석 */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm font-semibold text-amber-800">
          ※ 전년은 예산외수입과 예산외지출을 제외한 순수한 수입과 지출 금액
        </p>
      </div>
    </section>
  );
}
