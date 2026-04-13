/**
 * 2026년 1분기 재정보고서 데이터
 */

import type { FinancialReportData } from './types';

export const report2026Q1: FinancialReportData = {
  year: 2026,
  quarter: 1,
  title: '2026년 1분기 재정보고서',
  summary: {
    period: '2026.01.01 ~ 2026.03.31',
    previousCarryover: 45320000, // 전기이월
    totalIncome: 187650000, // 수입총계
    totalExpense: 156780000, // 지출총계
    difference: 30870000, // 차액
    nextCarryover: 76190000, // 차기이월
  },
  incomeItems: [
    // 주헌금
    { id: 'i1', category: '주헌금', itemName: '주헌금', budgetAmount: 480000000, currentAmount: 42500000, cumulativeAmount: 125600000, executionRate: 26.2, previousYearAmount: 118500000 },
    { id: 'i1-1', category: '주헌금', itemName: '주일헌금', budgetAmount: 280000000, currentAmount: 24300000, cumulativeAmount: 73200000, executionRate: 26.1, previousYearAmount: 69800000 },
    { id: 'i1-2', category: '주헌금', itemName: '십일조', budgetAmount: 180000000, currentAmount: 16800000, cumulativeAmount: 48500000, executionRate: 26.9, previousYearAmount: 45200000 },
    { id: 'i1-3', category: '주헌금', itemName: '감사헌금', budgetAmount: 20000000, currentAmount: 1400000, cumulativeAmount: 3900000, executionRate: 19.5, previousYearAmount: 3500000 },

    // 기타헌금
    { id: 'i2', category: '기타헌금', itemName: '기타헌금', budgetAmount: 120000000, currentAmount: 8200000, cumulativeAmount: 28500000, executionRate: 23.8, previousYearAmount: 26200000 },
    { id: 'i2-1', category: '기타헌금', itemName: '건축헌금', budgetAmount: 50000000, currentAmount: 3500000, cumulativeAmount: 12800000, executionRate: 25.6, previousYearAmount: 11500000 },
    { id: 'i2-2', category: '기타헌금', itemName: '선교헌금', budgetAmount: 40000000, currentAmount: 2800000, cumulativeAmount: 9200000, executionRate: 23.0, previousYearAmount: 8700000 },
    { id: 'i2-3', category: '기타헌금', itemName: '구제헌금', budgetAmount: 30000000, currentAmount: 1900000, cumulativeAmount: 6500000, executionRate: 21.7, previousYearAmount: 6000000 },

    // 절기헌금
    { id: 'i3', category: '절기헌금', itemName: '절기헌금', budgetAmount: 80000000, currentAmount: 5600000, cumulativeAmount: 18200000, executionRate: 22.8, previousYearAmount: 17100000 },
    { id: 'i3-1', category: '절기헌금', itemName: '부활절헌금', budgetAmount: 25000000, currentAmount: 2200000, cumulativeAmount: 8500000, executionRate: 34.0, previousYearAmount: 7800000 },
    { id: 'i3-2', category: '절기헌금', itemName: '맥추절헌금', budgetAmount: 25000000, currentAmount: 1800000, cumulativeAmount: 5200000, executionRate: 20.8, previousYearAmount: 4900000 },
    { id: 'i3-3', category: '절기헌금', itemName: '추수감사헌금', budgetAmount: 30000000, currentAmount: 1600000, cumulativeAmount: 4500000, executionRate: 15.0, previousYearAmount: 4400000 },

    // 기타수입
    { id: 'i4', category: '기타수입', itemName: '기타수입', budgetAmount: 35000000, currentAmount: 4200000, cumulativeAmount: 12350000, executionRate: 35.3, previousYearAmount: 11200000 },
    { id: 'i4-1', category: '기타수입', itemName: '이자수입', budgetAmount: 15000000, currentAmount: 1800000, cumulativeAmount: 5200000, executionRate: 34.7, previousYearAmount: 4800000 },
    { id: 'i4-2', category: '기타수입', itemName: '시설사용료', budgetAmount: 12000000, currentAmount: 1500000, cumulativeAmount: 4500000, executionRate: 37.5, previousYearAmount: 4100000 },
    { id: 'i4-3', category: '기타수입', itemName: '잡수입', budgetAmount: 8000000, currentAmount: 900000, cumulativeAmount: 2650000, executionRate: 33.1, previousYearAmount: 2300000 },

    // 예산외수입
    { id: 'i5', category: '예산외수입', itemName: '예산외수입', budgetAmount: 5000000, currentAmount: 1200000, cumulativeAmount: 3000000, executionRate: 60.0, previousYearAmount: 2500000 },
  ],
  expenseItems: [
    // 인건비
    { id: 'e1', category: '인건비', itemName: '인건비', budgetAmount: 350000000, currentAmount: 29500000, cumulativeAmount: 88200000, executionRate: 25.2, previousYearAmount: 85600000 },
    { id: 'e1-1', category: '인건비', itemName: '목사사례비', budgetAmount: 180000000, currentAmount: 15000000, cumulativeAmount: 45000000, executionRate: 25.0, previousYearAmount: 43500000 },
    { id: 'e1-2', category: '인건비', itemName: '전도사사례비', budgetAmount: 96000000, currentAmount: 8000000, cumulativeAmount: 24000000, executionRate: 25.0, previousYearAmount: 23200000 },
    { id: 'e1-3', category: '인건비', itemName: '직원급여', budgetAmount: 60000000, currentAmount: 5000000, cumulativeAmount: 15000000, executionRate: 25.0, previousYearAmount: 14800000 },
    { id: 'e1-4', category: '인건비', itemName: '상여금/복리후생', budgetAmount: 14000000, currentAmount: 1500000, cumulativeAmount: 4200000, executionRate: 30.0, previousYearAmount: 4100000 },

    // 교회운영비
    { id: 'e2', category: '교회운영비', itemName: '교회운영비', budgetAmount: 150000000, currentAmount: 11200000, cumulativeAmount: 34800000, executionRate: 23.2, previousYearAmount: 32500000 },
    { id: 'e2-1', category: '교회운영비', itemName: '수도광열비', budgetAmount: 48000000, currentAmount: 4200000, cumulativeAmount: 12800000, executionRate: 26.7, previousYearAmount: 11500000 },
    { id: 'e2-2', category: '교회운영비', itemName: '통신비', budgetAmount: 12000000, currentAmount: 980000, cumulativeAmount: 2950000, executionRate: 24.6, previousYearAmount: 2800000 },
    { id: 'e2-3', category: '교회운영비', itemName: '차량유지비', budgetAmount: 18000000, currentAmount: 1400000, cumulativeAmount: 4200000, executionRate: 23.3, previousYearAmount: 4100000 },
    { id: 'e2-4', category: '교회운영비', itemName: '시설유지비', budgetAmount: 36000000, currentAmount: 2500000, cumulativeAmount: 7800000, executionRate: 21.7, previousYearAmount: 7500000 },
    { id: 'e2-5', category: '교회운영비', itemName: '사무용품비', budgetAmount: 12000000, currentAmount: 850000, cumulativeAmount: 2650000, executionRate: 22.1, previousYearAmount: 2400000 },
    { id: 'e2-6', category: '교회운영비', itemName: '기타운영비', budgetAmount: 24000000, currentAmount: 1270000, cumulativeAmount: 4400000, executionRate: 18.3, previousYearAmount: 4200000 },

    // 선교비
    { id: 'e3', category: '선교비', itemName: '선교비', budgetAmount: 85000000, currentAmount: 5800000, cumulativeAmount: 18500000, executionRate: 21.8, previousYearAmount: 17200000 },
    { id: 'e3-1', category: '선교비', itemName: '국내선교비', budgetAmount: 45000000, currentAmount: 3200000, cumulativeAmount: 10200000, executionRate: 22.7, previousYearAmount: 9500000 },
    { id: 'e3-2', category: '선교비', itemName: '해외선교비', budgetAmount: 40000000, currentAmount: 2600000, cumulativeAmount: 8300000, executionRate: 20.8, previousYearAmount: 7700000 },

    // 교육부서비
    { id: 'e4', category: '교육부서비', itemName: '교육부서비', budgetAmount: 65000000, currentAmount: 3500000, cumulativeAmount: 11280000, executionRate: 17.4, previousYearAmount: 10800000 },
    { id: 'e4-1', category: '교육부서비', itemName: '주일학교', budgetAmount: 25000000, currentAmount: 1400000, cumulativeAmount: 4500000, executionRate: 18.0, previousYearAmount: 4300000 },
    { id: 'e4-2', category: '교육부서비', itemName: '청년부', budgetAmount: 20000000, currentAmount: 1100000, cumulativeAmount: 3600000, executionRate: 18.0, previousYearAmount: 3400000 },
    { id: 'e4-3', category: '교육부서비', itemName: '장년부', budgetAmount: 20000000, currentAmount: 1000000, cumulativeAmount: 3180000, executionRate: 15.9, previousYearAmount: 3100000 },

    // 구제비
    { id: 'e5', category: '구제비', itemName: '구제비', budgetAmount: 40000000, currentAmount: 1800000, cumulativeAmount: 4000000, executionRate: 10.0, previousYearAmount: 3800000 },
    { id: 'e5-1', category: '구제비', itemName: '교우돕기', budgetAmount: 25000000, currentAmount: 1200000, cumulativeAmount: 2800000, executionRate: 11.2, previousYearAmount: 2600000 },
    { id: 'e5-2', category: '구제비', itemName: '지역사회봉사', budgetAmount: 15000000, currentAmount: 600000, cumulativeAmount: 1200000, executionRate: 8.0, previousYearAmount: 1200000 },
  ],
  bankAccounts: [
    { id: 'b1', accountType: '주거래통장', accountNumber: '123-456-789012', balance: 52180000, note: '우리은행' },
    { id: 'b2', accountType: '선교통장', accountNumber: '234-567-890123', balance: 12500000, note: '국민은행' },
    { id: 'b3', accountType: '건축적립금통장', accountNumber: '345-678-901234', balance: 8510000, note: '신한은행' },
    { id: 'b4', accountType: '비상예비금통장', accountNumber: '456-789-012345', balance: 3000000, note: '하나은행' },
  ],
  reserves: [
    { id: 'r1', itemName: '건축적립금', previousBalance: 150000000, increase: 12800000, decrease: 0, currentBalance: 162800000, note: '제2성전 건축' },
    { id: 'r2', itemName: '선교적립금', previousBalance: 35000000, increase: 9200000, decrease: 5000000, currentBalance: 39200000, note: '단기선교비' },
    { id: 'r3', itemName: '교육적립금', previousBalance: 18000000, increase: 3600000, decrease: 2000000, currentBalance: 19600000, note: '교육시설개선' },
    { id: 'r4', itemName: '비상적립금', previousBalance: 25000000, increase: 0, decrease: 0, currentBalance: 25000000, note: '-' },
  ],
  assets: [
    { id: 'a1', assetType: '정기예금', amount: 100000000, maturityDate: '2026-12-31', owner: '교회', note: '연 3.5%' },
    { id: 'a2', assetType: '정기적금', amount: 50000000, maturityDate: '2026-06-30', owner: '교회', note: '건축기금' },
    { id: 'a3', assetType: '채권', amount: 30000000, maturityDate: '2027-03-31', owner: '교회', note: '국채' },
  ],
  liabilities: [
    { id: 'l1', itemName: '건축차입금', previousBalance: 200000000, increase: 0, decrease: 20000000, currentBalance: 180000000, maturityDate: '2030-12-31', debtor: '우리은행', interestRate: 4.5, note: '제2성전건축' },
    { id: 'l2', itemName: '시설보수대출', previousBalance: 30000000, increase: 0, decrease: 5000000, currentBalance: 25000000, maturityDate: '2027-06-30', debtor: '국민은행', interestRate: 5.0, note: '냉난방시설' },
  ],
  committeeExpenses: [
    { id: 'c1', committee: '교육위원회', amount: 11280000 },
    { id: 'c2', committee: '선교위원회', amount: 18500000 },
    { id: 'c3', committee: '봉사위원회', amount: 4000000 },
    { id: 'c4', committee: '친교위원회', amount: 3200000 },
    { id: 'c5', committee: '예배위원회', amount: 5800000 },
    { id: 'c6', committee: '시설관리위원회', amount: 12000000 },
  ],
};
