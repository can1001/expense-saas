'use client';

import React from 'react';
import { Expense } from './types';

interface PrintFooterProps {
  expense: Expense;
}

export default function PrintFooter({ expense }: PrintFooterProps) {
  const requestDate = new Date(expense.requestDate);
  const year = requestDate.getFullYear();
  const month = requestDate.getMonth() + 1;
  const day = requestDate.getDate();

  return (
    <div className="print-footer-container">
      {/* 청구내역 - 1줄 콤팩트형 */}
      <table className="request-table">
        <tbody>
          <tr>
            <td className="request-info-cell">
              <span className="info-label">청구일자:</span>
              <span className="info-value">{year}.{String(month).padStart(2, '0')}.{String(day).padStart(2, '0')}</span>
            </td>
            <td className="request-info-cell">
              <span className="info-label">청구팀(부):</span>
              <span className="info-value">{expense.committee}/{expense.department}</span>
            </td>
            <td className="request-info-cell requester-cell">
              <span className="info-label">청구인:</span>
              <span className="info-value">{expense.applicantName}</span>
              <span className="seal-mark">(인)</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 입금정보 - 1줄 콤팩트형 */}
      <table className="bank-table">
        <tbody>
          <tr>
            <td className="bank-info-cell">
              <span className="info-label">은행:</span>
              <span className="info-value">{expense.bankName}</span>
            </td>
            <td className="bank-info-cell account-cell">
              <span className="info-label">계좌번호:</span>
              <span className="info-value">{expense.accountNumber}</span>
            </td>
            <td className="bank-info-cell">
              <span className="info-label">예금주:</span>
              <span className="info-value">{expense.accountHolder}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 최종확인 - 1줄 통합형 */}
      {/* <table className="confirmation-table">
        <tbody>
          <tr>
            <td className="confirm-cell">
              <span className="confirm-label">재정팀 검토</span>
              <span className="seal-mark">(인)</span>
            </td>
            <td className="confirm-cell">
              <span className="confirm-label">회계 승인</span>
              <span className="seal-mark">(인)</span>
            </td>
            <td className="confirm-cell">
              <span className="confirm-label">지급완료</span>
              <span className="confirm-date">____.____.____</span>
            </td>
          </tr>
        </tbody>
      </table> */}

      {/* 교회명 + 버전 */}
      <div className="church-footer">
        <span className="church-name">청 연 교 회</span>
        <span className="version-text">지출결의서 Ver.4.1.4</span>
      </div>

      <style jsx>{`
        .print-footer-container {
          margin-top: 16px;
        }

        /* 청구내역 테이블 */
        .request-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .request-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          vertical-align: middle;
          font-size: 10pt;
          background-color: #fff;
        }

        /* 입금정보 테이블 */
        .bank-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 8px;
        }

        .bank-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          vertical-align: middle;
          font-size: 10pt;
          background-color: #fff;
        }

        /* 섹션 라벨 */
        .section-label {
          width: 35px;
          text-align: center;
          vertical-align: middle;
          padding: 8px 4px;
          font-weight: 700;
          font-size: 10pt;
          line-height: 1.6;
          letter-spacing: 0.5px;
          background-color: #f8f9fa;
        }

        .bank-label {
          line-height: 1.4;
        }

        /* 라벨 셀 */
        .label-cell {
          text-align: center;
          font-weight: 600;
          white-space: nowrap;
          background-color: #f8f9fa;
          font-size: 10pt;
        }

        /* 청구내역 1줄 콤팩트형 셀 */
        .request-info-cell {
          text-align: center;
          font-size: 10pt;
          padding: 10px 12px;
        }

        .request-info-cell.requester-cell {
          min-width: 140px;
        }

        .info-label {
          font-weight: 600;
          color: #333;
          margin-right: 8px;
        }

        .info-value {
          font-weight: 700;
        }

        .request-info-cell .seal-mark {
          margin-left: 10px;
        }

        .seal-mark {
          display: inline-block;
          font-weight: 700;
          color: #d32f2f;
          font-size: 10.5pt;
        }

        /* 입금정보 1줄 콤팩트형 셀 */
        .bank-info-cell {
          text-align: center;
          font-size: 10pt;
          padding: 10px 12px;
        }

        .bank-info-cell.account-cell {
          flex: 2;
          min-width: 180px;
        }

        .bank-info-cell .info-value {
          letter-spacing: 0.3px;
        }

        /* 최종확인 테이블 */
        .confirmation-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 8px;
        }

        .confirmation-table td {
          border: 1px solid #000;
          padding: 10px 12px;
          vertical-align: middle;
          font-size: 10pt;
          background-color: #fff;
        }

        /* 최종확인 1줄 통합형 셀 */
        .confirm-cell {
          text-align: center;
        }

        .confirm-label {
          font-weight: 600;
          color: #333;
          margin-right: 12px;
        }

        .confirm-date {
          font-weight: 700;
          letter-spacing: 1px;
        }

        /* 교회명 + 버전 */
        .church-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 18px;
          padding: 10px 20px;
          border-top: 2.5px solid #000;
          border-bottom: 1px solid #333;
          background-color: #f5f5f5;
        }

        .church-name {
          font-size: 20pt;
          font-weight: 700;
          letter-spacing: 12px;
          color: #26a69a;
          text-shadow: 0.5px 0.5px 0 rgba(0, 0, 0, 0.1);
        }

        .version-text {
          font-size: 8.5pt;
          color: #666;
          font-weight: 500;
          text-align: right;
        }

        /* 프린트 최적화 */
        @media print {
          .print-footer-container {
            page-break-inside: avoid;
          }

          .request-table td,
          .bank-table td,
          .confirmation-table td {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .church-footer {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .church-name {
            color: #26a69a !important;
          }

          .seal-mark {
            color: #d32f2f !important;
          }
        }
      `}</style>
    </div>
  );
}
