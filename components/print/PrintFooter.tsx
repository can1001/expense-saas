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
          {/* 1행: 청구일자 + 출납필 */}
          <tr>
            <td rowSpan={2} className="section-label">
              <div className="vertical-text">
                청<br />구<br />내<br />역
              </div>
            </td>
            <td className="field-label">○ 청구 일자:</td>
            <td className="field-value date-value">
              <span className="year">{year}</span> 년
              <span className="month">{month}</span> 월
              <span className="day">{day}</span> 일
            </td>
            <td className="spacer"></td>
            <td className="stamp-cell">
              (재정팀)출납필 &nbsp;&nbsp; (인)
            </td>
          </tr>

          {/* 2행: 청구팀 + 청구인 */}
          <tr>
            <td className="field-label">○ 청구팀(부):</td>
            <td className="field-value">
              {expense.committee} &nbsp;&nbsp;&nbsp;&nbsp; {expense.requestTeam}
            </td>
            <td className="field-label inner-label">○ 청구인:</td>
            <td className="field-value applicant-value">
              {expense.applicantName} &nbsp;&nbsp;&nbsp;&nbsp; (인)
            </td>
          </tr>

          {/* 3행: 은행 정보 */}
          <tr>
            <td className="bank-label">○</td>
            <td className="bank-name">{expense.bankName}</td>
            <td className="field-value account-value">
              ○ 계좌번호: &nbsp; {expense.accountNumber}
            </td>
            <td className="field-label inner-label">○ 예금주</td>
            <td className="field-value holder-value">{expense.accountHolder}</td>
          </tr>
        </tbody>
      </table>

      {/* 교회명 + 버전 */}
      <div className="church-footer">
        <div className="church-name">창 연 교 회</div>
        <div className="version-text">지출결의서 Ver.4.1.3</div>
      </div>

      <style jsx>{`
        .print-footer-container {
          margin-top: 12px;
        }

        .footer-table {
          width: 100%;
          border-collapse: collapse;
        }

        .footer-table td {
          border: 1px solid #000;
          padding: 8px;
          vertical-align: middle;
          font-size: 10pt;
        }

        .section-label {
          width: 30px;
          background-color: #e8f5e9;
          text-align: center;
          padding: 5px;
        }

        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-weight: bold;
          font-size: 9pt;
          letter-spacing: 3px;
        }

        .field-label {
          background-color: #e8f5e9;
          font-weight: bold;
          width: 90px;
          text-align: center;
          font-size: 9pt;
        }

        .field-value {
          font-size: 10pt;
        }

        .date-value {
          width: 180px;
        }

        .date-value .year {
          display: inline-block;
          width: 50px;
          text-align: center;
          border-bottom: 1px solid #000;
          margin-right: 3px;
        }

        .date-value .month {
          display: inline-block;
          width: 30px;
          text-align: center;
          border-bottom: 1px solid #000;
          margin: 0 3px;
        }

        .date-value .day {
          display: inline-block;
          width: 30px;
          text-align: center;
          border-bottom: 1px solid #000;
          margin: 0 3px;
        }

        .spacer {
          border: none !important;
          width: 20px;
        }

        .stamp-cell {
          text-align: right;
          padding-right: 15px !important;
          font-size: 9pt;
        }

        .inner-label {
          width: 70px;
        }

        .applicant-value {
          text-align: left;
        }

        .bank-label {
          width: 30px;
          text-align: center;
          font-weight: bold;
        }

        .bank-name {
          width: 90px;
          text-align: center;
          font-weight: bold;
        }

        .account-value {
          text-align: left;
        }

        .holder-value {
          text-align: center;
        }

        .church-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 15px;
          padding: 0 10px;
        }

        .church-name {
          font-size: 20pt;
          font-weight: bold;
          color: #26a69a;
          letter-spacing: 8px;
          font-family: '궁서', 'Gungsuh', serif;
        }

        .version-text {
          font-size: 8pt;
          color: #666;
        }
      `}</style>
    </div>
  );
}
