'use client';

import React from 'react';
import { Expense, formatCurrency } from './types';

interface PrintHeaderProps {
  expense: Expense;
  teamLeaderName?: string | null;
  financeManagerName?: string | null;
}

function formatNameForPrint(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  // 한글 이름은 보통 2~4글자이므로 글자 사이에 공백을 넣어 인쇄물 스타일을 맞춤
  return trimmed.split('').join(' ');
}

export default function PrintHeader({ expense, teamLeaderName, financeManagerName }: PrintHeaderProps) {
  // 지출일자 분리 (없으면 빈칸)
  const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : null;
  const expenseYear = expenseDate ? expenseDate.getFullYear() : '';
  const expenseMonth = expenseDate ? expenseDate.getMonth() + 1 : '';
  const expenseDay = expenseDate ? expenseDate.getDate() : '';

  return (
    <table className="print-header-table">
      <colgroup><col style={{ width: '85px' }} /><col style={{ width: '100px' }} /><col style={{ width: 'auto' }} /><col style={{ width: '90px' }} /></colgroup>
      <tbody>
        {/* ===== 1행: 로고 + 지출결의서 제목 + 재정팀장 ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 로고 (4행 병합) */}
          <td rowSpan={4} className="logo-cell">
            <div className="logo-container">
              <img src="/logo.png" alt="교회 로고" className="logo-image" />
            </div>
          </td>
          {/* 2-3열: 지출결의서 제목 (2열 병합, 2행 병합) */}
          <td colSpan={2} rowSpan={2} className="title-cell">
            지 출 결 의 서
          </td>
          {/* 4열: 재정팀장 */}
          <td className="approval-title">재정팀장</td>
        </tr>

        {/* ===== 2행: 재정팀장 서명란 (2행 병합 시작) ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 로고 계속 */}
          {/* 2-3열: 제목 계속 */}
          {/* 4열: 재정팀장 서명란 (2행 병합) */}
          <td rowSpan={2} className="approval-sign"></td>
        </tr>

        {/* ===== 3행: 예산항목 + 재정팀장 서명란 계속 ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 로고 계속 */}
          {/* 2열: 예산항목 라벨 (2행 병합) */}
          <td rowSpan={2} className="label-cell">
            예 산 항 목<br />
            <span className="sub-label">(계정과목)</span>
          </td>
          {/* 3열: 예산항목 값 (2행 병합) */}
          <td rowSpan={2} className="value-cell budget-value">
            {expense.budgetCategory} / {expense.budgetSubcategory}
          </td>
          {/* 4열: 재정팀장 서명란 계속 */}
        </tr>

        {/* ===== 4행: 예산항목 계속 + 재정팀장 이름 ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 로고 계속 */}
          {/* 2열: 예산항목 라벨 계속 */}
          {/* 3열: 예산항목 값 계속 */}
          {/* 4열: 재정팀장 이름 */}
          <td className="approval-name">
            {financeManagerName ? formatNameForPrint(financeManagerName) : ''}
          </td>
        </tr>

        {/* ===== 5행: 사역팀(부)장 + 지출일자 + 회계 ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 사역팀(부)장 (1행) */}
          <td className="left-approval-cell">
            사역팀(부)장
          </td>
          {/* 2열: 지출일자 라벨 (2행 병합) */}
          <td rowSpan={2} className="label-cell">
            지 출 일 자
          </td>
          {/* 3열: 지출일자 값 (2행 병합) */}
          <td rowSpan={2} className="value-cell">
            <div className="notice-box">
              {expenseYear} 년 {expenseMonth} 월 {expenseDay} 일
            </div>
          </td>
          {/* 4열: 회계 */}
          <td className="approval-title">회계</td>
        </tr>

        {/* ===== 6행: 재정팀장 전결 영역(공란, 2행 병합) + 지출일자 계속 + 회계 서명란 (2행 병합 시작) ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 재정팀장 전결 영역(공란, rowSpan=2로 병합) */}
          <td rowSpan={2} className="left-approval-cell"></td>
          {/* 2열: 지출일자 라벨 계속 */}
          {/* 3열: 지출일자 값 계속 */}
          {/* 4열: 회계 서명란 (2행 병합) */}
          <td rowSpan={2} className="approval-sign"></td>
        </tr>

        {/* ===== 7행: 재정팀장 전결 영역(공란 계속) + 청구금액 + 회계 서명란 계속 ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 재정팀장 전결 영역(rowSpan=2로 위에서 병합됨) */}
          {/* 2열: 청구금액 라벨 (2행 병합) */}
          <td rowSpan={2} className="label-cell">
            청 구 금 액
          </td>
          {/* 3열: 청구금액 값 (2행 병합) */}
          <td rowSpan={2} className="value-cell amount-value">
            ₩ {formatCurrency(expense.requestAmount)} 원
          </td>
          {/* 4열: 회계 서명란 계속 */}
        </tr>

        {/* ===== 8행: 팀장 이름 + 청구금액 계속 + 윤운문 ===== */}
        <tr style={{ height: '25px' }}>
          {/* 1열: 팀장 이름 (1행) */}
          <td className="left-approval-cell name-cell">
            {teamLeaderName ? formatNameForPrint(teamLeaderName) : ''}
          </td>
          {/* 2열: 청구금액 라벨 계속 */}
          {/* 3열: 청구금액 값 계속 */}
          {/* 4열: 윤운문 */}
          <td className="approval-name">윤 운 문</td>
        </tr>
      </tbody>

      <style jsx>{`
        .print-header-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .print-header-table td,
        .print-header-table th {
          border: 1px solid #000;
          vertical-align: middle;
        }

        /* ===== 로고 셀 ===== */
        .logo-cell {
          padding: 8px;
          text-align: center;
          vertical-align: middle;
          background-color: #fff;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .logo-image {
          width: 70px;
          height: auto;
          object-fit: contain;
        }

        /* ===== 제목 셀 ===== */
        .title-cell {
          font-size: 22pt;
          font-weight: bold;
          text-align: center;
          letter-spacing: 18px;
          padding: 12px;
        }

        /* ===== 결재란 (중첩 테이블 제거, 메인 테이블에 직접 구성) ===== */
        .approval-title {
          background-color: #fff;
          height: 25px;
          font-weight: bold;
          text-align: center;
          font-size: 9pt;
          padding: 2px;
        }

        .approval-sign {
          height: 50px; /* rowSpan=2이므로 25px × 2 = 50px */
          background-color: #fff;
        }

        .approval-name {
          height: 25px;
          font-size: 8pt;
          letter-spacing: 3px;
          text-align: center;
          background-color: #fff;
        }

        /* ===== 라벨/값 셀 ===== */
        .label-cell {
          background-color: #fff;
          font-weight: bold;
          text-align: center;
          font-size: 10pt;
          padding: 8px 4px;
        }

        .sub-label {
          font-size: 8pt;
          font-weight: normal;
        }

        .value-cell {
          padding: 8px 12px;
          text-align: center;
          vertical-align: middle;
        }

        .budget-value {
          font-weight: bold;
          font-size: 12pt;
        }

        .notice-box {
          background-color: #fff;
          padding: 8px 12px;
          font-size: 10pt;
          color: #000;
          line-height: 1.5;
          text-align: center;
          letter-spacing: 8px;
        }

        .amount-value {
          font-size: 16pt;
          font-weight: bold;
        }

        /* ===== 좌측 결재선 ===== */
        .left-approval-cell {
          background-color: #fff;
          text-align: center;
          vertical-align: middle;
          padding: 4px 2px;
          font-size: 8pt;
          font-weight: bold;
          height: 25px; /* rowSpan=1 기본 높이 */}

        /* rowSpan=2인 경우 자동으로 50px (25px × 2)가 됨 */

        .name-cell {
          /* 신창국 셀 */
          font-size: 9pt;
          letter-spacing: 3px;
        }
      `}</style>
    </table>
  );
}
