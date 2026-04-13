/**
 * 재정보고서 (제직용) 페이지
 * 읽기 전용 공개 페이지 - API 호출 없음, 정적 데이터 사용
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { latestReport } from '@/lib/data/financial-reports';
import {
  SummaryTable,
  IncomeTable,
  ExpenseTable,
  BankReserveTable,
  AssetLiabilityTable,
  FinancialCharts,
} from '@/components/reports';

export const metadata = {
  title: '재정보고서 (제직용)',
  description: '분기별 재정보고서 조회 페이지',
};

export default function FinancialReportPage() {
  const report = latestReport;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="px-4 py-2.5 min-h-[44px] rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{report.title}</h1>
            <p className="text-sm text-gray-600">
              {report.year}년 {report.quarter}분기 재정보고서 (제직용)
            </p>
          </div>
        </div>

        {/* 수지개황 */}
        <SummaryTable summary={report.summary} />

        {/* 수입 현황 */}
        <IncomeTable items={report.incomeItems} totalIncome={report.summary.totalIncome} />

        {/* 지출 현황 */}
        <ExpenseTable items={report.expenseItems} totalExpense={report.summary.totalExpense} />

        {/* 입출금 통장 및 적립금 */}
        <BankReserveTable bankAccounts={report.bankAccounts} reserves={report.reserves} />

        {/* 기타 자산/부채 */}
        <AssetLiabilityTable assets={report.assets} liabilities={report.liabilities} />

        {/* 차트 */}
        <FinancialCharts
          incomeItems={report.incomeItems}
          expenseItems={report.expenseItems}
          committeeExpenses={report.committeeExpenses}
        />

        {/* 푸터 */}
        <div className="text-center text-sm text-gray-500 py-8">
          <p>본 재정보고서는 교회 제직을 위한 참고 자료입니다.</p>
          <p className="mt-1">문의사항은 재정부로 연락해 주시기 바랍니다.</p>
        </div>
      </div>
    </div>
  );
}
