/**
 * 지출부 상세 테이블
 */

'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { ReportItem } from '@/lib/data/financial-reports/types';
import { formatAmount, formatDiff, formatRate } from './utils';

interface ExpenseTableProps {
  items: ReportItem[];
  totalExpense: number;
}

export function ExpenseTable({ items, totalExpense }: ExpenseTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 카테고리별 그룹화
  const categories = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ReportItem[]>);

  // 카테고리 합계 계산 (첫 번째 항목이 카테고리 합계)
  const categoryTotals = Object.entries(categories).map(([category, categoryItems]) => {
    const totalItem = categoryItems[0]; // 첫 번째 항목이 카테고리 합계
    const subItems = categoryItems.slice(1); // 나머지가 세부 항목
    return {
      category,
      total: totalItem,
      subItems,
    };
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(Object.keys(categories)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // 전체 합계 계산
  const totals = categoryTotals.reduce(
    (acc, { total }) => ({
      budgetAmount: acc.budgetAmount + total.budgetAmount,
      cumulativeAmount: acc.cumulativeAmount + total.cumulativeAmount,
      previousYearAmount: acc.previousYearAmount + (total.previousYearAmount || 0),
    }),
    { budgetAmount: 0, cumulativeAmount: 0, previousYearAmount: 0 }
  );

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">III. 지출 현황</h2>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
          >
            전체 펼치기
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
          >
            전체 접기
          </button>
        </div>
      </div>
      <p className="text-right text-sm text-gray-500 mb-2">(단위: 원)</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-3 text-left font-semibold min-w-[180px]">항목</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[100px]">예산액</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[100px]">당기</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[100px]">누계</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[80px]">진척률</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[100px]">전년 누계</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[120px]">전년비교</th>
            </tr>
          </thead>
          <tbody>
            {categoryTotals.map(({ category, total, subItems }) => {
              const isExpanded = expandedCategories.has(category);
              const diff = formatDiff(total.cumulativeAmount, total.previousYearAmount);
              const expenseRatio = totalExpense > 0 ? (total.cumulativeAmount / totalExpense * 100) : 0;
              const isOverBudget = total.executionRate > 100;

              return (
                <>
                  {/* 카테고리 헤더 행 */}
                  <tr
                    key={total.id}
                    className="bg-blue-50 font-semibold cursor-pointer hover:bg-blue-100"
                    onClick={() => subItems.length > 0 && toggleCategory(category)}
                  >
                    <td className="px-3 py-2.5 text-gray-900">
                      <span className="inline-flex items-center gap-1">
                        {subItems.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )
                        ) : (
                          <span className="w-4" />
                        )}
                        {total.itemName}
                        <span className="text-gray-500 text-xs ml-1">({expenseRatio.toFixed(0)}%)</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{formatAmount(total.budgetAmount)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{formatAmount(total.currentAmount)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900">{formatAmount(total.cumulativeAmount)}</td>
                    <td className={`px-3 py-2.5 text-right ${isOverBudget ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                      {formatRate(total.executionRate)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 bg-yellow-50">
                      {total.previousYearAmount !== undefined ? formatAmount(total.previousYearAmount) : '-'}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${diff.isIncrease ? 'text-red-600' : 'text-blue-600'}`}>
                      {diff.text}
                    </td>
                  </tr>

                  {/* 세부 항목 행 */}
                  {isExpanded &&
                    subItems.map((item) => {
                      const itemDiff = formatDiff(item.cumulativeAmount, item.previousYearAmount);
                      const itemOverBudget = item.executionRate > 100;
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 pl-8 text-gray-700">ㄴ {item.itemName}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatAmount(item.budgetAmount)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatAmount(item.currentAmount)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatAmount(item.cumulativeAmount)}</td>
                          <td className={`px-3 py-2 text-right ${itemOverBudget ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatRate(item.executionRate)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 bg-yellow-50">
                            {item.previousYearAmount !== undefined ? formatAmount(item.previousYearAmount) : '-'}
                          </td>
                          <td className={`px-3 py-2 text-right ${itemDiff.isIncrease ? 'text-red-600' : 'text-blue-600'}`}>
                            {itemDiff.text}
                          </td>
                        </tr>
                      );
                    })}
                </>
              );
            })}

            {/* 합계 행 */}
            <tr className="bg-red-100 font-bold">
              <td className="px-3 py-3 text-gray-900">합계</td>
              <td className="px-3 py-3 text-right text-gray-900">{formatAmount(totals.budgetAmount)}</td>
              <td className="px-3 py-3 text-right text-gray-900">-</td>
              <td className="px-3 py-3 text-right text-red-700">{formatAmount(totals.cumulativeAmount)}</td>
              <td className="px-3 py-3 text-right text-gray-900">
                {totals.budgetAmount > 0 ? formatRate((totals.cumulativeAmount / totals.budgetAmount) * 100) : '-'}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 bg-yellow-100">
                {formatAmount(totals.previousYearAmount)}
              </td>
              <td className={`px-3 py-3 text-right ${totals.cumulativeAmount >= totals.previousYearAmount ? 'text-red-600' : 'text-blue-600'}`}>
                {formatDiff(totals.cumulativeAmount, totals.previousYearAmount).text}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
