'use client';

import React from 'react';
import { Expense, formatCurrency, ApprovalLine } from './types';
import PrintApprovalBox from './PrintApprovalBox';

interface PrintHeaderProps {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
}

export default function PrintHeader({ expense, approvalLine }: PrintHeaderProps) {

  return (
    <div className="print-header-container">
      {/* 상단: 로고 + 제목 + 결재란 */}
      <div className="header-top">
        {/* 로고 */}
        <div className="logo-section">
          <img src="/logo.png" alt="교회 로고" className="logo-image" />
        </div>

        {/* 제목 */}
        <div className="title-section">
          <h1 className="title-text">지 출 결 의 서</h1>
        </div>

        {/* 결재란 */}
        <PrintApprovalBox approvalLine={approvalLine} className="approval-section" />
      </div>

      {/* 예산/지출 정보 */}
      <table className="info-table">
        <tbody>
          <tr>
            <td className="info-label-cell">예산항목</td>
            <td className="info-value-cell">{expense.items?.[0]?.budgetCategory || '-'} / {expense.items?.[0]?.budgetSubcategory || '-'}</td>
          </tr>
          <tr>
            <td className="info-label-cell">지출일자</td>
            <td className="info-value-cell">&nbsp;</td>
          </tr>
          <tr>
            <td className="info-label-cell">청구금액</td>
            <td className="info-value-cell amount-cell">
              금 {formatCurrency(expense.requestAmount)} 원정
            </td>
          </tr>
        </tbody>
      </table>

      <style jsx>{`
        .print-header-container {
          margin-bottom: 0;
        }

        /* 상단: 로고 + 제목 + 결재란 */
        .header-top {
          display: flex;
          align-items: stretch;
          border: 2px solid #000;
          border-bottom: 1px solid #000;
        }

        /* 로고 */
        .logo-section {
          width: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border-right: 1px solid #000;
        }

        .logo-image {
          width: 65px;
          height: auto;
        }

        /* 제목 */
        .title-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 15px;
          border-right: 1px solid #000;
        }

        .title-text {
          font-size: 24pt;
          font-weight: bold;
          letter-spacing: 12px;
          margin: 0;
          padding-left: 12px;
          white-space: nowrap;
        }

        /* 결재란 */
        .approval-section {
          width: auto;
          min-width: 180px;
        }

        /* 정보 테이블 */
        .info-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          border-top: none;
        }

        .info-table tr {
          border-bottom: 1px solid #000;
        }

        .info-table tr:last-child {
          border-bottom: none;
        }

        .info-label-cell {
          width: 100px;
          background-color: #f8f8f8;
          font-size: 10pt;
          font-weight: 600;
          text-align: center;
          padding: 10px 12px;
          border-right: 1px solid #000;
          letter-spacing: 2px;
        }

        .info-value-cell {
          font-size: 10pt;
          padding: 10px 15px;
          text-align: center;
        }

        .amount-cell {
          font-size: 10pt;
        }

        @media print {
          .print-header-container {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .header-top {
            border: 2px solid #000 !important;
            border-bottom: 1px solid #000 !important;
          }

          .info-table {
            border: 2px solid #000 !important;
            border-top: none !important;
          }

          .info-label-cell {
            background-color: #f8f8f8 !important;
          }
        }
      `}</style>
    </div>
  );
}
