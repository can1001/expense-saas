'use client';

import React from 'react';
import { Expense, formatCurrency, ApprovalLine } from './types';

interface PrintHeaderProps {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
}

function formatNameForPrint(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split('').join(' ');
}

export default function PrintHeader({ expense, approvalLine }: PrintHeaderProps) {
  const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : null;
  const expenseYear = expenseDate ? expenseDate.getFullYear() : '';
  const expenseMonth = expenseDate ? expenseDate.getMonth() + 1 : '';
  const expenseDay = expenseDate ? expenseDate.getDate() : '';

  // 결재 단계 (없으면 기본 3단계)
  const steps = approvalLine?.steps || [];
  const hasApprovalLine = steps.length > 0;

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
        <div className="approval-section">
          <table className="approval-table">
            <thead>
              <tr>
                {hasApprovalLine ? (
                  steps.map((step) => (
                    <th key={`h-${step.id}`} className="approval-header">
                      {step.stepName}
                    </th>
                  ))
                ) : (
                  <>
                    <th className="approval-header">담당</th>
                    <th className="approval-header">팀장</th>
                    <th className="approval-header">회계</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                {hasApprovalLine ? (
                  steps.map((step) => (
                    <td key={`s-${step.id}`} className="approval-sign-cell">
                      {step.status === 'APPROVED' && step.signatureData ? (
                        <img src={step.signatureData} alt="서명" className="signature-image" />
                      ) : step.status === 'APPROVED' ? (
                        <span className="approved-mark">승인</span>
                      ) : step.status === 'REJECTED' ? (
                        <span className="rejected-mark">반려</span>
                      ) : (
                        <span className="pending-mark"></span>
                      )}
                    </td>
                  ))
                ) : (
                  <>
                    <td className="approval-sign-cell"></td>
                    <td className="approval-sign-cell"></td>
                    <td className="approval-sign-cell"></td>
                  </>
                )}
              </tr>
              <tr>
                {hasApprovalLine ? (
                  steps.map((step) => (
                    <td key={`n-${step.id}`} className="approval-name-cell">
                      {formatNameForPrint(step.approverName)}
                    </td>
                  ))
                ) : (
                  <>
                    <td className="approval-name-cell"></td>
                    <td className="approval-name-cell"></td>
                    <td className="approval-name-cell"></td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 예산/지출 정보 - 2행 그리드형 */}
      <table className="info-table">
        <tbody>
          <tr>
            <td className="header-info-cell">
              <span className="info-label">예산항목:</span>
              <span className="info-value">{expense.items?.[0]?.budgetCategory || '-'} / {expense.items?.[0]?.budgetSubcategory || '-'}</span>
            </td>
            <td className="header-info-cell">
              <span className="info-label">지출일자:</span>
              <span className="info-value">{expenseYear}년 {String(expenseMonth).padStart(2, '0')}월 {String(expenseDay).padStart(2, '0')}일</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="amount-row">
              <span className="amount-label">청 구 금 액</span>
              <span className="amount-separator">:</span>
              <span className="amount-value">₩ {formatCurrency(expense.requestAmount)} 원</span>
            </td>
          </tr>
        </tbody>
      </table>

      <style jsx>{`
        .print-header-container {
          margin-bottom: 10px;
        }

        /* 상단: 로고 + 제목 + 결재란 */
        .header-top {
          display: flex;
          align-items: stretch;
          border: 1px solid #000;
          margin-bottom: 0;
        }

        /* 로고 */
        .logo-section {
          width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          border-right: 1px solid #000;
        }

        .logo-image {
          width: 60px;
          height: auto;
        }

        /* 제목 */
        .title-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
          border-right: 1px solid #000;
        }

        .title-text {
          font-size: 22pt;
          font-weight: bold;
          letter-spacing: 15px;
          margin: 0;
        }

        /* 결재란 */
        .approval-section {
          width: auto;
          min-width: 180px;
        }

        .approval-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
        }

        .approval-header {
          background-color: #f5f5f5;
          font-size: 8pt;
          font-weight: bold;
          text-align: center;
          padding: 4px 8px;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          min-width: 55px;
        }

        .approval-header:last-child {
          border-right: none;
        }

        .approval-sign-cell {
          height: 45px;
          text-align: center;
          vertical-align: middle;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          padding: 4px;
        }

        .approval-sign-cell:last-child {
          border-right: none;
        }

        .signature-image {
          max-width: 45px;
          max-height: 35px;
          object-fit: contain;
        }

        .approved-mark {
          color: #10B981;
          font-size: 9pt;
          font-weight: bold;
        }

        .rejected-mark {
          color: #EF4444;
          font-size: 9pt;
          font-weight: bold;
        }

        .pending-mark {
          display: block;
          height: 35px;
        }

        .approval-name-cell {
          font-size: 8pt;
          text-align: center;
          padding: 4px;
          border-right: 1px solid #000;
          letter-spacing: 2px;
        }

        .approval-name-cell:last-child {
          border-right: none;
        }

        /* 정보 테이블 - 2행 그리드형 */
        .info-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000;
          border-top: none;
        }

        .info-table td {
          border: 1px solid #000;
          padding: 10px 12px;
          vertical-align: middle;
        }

        .header-info-cell {
          text-align: center;
          font-size: 10pt;
          width: 50%;
        }

        .header-info-cell .info-label {
          font-weight: 600;
          color: #333;
          margin-right: 8px;
        }

        .header-info-cell .info-value {
          font-weight: 700;
        }

        /* 청구금액 행 - 강조 */
        .amount-row {
          text-align: center;
          padding: 12px 20px;
          background-color: #fafafa;
        }

        .amount-row .amount-label {
          font-size: 12pt;
          font-weight: 600;
          letter-spacing: 8px;
          color: #333;
        }

        .amount-row .amount-separator {
          font-size: 14pt;
          font-weight: bold;
          margin: 0 15px;
        }

        .amount-row .amount-value {
          font-size: 16pt;
          font-weight: bold;
          color: #000;
          letter-spacing: 2px;
        }

        @media print {
          .print-header-container {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .approval-header {
            background-color: #f5f5f5 !important;
          }

          .approved-mark {
            color: #10B981 !important;
          }

          .rejected-mark {
            color: #EF4444 !important;
          }

          .amount-row {
            background-color: #fafafa !important;
          }
        }
      `}</style>
    </div>
  );
}
