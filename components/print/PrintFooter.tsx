'use client';

import React from 'react';
import { Expense } from './types';

interface PrintFooterProps {
  expense: Expense;
}

export default function PrintFooter({ expense }: PrintFooterProps) {
  // 청구일자 분리
  const requestDate = new Date(expense.requestDate);
  const year = requestDate.getFullYear();
  const month = requestDate.getMonth() + 1;
  const day = requestDate.getDate();

  return (
    <div className="print-footer-container">
      {/* 청구내역 테이블 */}
      <table className="footer-table">
        <tbody>
          {/* 1행: 청구일자 + 재정팀 출납필 (8열) */}
          <tr>
            <td rowSpan={2} className="section-label">
              청<br />구<br />내<br />역
            </td>
            <td className="label-cell">○ 청구 일자:</td>
            <td className="value-cell">{year} 년</td>
            <td className="value-cell">{month} 월</td>
            <td className="value-cell">{day} 일</td>
            <td className="value-cell">(재정팀)</td>
            <td className="value-cell">출납필</td>
            <td className="value-cell"><span className="seal-mark">(인)</span></td>
          </tr>

          {/* 2행: 청구팀 + 청구인 서명 (핵심) */}
          <tr>
            <td className="label-cell">○ 청구팀(부):</td>
            <td colSpan={2} className="team-cell">
              <span className="committee">{expense.committee}</span>
              <span className="divider">　</span>
              <span className="team">{expense.requestTeam}</span>
            </td>
            <td className="label-cell requester">○ 청구인:</td>
            <td className="name-cell">{expense.applicantName}</td>
            <td className="signature-cell applicant">
              <span className="seal-mark">(인)</span>
            </td>
          </tr>

          {/* 3행: 은행 정보 (핵심) */}
          <tr>
            <td className="label-cell">○ </td>
            <td className="bank-name-cell">{expense.bankName}</td>
            <td className="label-cell">○ 계좌번호:</td>
            <td colSpan={2} className="account-number-cell">
              {expense.accountNumber}
            </td>
            <td className="label-cell">○ 예금주</td>
            <td className="account-holder-cell">{expense.accountHolder}</td>
          </tr>
        </tbody>
      </table>

      {/* 교회명 + 버전 */}
      <div className="church-footer">
        <span className="church-name">청 연 교 회</span>
        <span className="version-text">지출결의서 Ver.4.1.3</span>
      </div>

      <style jsx>{`
        /* 컨테이너 */
        .print-footer-container {
          margin-top: 16px;
        }

        /* 테이블 기본 스타일 */
        .footer-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .footer-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          vertical-align: middle;
          font-size: 10pt;
          background-color: #fff;
        }

        /* 청구내역 세로 라벨 (rowSpan=2) */
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

        /* 라벨 셀 - 굵게, 중앙 정렬 */
        .label-cell {
          text-align: center;
          font-weight: 600;
          white-space: nowrap;
          background-color: #f8f9fa;
          font-size: 10pt;
        }

        /* 값 셀 - 중앙 정렬 */
        .value-cell {
          text-align: center;
          font-size: 10pt;
        }

        .value-cell.date-blank {
          min-width: 50px;
        }

        .label-cell.requester {
          width: 90px;
        }

        /* 1행: 청구일자 셀 */
        .date-cell {
          text-align: left;
          padding-left: 12px;
          font-size: 10pt;
        }

        .date-year {
          font-weight: 600;
          font-size: 10.5pt;
        }

        .date-blank {
          display: inline-block;
          border-bottom: 1px solid #333;
          min-width: 45px;
          text-align: center;
        }

        /* 1행: 재정팀 출납필 서명 셀 */
        .signature-cell {
          text-align: center;
          font-weight: 600;
          font-size: 10pt;
        }

        .signature-cell.treasurer {
          padding: 8px 12px;
        }

        .signature-cell.applicant {
          width: 60px;
        }

        .seal-mark {
          display: inline-block;
          font-weight: 700;
          color: #d32f2f;
          font-size: 10.5pt;
          margin-left: 4px;
        }

        /* 2행: 청구팀(부) 셀 */
        .team-cell {
          text-align: left;
          padding-left: 12px;
          font-size: 10pt;
        }

        .committee {
          font-weight: 600;
        }

        .divider {
          display: inline-block;
          width: 8px;
        }

        .team {
          font-weight: 600;
        }

        /* 2행: 청구인 이름 셀 */
        .name-cell {
          text-align: center;
          font-weight: 700;
          font-size: 11pt;
        }

        /* 3행: 은행 정보 셀들 */
        .bank-name-cell {
          text-align: center;
          font-weight: 600;
          font-size: 10pt;
        }

        .account-number-cell {
          text-align: left;
          padding-left: 12px;
          font-weight: 600;
          font-size: 10pt;
          letter-spacing: 0.3px;
        }

        .account-holder-cell {
          text-align: center;
          font-weight: 600;
          font-size: 10pt;
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
          background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);
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

          .footer-table td {
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
