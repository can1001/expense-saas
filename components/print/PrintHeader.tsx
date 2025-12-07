'use client';

import React from 'react';
import { Expense, formatCurrency } from './types';

interface PrintHeaderProps {
  expense: Expense;
}

export default function PrintHeader({ expense }: PrintHeaderProps) {
  return (
    <table className="print-header-table">
      <tbody>
        {/* 1행: 로고 + 제목 + 결재란 */}
        <tr>
          {/* 로고 영역 */}
          <td rowSpan={4} className="logo-cell">
            <div className="logo-container">
              <div className="logo-circles">
                <div className="circle circle-1">
                  <span className="circle-icon">&#9769;</span>
                  <span className="circle-text">사랑이 넘치는 교회</span>
                </div>
                <div className="circle circle-2">
                  <span className="circle-icon">&#10013;</span>
                </div>
                <div className="circle circle-3">
                  <span className="circle-icon">&#9752;</span>
                  <span className="circle-text">섬김이 넘치는 교회</span>
                </div>
                <div className="circle circle-4">
                  <span className="circle-icon">&#9786;</span>
                  <span className="circle-text">기쁨이 넘치는 교회</span>
                </div>
              </div>
            </div>
          </td>
          {/* 제목 */}
          <td colSpan={2} className="title-cell">
            지 출 결 의 서
          </td>
          {/* 결재란 */}
          <td rowSpan={4} className="approval-cell">
            <table className="approval-table">
              <tbody>
                <tr>
                  <th>재정팀장</th>
                  <th></th>
                  <th>회계</th>
                  <th></th>
                </tr>
                <tr className="approval-sign-row">
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>

        {/* 2행: 예산항목 */}
        <tr>
          <td className="label-cell">
            예 산 항 목<br />
            <span className="sub-label">(계정과목)</span>
          </td>
          <td className="value-cell budget-value">
            {expense.budgetCategory} / {expense.budgetSubcategory}
          </td>
        </tr>

        {/* 3행: 지출일자 - 사역팀(부)장/재정팀장 전결 표시 */}
        <tr>
          <td className="label-cell">지 출 일 자</td>
          <td className="value-cell notice-cell">
            <div className="notice-box">
              "지출일자"는 재정팀에서 기재합니다.<br />
              (청구일의 다음 주일 날짜로 기재해도 됩니다.)
            </div>
          </td>
        </tr>

        {/* 4행: 청구금액 */}
        <tr>
          <td className="label-cell">청 구 금 액</td>
          <td className="value-cell amount-value">
            ₩ {formatCurrency(expense.requestAmount)} 원
          </td>
        </tr>
      </tbody>

      {/* 좌측 결재선 표시 */}
      <tbody className="left-approval">
        <tr>
          <td rowSpan={3} className="left-label-cell">
            <div className="vertical-text">사역팀(부)장</div>
          </td>
        </tr>
        <tr>
          <td rowSpan={2} className="left-label-cell">
            <div className="vertical-text">재정팀장 전결</div>
          </td>
        </tr>
        <tr>
          <td className="left-label-cell">
            <div className="vertical-text">신 창 국</div>
          </td>
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

        .logo-cell {
          width: 85px;
          padding: 5px;
          text-align: center;
          vertical-align: middle;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .logo-circles {
          position: relative;
          width: 70px;
          height: 70px;
        }

        .circle {
          position: absolute;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          font-size: 6px;
          color: white;
        }

        .circle-icon {
          font-size: 12px;
        }

        .circle-text {
          font-size: 4px;
          text-align: center;
          line-height: 1.1;
        }

        .circle-1 { top: 0; left: 17px; background: #2e7d32; }
        .circle-2 { top: 17px; left: 0; background: #1565c0; }
        .circle-3 { top: 17px; right: 0; background: #757575; }
        .circle-4 { bottom: 0; left: 17px; background: #f9a825; }

        .title-cell {
          font-size: 24pt;
          font-weight: bold;
          text-align: center;
          letter-spacing: 20px;
          padding: 15px;
          height: 60px;
        }

        .approval-cell {
          width: 180px;
          padding: 0;
          vertical-align: top;
        }

        .approval-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
        }

        .approval-table th,
        .approval-table td {
          border: 1px solid #000;
          width: 25%;
          text-align: center;
          font-size: 9pt;
          padding: 3px;
        }

        .approval-table th {
          background-color: #e8f5e9;
          height: 25px;
        }

        .approval-sign-row td {
          height: 50px;
        }

        .label-cell {
          background-color: #e8f5e9;
          font-weight: bold;
          text-align: center;
          width: 100px;
          font-size: 10pt;
          padding: 8px 5px;
        }

        .sub-label {
          font-size: 8pt;
          font-weight: normal;
        }

        .value-cell {
          padding: 8px 12px;
        }

        .budget-value {
          font-weight: bold;
          font-size: 12pt;
        }

        .notice-cell {
          padding: 0;
        }

        .notice-box {
          background-color: #fff59d;
          padding: 8px 12px;
          font-size: 9pt;
          color: #000;
          line-height: 1.4;
        }

        .amount-value {
          font-size: 16pt;
          font-weight: bold;
        }

        .left-approval {
          position: absolute;
          left: -30px;
          top: 60px;
        }

        .left-label-cell {
          width: 25px;
          background-color: #e8f5e9;
          font-size: 8pt;
        }

        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          white-space: nowrap;
          padding: 5px 2px;
        }
      `}</style>
    </table>
  );
}
