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
                  steps.map((step) => {
                    // 담당자 → 사역팀(부)장으로 표시
                    const displayName = step.stepName.startsWith('담당자')
                      ? '사역팀(부)장'
                      : step.stepName;
                    return (
                      <th key={`h-${step.id}`} className="approval-header">
                        {displayName}
                      </th>
                    );
                  })
                ) : (
                  <>
                    <th className="approval-header">사역팀(부)장</th>
                    <th className="approval-header">회계</th>
                    <th className="approval-header">재정팀장</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                {hasApprovalLine ? (
                  steps.map((step) => {
                    const isAutoApproved = step.stepName.includes('전결');
                    return (
                      <td key={`s-${step.id}`} className="approval-sign-cell">
                        {step.status === 'APPROVED' && isAutoApproved ? (
                          <span className="auto-approved-mark">{step.stepName}</span>
                        ) : step.status === 'APPROVED' && step.signatureData ? (
                          <img src={step.signatureData} alt="서명" className="signature-image" />
                        ) : step.status === 'APPROVED' ? (
                          <span className="approved-mark">승인</span>
                        ) : step.status === 'REJECTED' ? (
                          <span className="rejected-mark">반려</span>
                        ) : (
                          <span className="pending-mark"></span>
                        )}
                      </td>
                    );
                  })
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

        .approval-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
        }

        .approval-header {
          background-color: #f8f8f8;
          font-size: 9pt;
          font-weight: bold;
          text-align: center;
          padding: 6px 10px;
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          min-width: 55px;
        }

        .approval-header:last-child {
          border-right: none;
        }

        .approval-sign-cell {
          height: 50px;
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
          max-height: 40px;
          object-fit: contain;
        }

        .approved-mark {
          color: #10B981;
          font-size: 10pt;
          font-weight: bold;
        }

        .auto-approved-mark {
          color: #2563EB;
          font-size: 9pt;
          font-weight: bold;
          white-space: nowrap;
        }

        .rejected-mark {
          color: #EF4444;
          font-size: 10pt;
          font-weight: bold;
        }

        .pending-mark {
          display: block;
          height: 40px;
        }

        .approval-name-cell {
          font-size: 9pt;
          text-align: center;
          padding: 6px;
          border-right: 1px solid #000;
          letter-spacing: 3px;
        }

        .approval-name-cell:last-child {
          border-right: none;
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

          .approval-header,
          .info-label-cell {
            background-color: #f8f8f8 !important;
          }

          .approved-mark {
            color: #10B981 !important;
          }

          .rejected-mark {
            color: #EF4444 !important;
          }

          .auto-approved-mark {
            color: #2563EB !important;
          }
        }
      `}</style>
    </div>
  );
}
