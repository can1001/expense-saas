/**
 * 재정보고서 데이터 타입 정의
 */

// 수지개황 요약
export interface SummaryData {
  period: string; // 예: "2026.01.01 ~ 2026.03.31"
  previousCarryover: number; // 전기이월
  totalIncome: number; // 수입총계
  totalExpense: number; // 지출총계
  difference: number; // 차액
  nextCarryover: number; // 차기이월
  // 전년 동분기 데이터
  prevYear?: {
    previousCarryover: number; // 전년 전기이월
    totalIncome: number; // 전년 수입총계
    totalExpense: number; // 전년 지출총계
    nextCarryover: number; // 전년 차기이월
  };
}

// 수입/지출 항목
export interface ReportItem {
  id: string;
  category: string; // 카테고리 (대분류)
  itemName: string; // 항목명
  budgetAmount: number; // 예산액
  currentAmount: number; // 당기
  cumulativeAmount: number; // 누계
  executionRate: number; // 진척률 (%)
  previousYearAmount?: number; // 전년 동분기 누계
}

// 입출금 통장
export interface BankAccount {
  id: string;
  accountType: string; // 예금 종류
  accountNumber?: string; // 계좌번호
  balance: number; // 예금 잔액
  note?: string; // 비고
}

// 적립금
export interface Reserve {
  id: string;
  itemName: string; // 항목명
  previousBalance: number; // 전기이월
  increase: number; // 증가
  decrease: number; // 감소
  currentBalance: number; // 차기이월
  note?: string; // 비고
}

// 기타 자산
export interface Asset {
  id: string;
  assetType: string; // 자산 종류
  amount: number; // 금액
  maturityDate?: string; // 만기일자
  owner?: string; // 소유자
  note?: string; // 비고
}

// 기타 부채
export interface Liability {
  id: string;
  itemName: string; // 항목명
  previousBalance: number; // 전기이월
  increase: number; // 증가
  decrease: number; // 감소
  currentBalance: number; // 차기이월
  maturityDate?: string; // 만기일자
  debtor?: string; // 채무자
  loanStartDate?: string; // 대출시작일
  interestRate?: number; // 금리 (%)
  note?: string; // 비고
}

// 위원회별 지출
export interface CommitteeExpense {
  id: string;
  committee: string; // 위원회명
  amount: number; // 지출액
}

// 전체 재정보고서 데이터
export interface FinancialReportData {
  year: number;
  quarter: number;
  title: string; // 예: "2026년 1분기 재정보고서"
  summary: SummaryData;
  incomeItems: ReportItem[];
  expenseItems: ReportItem[];
  bankAccounts: BankAccount[];
  reserves: Reserve[];
  assets: Asset[];
  liabilities: Liability[];
  committeeExpenses: CommitteeExpense[];
}
