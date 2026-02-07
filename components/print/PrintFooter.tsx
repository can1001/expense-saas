'use client';

import React from 'react';
import { Expense } from './types';

interface PrintFooterProps {
  expense: Expense;
}

function formatNameForPrint(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.split('').join(' ');
}

export default function PrintFooter({ expense }: PrintFooterProps) {
  const requestDate = new Date(expense.requestDate);
  const year = requestDate.getFullYear();
  const month = requestDate.getMonth() + 1;
  const day = requestDate.getDate();

  return (
    <div className="print-footer-container">
      {/* 청구/입금 정보 테이블 */}
      <table className="footer-table">
        <tbody>
          {/* 청구 정보 */}
          <tr>
            <td className="label-cell">청구일자</td>
            <td className="value-cell">{year}년 {String(month).padStart(2, '0')}월 {String(day).padStart(2, '0')}일</td>
            <td className="label-cell">청 구 인</td>
            <td className="value-cell requester-cell">
              <span className="requester-name">{formatNameForPrint(expense.applicantName)}</span>
              <span className="seal-mark">(인)</span>
            </td>
          </tr>
          {/* 입금 정보 - 은행/계좌 */}
          <tr>
            <td className="label-cell">입금은행</td>
            <td className="value-cell">{expense.bankName}</td>
            <td className="label-cell">계좌번호</td>
            <td className="value-cell">{expense.accountNumber}</td>
          </tr>
          {/* 입금 정보 - 예금주/청구팀 */}
          <tr>
            <td className="label-cell">예 금 주</td>
            <td className="value-cell">{expense.accountHolder}</td>
            <td className="label-cell">청구팀(부)</td>
            <td className="value-cell">{expense.committee} / {expense.department}</td>
          </tr>
        </tbody>
      </table>

      {/* 교회명 푸터 */}
      <div className="church-footer">
        <span className="church-name">청 연 교 회</span>
      </div>

      <style jsx>{`
        .print-footer-container {
          margin-top: 0;
        }

        /* 푸터 테이블 */
        .footer-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          border-top: none;
        }

        .footer-table tr {
          border-bottom: 1px solid #000;
        }

        .footer-table tr:last-child {
          border-bottom: none;
        }

        /* 라벨 셀 */
        .label-cell {
          width: 100px;
          background-color: #f8f8f8;
          font-size: 10pt;
          font-weight: 600;
          text-align: center;
          padding: 10px 12px;
          border-right: 1px solid #000;
          letter-spacing: 2px;
        }

        /* 값 셀 */
        .value-cell {
          font-size: 10pt;
          padding: 10px 15px;
          border-right: 1px solid #000;
        }

        .value-cell:last-child {
          border-right: none;
        }

        /* 청구인 셀 */
        .requester-cell {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .requester-name {
          font-weight: 600;
          letter-spacing: 4px;
        }

        .seal-mark {
          font-weight: 700;
          color: #d32f2f;
          font-size: 11pt;
          margin-left: 10px;
        }

        /* 교회명 푸터 */
        .church-footer {
          margin-top: 20px;
          text-align: center;
          padding: 10px 0;
        }

        .church-name {
          font-size: 16pt;
          font-weight: 700;
          letter-spacing: 14px;
          color: #333;
          padding-left: 14px;
        }

        /* 프린트 최적화 */
        @media print {
          .print-footer-container {
            page-break-inside: avoid;
          }

          .footer-table {
            border: 2px solid #000 !important;
            border-top: none !important;
          }

          .label-cell {
            background-color: #f8f8f8 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .seal-mark {
            color: #d32f2f !important;
          }
        }
      `}</style>
    </div>
  );
}
