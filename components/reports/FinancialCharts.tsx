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

// 차트 색상 (다양한 색상, 모든 차트에 동일하게 적용)
const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#10b981', // emerald
  '#eab308', // yellow
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
];

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
  // 수입 차트 데이터 (2레벨 세부 항목, 적립금_해지 제외)
  const incomeChartData = incomeItems
    .filter((item, index, arr) => {
      // 카테고리의 첫 번째 항목(합계)은 제외하고, 세부 항목만 포함
      const firstIndex = arr.findIndex((i) => i.category === item.category);
      return firstIndex !== index;
    })
    .filter((item) => item.itemName !== '적립금_해지')
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

      <div className="flex flex-col gap-8">
        {/* 수입 구성 */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">수입 구성</h3>
          {incomeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={incomeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {incomeChartData.map((_, index) => (
                    <Cell key={`income-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">지출 항목별</h3>
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {expenseChartData.map((_, index) => (
                    <Cell key={`expense-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4 text-center">지출 위원회별</h3>
          {committeeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={committeeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {committeeChartData.map((_, index) => (
                    <Cell key={`committee-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
