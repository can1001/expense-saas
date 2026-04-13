/**
 * 수입부 상세 테이블
 */

'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { ReportItem } from '@/lib/data/financial-reports/types';
import { formatAmount, formatDiff, formatRate } from './utils';

interface IncomeTableProps {
  items: ReportItem[];
  totalIncome: number;
}

export function IncomeTable({ items, totalIncome }: IncomeTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 예산외수입과 일반 수입 분리
  const regularItems = items.filter((item) => item.category !== '예산외수입');
  const extraBudgetItems = items.filter((item) => item.category === '예산외수입');

  // 카테고리별 그룹화 (일반 수입만)
  const categories = regularItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ReportItem[]>);

  // 카테고리 합계 계산 (첫 번째 항목이 카테고리 합계)
  const categoryTotals = Object.entries(categories).map(([category, categoryItems]) => {
    const totalItem = categoryItems[0];
    const subItems = categoryItems.slice(1);
    return {
      category,
      total: totalItem,
      subItems,
    };
  });

  // 예산외수입 카테고리
  const extraBudgetCategory = extraBudgetItems.length > 0 ? {
    category: '예산외수입',
    total: extraBudgetItems[0],
    subItems: extraBudgetItems.slice(1),
  } : null;

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
    const allCategories = [...Object.keys(categories)];
    if (extraBudgetCategory) allCategories.push('예산외수입');
    setExpandedCategories(new Set(allCategories));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // 합계 (예산외수입 제외)
  const subtotals = categoryTotals.reduce(
    (acc, { total }) => ({
      budgetAmount: acc.budgetAmount + total.budgetAmount,
      currentAmount: acc.currentAmount + total.currentAmount,
      cumulativeAmount: acc.cumulativeAmount + total.cumulativeAmount,
      previousYearAmount: acc.previousYearAmount + (total.previousYearAmount || 0),
    }),
    { budgetAmount: 0, currentAmount: 0, cumulativeAmount: 0, previousYearAmount: 0 }
  );

  // 총계 (예산외수입 포함)
  const grandTotals = {
    budgetAmount: subtotals.budgetAmount + (extraBudgetCategory?.total.budgetAmount || 0),
    currentAmount: subtotals.currentAmount + (extraBudgetCategory?.total.currentAmount || 0),
    cumulativeAmount: subtotals.cumulativeAmount + (extraBudgetCategory?.total.cumulativeAmount || 0),
    previousYearAmount: subtotals.previousYearAmount + (extraBudgetCategory?.total.previousYearAmount || 0),
  };

  const renderCategoryRow = (
    category: string,
    total: ReportItem,
    subItems: ReportItem[],
    baseAmount: number
  ) => {
    const isExpanded = expandedCategories.has(category);
    const diff = formatDiff(total.cumulativeAmount, total.previousYearAmount);
    const incomeRatio = baseAmount > 0 ? (total.cumulativeAmount / baseAmount * 100) : 0;

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
            </span>
          </td>
          <td className="px-3 py-2.5 text-right text-gray-900">
            {total.budgetAmount > 0 ? formatAmount(total.budgetAmount) : ''}
          </td>
          <td className="px-3 py-2.5 text-right text-gray-900">{formatAmount(total.currentAmount)}</td>
          <td className="px-3 py-2.5 text-right text-gray-900">{formatAmount(total.cumulativeAmount)}</td>
          <td className="px-3 py-2.5 text-right text-gray-900">
            {total.executionRate > 0 ? formatRate(total.executionRate) : ''}
          </td>
          <td className="px-3 py-2.5 text-right text-gray-700 bg-yellow-50">
            {total.previousYearAmount !== undefined && total.previousYearAmount > 0
              ? formatAmount(total.previousYearAmount)
              : ''}
          </td>
          <td className={`px-3 py-2.5 text-right ${diff.isIncrease ? 'text-red-600' : 'text-blue-600'}`}>
            {diff.diff !== 0 ? diff.text : ''}
          </td>
        </tr>

        {/* 세부 항목 행 */}
        {isExpanded &&
          subItems.map((item) => {
            const itemDiff = formatDiff(item.cumulativeAmount, item.previousYearAmount);
            return (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 pl-8 text-gray-700">ㄴ {item.itemName}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {item.budgetAmount > 0 ? formatAmount(item.budgetAmount) : ''}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{formatAmount(item.currentAmount)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatAmount(item.cumulativeAmount)}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {item.executionRate > 0 ? formatRate(item.executionRate) : ''}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 bg-yellow-50">
                  {item.previousYearAmount !== undefined && item.previousYearAmount > 0
                    ? formatAmount(item.previousYearAmount)
                    : ''}
                </td>
                <td className={`px-3 py-2 text-right ${itemDiff.isIncrease ? 'text-red-600' : 'text-blue-600'}`}>
                  {itemDiff.diff !== 0 ? itemDiff.text : ''}
                </td>
              </tr>
            );
          })}
      </>
    );
  };

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">II. 수입 현황</h2>
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
              <th className="px-3 py-3 text-right font-semibold min-w-[100px] bg-yellow-600">전년 누계</th>
              <th className="px-3 py-3 text-right font-semibold min-w-[120px]">전년비교</th>
            </tr>
          </thead>
          <tbody>
            {/* 일반 수입 항목 */}
            {categoryTotals.map(({ category, total, subItems }) =>
              renderCategoryRow(category, total, subItems, subtotals.cumulativeAmount)
            )}

            {/* 합계 (예산외수입 제외) */}
            <tr className="bg-green-100 font-bold">
              <td className="px-3 py-3 text-gray-900">합 계</td>
              <td className="px-3 py-3 text-right text-gray-900">{formatAmount(subtotals.budgetAmount)}</td>
              <td className="px-3 py-3 text-right text-gray-900">{formatAmount(subtotals.currentAmount)}</td>
              <td className="px-3 py-3 text-right text-green-700">{formatAmount(subtotals.cumulativeAmount)}</td>
              <td className="px-3 py-3 text-right text-gray-900">
                {subtotals.budgetAmount > 0 ? formatRate((subtotals.cumulativeAmount / subtotals.budgetAmount) * 100) : '-'}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 bg-yellow-100">
                {formatAmount(subtotals.previousYearAmount)}
              </td>
              <td className={`px-3 py-3 text-right ${subtotals.cumulativeAmount >= subtotals.previousYearAmount ? 'text-red-600' : 'text-blue-600'}`}>
                {formatDiff(subtotals.cumulativeAmount, subtotals.previousYearAmount).text}
              </td>
            </tr>

            {/* 예산외수입 */}
            {extraBudgetCategory && (
              <>
                {renderCategoryRow(
                  extraBudgetCategory.category,
                  extraBudgetCategory.total,
                  extraBudgetCategory.subItems,
                  grandTotals.cumulativeAmount
                )}
              </>
            )}

            {/* 총계 (예산외수입 포함) */}
            {extraBudgetCategory && (
              <tr className="bg-blue-200 font-bold">
                <td className="px-3 py-3 text-gray-900">총 계</td>
                <td className="px-3 py-3 text-right text-gray-900">{formatAmount(grandTotals.budgetAmount)}</td>
                <td className="px-3 py-3 text-right text-gray-900">{formatAmount(grandTotals.currentAmount)}</td>
                <td className="px-3 py-3 text-right text-blue-700">{formatAmount(grandTotals.cumulativeAmount)}</td>
                <td className="px-3 py-3 text-right text-gray-900"></td>
                <td className="px-3 py-3 text-right text-gray-700 bg-yellow-100">
                  {formatAmount(grandTotals.previousYearAmount)}
                </td>
                <td className="px-3 py-3 text-right"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
