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
  const steps = approvalLine?.steps || [];

  // 지출일자에서 연도 추출
  const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : new Date();
  const year = expenseDate.getFullYear();

  // 결재 단계별로 분리
  const leftStep = steps.find(s => s.stepNumber === 1);
  const rightSteps = steps.filter(s => s.stepNumber !== 1).sort((a, b) => b.stepNumber - a.stepNumber);

  // 우측 결재 셀 (재정팀장, 회계)
  const topRightStep = rightSteps[0]; // 재정팀장
  const bottomRightStep = rightSteps[1]; // 회계

  // 결재 상태 렌더링
  const renderSignature = (step?: typeof steps[0]) => {
    if (!step) return <span className="pending-mark"></span>;

    const isAutoApproved = step.stepName.includes('전결');

    if (step.status === 'APPROVED' && isAutoApproved) {
      // "재정팀장(전결)" -> "재정팀장" + 줄바꿈 + "(전결)"
      const title = step.stepName.replace('(전결)', '').trim();
      return (
        <span className="auto-approved-mark">
          {title}<br/>(전결)
        </span>
      );
    } else if (step.status === 'APPROVED' && step.signatureData) {
      return <img src={step.signatureData} alt="서명" className="signature-image" />;
    } else if (step.status === 'APPROVED') {
      return <span className="approved-mark">승인</span>;
    } else if (step.status === 'REJECTED') {
      return <span className="rejected-mark">반려</span>;
    }
    return <span className="pending-mark"></span>;
  };

  return (
    <div className="print-header-container">
      <table className="header-table">
        <tbody>
          {/* Row 1: 로고(rs=4) + 지출결의서(rs=2,cs=2) + 재정팀장 헤더 */}
          <tr>
            <td className="logo-cell" rowSpan={4}>
              <img src="/logo.png" alt="교회 로고" className="logo-image" />
            </td>
            <td className="title-cell" rowSpan={2} colSpan={2}>
              <h1 className="title-text">지 출 결 의 서</h1>
            </td>
            <td className="approval-header-cell">{topRightStep?.stepName || '재정팀장'}</td>
          </tr>

          {/* Row 2: (지출결의서 계속) + 재정팀장 서명(rs=2) */}
          <tr>
            <td className="approval-sign-cell" rowSpan={2}>
              {renderSignature(topRightStep)}
            </td>
          </tr>

          {/* Row 3: 예산항목(rs=2) + (재정팀장 서명 계속) */}
          <tr>
            <td className="info-label-cell" rowSpan={2}>예산항목<br/>(계정과목)</td>
            <td className="info-value-cell" rowSpan={2}>
              {expense.items?.[0]?.budgetCategory || '-'} / {expense.items?.[0]?.budgetSubcategory || '-'}
            </td>
          </tr>

          {/* Row 4: (예산항목 계속) + 재정팀장 이름 */}
          <tr>
            <td className="approval-name-cell">{formatNameForPrint(topRightStep?.approverName || '')}</td>
          </tr>

          {/* Row 5: 사역팀(부)장 헤더 + 지출일자(rs=2) + 회계 헤더 */}
          <tr>
            <td className="approval-header-cell">사역팀(부)장</td>
            <td className="info-label-cell" rowSpan={2}>지출일자</td>
            <td className="info-value-cell date-cell" rowSpan={2}>
              <span className="year-text">{year}</span> 년
              <span className="date-blank"></span> 월
              <span className="date-blank"></span> 일
            </td>
            <td className="approval-header-cell">{bottomRightStep?.stepName || '회계'}</td>
          </tr>

          {/* Row 6: 사역팀(부)장 서명(rs=2) + (지출일자 계속) + 회계 서명(rs=2) */}
          <tr>
            <td className="approval-sign-cell" rowSpan={2}>
              {renderSignature(leftStep)}
            </td>
            <td className="approval-sign-cell" rowSpan={2}>
              {renderSignature(bottomRightStep)}
            </td>
          </tr>

          {/* Row 7: (서명 계속) + 청구금액(rs=2) + (서명 계속) */}
          <tr>
            <td className="info-label-cell" rowSpan={2}>청구금액</td>
            <td className="info-value-cell amount-cell" rowSpan={2}>
              ₩ {formatCurrency(expense.requestAmount)} 원
            </td>
          </tr>

          {/* Row 8: 사역팀(부)장 이름 + (청구금액 계속) + 회계 이름 */}
          <tr>
            <td className="approval-name-cell">{formatNameForPrint(leftStep?.approverName || '')}</td>
            <td className="approval-name-cell">{formatNameForPrint(bottomRightStep?.approverName || '')}</td>
          </tr>
        </tbody>
      </table>

      <style jsx>{`
        .print-header-container {
          margin-bottom: 0;
        }

        .header-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
        }

        .header-table td {
          border: 1px solid #000;
        }

        /* 로고 셀 */
        .logo-cell {
          width: 90px;
          text-align: center;
          vertical-align: middle;
          padding: 10px;
        }

        .logo-image {
          width: 65px;
          height: auto;
        }

        /* 제목 셀 */
        .title-cell {
          height: 50px;
          text-align: center;
          vertical-align: middle;
          padding: 12px;
        }

        .title-text {
          font-size: 24pt;
          font-weight: bold;
          letter-spacing: 12px;
          margin: 0;
          white-space: nowrap;
        }

        /* 정보 라벨 셀 */
        .info-label-cell {
          width: 100px;
          height: 50px;
          background-color: #f8f8f8;
          font-size: 10pt;
          font-weight: 600;
          text-align: center;
          vertical-align: middle;
          padding: 8px 10px;
          letter-spacing: 1px;
          line-height: 1.4;
        }

        /* 정보 값 셀 */
        .info-value-cell {
          height: 50px;
          font-size: 10pt;
          text-align: center;
          vertical-align: middle;
          padding: 8px 15px;
        }

        .date-cell {
          letter-spacing: 2px;
        }

        .year-text {
          font-weight: 600;
        }

        .date-blank {
          display: inline-block;
          width: 25px;
          margin: 0 3px;
        }

        .amount-cell {
          font-weight: 500;
        }

        /* 결재 헤더 셀 */
        .approval-header-cell {
          width: 70px;
          height: 25px;
          background-color: #f8f8f8;
          font-size: 9pt;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
          padding: 6px 8px;
          white-space: nowrap;
        }

        /* 결재 서명 셀 */
        .approval-sign-cell {
          width: 70px;
          height: 50px;
          text-align: center;
          vertical-align: middle;
          padding: 4px;
        }

        .signature-image {
          max-width: 50px;
          max-height: 45px;
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

        /* 결재 이름 셀 */
        .approval-name-cell {
          width: 70px;
          height: 25px;
          font-size: 9pt;
          text-align: center;
          vertical-align: middle;
          padding: 6px;
          letter-spacing: 3px;
        }

        @media print {
          .print-header-container {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .header-table {
            border: 2px solid #000 !important;
          }

          .info-label-cell,
          .approval-header-cell {
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
