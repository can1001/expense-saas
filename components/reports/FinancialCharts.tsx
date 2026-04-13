/**
 * 재정보고서 도넛 차트 컴포넌트
 */

'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { ReportItem, CommitteeExpense } from '@/lib/data/financial-reports/types';
import { formatAmount } from './utils';

interface FinancialChartsProps {
  incomeItems: ReportItem[];
  expenseItems: ReportItem[];
  committeeExpenses: CommitteeExpense[];
}

// 차트 색상
const INCOME_COLORS = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#4ade80', '#86efac', '#bbf7d0'];
const EXPENSE_COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#f87171', '#fca5a5', '#fecaca'];
const COMMITTEE_COLORS = ['#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#818cf8', '#a5b4fc', '#c7d2fe'];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded border border-gray-200">
        <p className="text-sm font-medium text-gray-900">{payload[0].name}</p>
        <p className="text-sm text-gray-700">{formatAmount(payload[0].value)}원</p>
      </div>
    );
  }
  return null;
}

export function FinancialCharts({ incomeItems, expenseItems, committeeExpenses }: FinancialChartsProps) {
  // 수입 차트 데이터 (카테고리별 합계만)
  const incomeChartData = incomeItems
    .filter((item, index, arr) => {
      const firstIndex = arr.findIndex((i) => i.category === item.category);
      return firstIndex === index;
    })
    .map((item) => ({
      name: item.itemName,
      value: item.cumulativeAmount,
    }))
    .filter((item) => item.value > 0);

  // 지출 차트 데이터 (카테고리별 합계만)
  const expenseChartData = expenseItems
    .filter((item, index, arr) => {
      const firstIndex = arr.findIndex((i) => i.category === item.category);
      return firstIndex === index;
    })
    .map((item) => ({
      name: item.itemName,
      value: item.cumulativeAmount,
    }))
    .filter((item) => item.value > 0);

  // 위원회별 지출 차트 데이터
  const committeeChartData = committeeExpenses
    .map((item) => ({
      name: item.committee,
      value: item.amount,
    }))
    .filter((item) => item.value > 0);

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">VI. 재정 현황 차트</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* 수입 구성 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">수입 구성</h3>
          {incomeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={incomeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {incomeChartData.map((_, index) => (
                    <Cell key={`income-cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-10">데이터가 없습니다.</p>
          )}
        </div>

        {/* 지출 항목별 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">지출 항목별</h3>
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expenseChartData.map((_, index) => (
                    <Cell key={`expense-cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-10">데이터가 없습니다.</p>
          )}
        </div>

        {/* 지출 위원회별 */}
        <div className="bg-gray-50 rounded-lg p-4 lg:col-span-2 xl:col-span-1">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">지출 위원회별</h3>
          {committeeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={committeeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {committeeChartData.map((_, index) => (
                    <Cell key={`committee-cell-${index}`} fill={COMMITTEE_COLORS[index % COMMITTEE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-10">데이터가 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
