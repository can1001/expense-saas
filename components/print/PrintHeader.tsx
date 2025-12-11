'use client';

import React from 'react';
import { Expense, formatCurrency } from './types';

interface PrintHeaderProps {
  expense: Expense;
}

export default function PrintHeader({ expense }: PrintHeaderProps) {
  return (
    <table className="print-header-table">
      <colgroup>
        <col style={{ width: '85px' }} />   {/* 1열: 로고 + 좌측결재 */}
        <col style={{ width: '100px' }} />  {/* 2열: 라벨 */}
        <col style={{ width: 'auto' }} />   {/* 3열: 값 */}
        <col style={{ width: '90px' }} />   {/* 4열: 결재란 */}
      </colgroup>
      <tbody>
        {/* ===== 1-2행: 로고 + 지출결의서 + 결재란 ===== */}
        <tr>
          {/* 1열: 로고 (4행 병합) */}
          <td rowSpan={4} className="logo-cell">
            <div className="logo-container">
              <div className="logo-wrapper">
                <div className="logo-circle circle-top">
                  <span className="circle-icon">✝</span>
                  <span className="circle-text">사랑이 넘치는 교회</span>
                </div>
                <div className="logo-middle">
                  <div className="logo-circle circle-left">
                    <span className="circle-icon">☧</span>
                  </div>
                  <div className="logo-circle circle-right">
                    <span className="circle-icon">☘</span>
                    <span className="circle-text">섬김이 넘치는 교회</span>
                  </div>
                </div>
                <div className="logo-circle circle-bottom">
                  <span className="circle-icon">☺</span>
                  <span className="circle-text">기쁨이 넘치는 교회</span>
                </div>
              </div>
            </div>
          </td>
          {/* 2-3열: 지출결의서 제목 (2열 병합, 2행 병합) */}
          <td colSpan={2} rowSpan={2} className="title-cell">
            지 출 결 의 서
          </td>
          {/* 4열: 결재란 (8행 병합) */}
          <td rowSpan={8} className="approval-cell">
            <table className="approval-table">
              <tbody>
                {/* 1행: 재정팀장 */}
                <tr>
                  <th className="approval-title">재정팀장</th>
                </tr>
                {/* 2-3행: 서명란 */}
                <tr>
                  <td rowSpan={2} className="approval-sign"></td>
                </tr>
                <tr></tr>
                {/* 4행: 신 창 국 */}
                <tr>
                  <td className="approval-name">신 창 국</td>
                </tr>
                {/* 5행: 회계 */}
                <tr>
                  <th className="approval-title">회계</th>
                </tr>
                {/* 6-7행: 서명란 */}
                <tr>
                  <td rowSpan={2} className="approval-sign"></td>
                </tr>
                <tr></tr>
                {/* 8행: 윤 운 문 */}
                <tr>
                  <td className="approval-name">윤 운 문</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          {/* 1열: 로고 계속 */}
          {/* 2-3열: 제목 계속 */}
          {/* 4열: 결재란 계속 */}
        </tr>

        {/* ===== 3-4행: 예산항목 ===== */}
        <tr>
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
          {/* 4열: 결재란 계속 */}
        </tr>
        <tr>
          {/* 1열: 로고 계속 */}
          {/* 2열: 예산항목 라벨 계속 */}
          {/* 3열: 예산항목 값 계속 */}
          {/* 4열: 결재란 계속 */}
        </tr>

        {/* ===== 5-6행: 지출일자 + 사역팀(부)장 ===== */}
        <tr>
          {/* 1열: 사역팀(부)장 (1행) */}
          <td className="left-approval-cell">
            <div className="vertical-text">사역팀(부)장</div>
          </td>
          {/* 2열: 지출일자 라벨 (2행 병합) */}
          <td rowSpan={2} className="label-cell">
            지 출 일 자
          </td>
          {/* 3열: 지출일자 값 (2행 병합) */}
          <td rowSpan={2} className="value-cell">
            <div className="notice-box">
              "지출일자"는 재정팀에서 기재합니다.<br />
              (청구일의 다음 주일 날짜로 기재해도 됩니다.)
            </div>
          </td>
          {/* 4열: 결재란 계속 */}
        </tr>
        <tr>
          {/* 1열: 재정팀장 전결 (2행 병합 시작) */}
          <td rowSpan={2} className="left-approval-cell">
            <div className="vertical-text">재정팀장 전결</div>
          </td>
          {/* 2열: 지출일자 라벨 계속 */}
          {/* 3열: 지출일자 값 계속 */}
          {/* 4열: 결재란 계속 */}
        </tr>

        {/* ===== 7-8행: 청구금액 + 재정팀장전결/신창국 ===== */}
        <tr>
          {/* 1열: 재정팀장 전결 계속 */}
          {/* 2열: 청구금액 라벨 (2행 병합) */}
          <td rowSpan={2} className="label-cell">
            청 구 금 액
          </td>
          {/* 3열: 청구금액 값 (2행 병합) */}
          <td rowSpan={2} className="value-cell amount-value">
            ₩ {formatCurrency(expense.requestAmount)} 원
          </td>
          {/* 4열: 결재란 계속 */}
        </tr>
        <tr>
          {/* 1열: 신 창 국 (1행) */}
          <td className="left-approval-cell name-cell">
            <div className="vertical-text">신 창 국</div>
          </td>
          {/* 2열: 청구금액 라벨 계속 */}
          {/* 3열: 청구금액 값 계속 */}
          {/* 4열: 결재란 계속 */}
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

        .logo-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .logo-middle {
          display: flex;
          gap: 2px;
        }

        .logo-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: white;
          font-size: 10px;
        }

        .circle-top {
          background-color: #2e7d32;
        }

        .circle-left {
          background-color: #1565c0;
        }

        .circle-right {
          background-color: #757575;
        }

        .circle-bottom {
          background-color: #f9a825;
        }

        .circle-icon {
          font-size: 12px;
          line-height: 1;
        }

        .circle-text {
          font-size: 3px;
          text-align: center;
          line-height: 1;
          margin-top: 1px;
        }

        /* ===== 제목 셀 ===== */
        .title-cell {
          font-size: 22pt;
          font-weight: bold;
          text-align: center;
          letter-spacing: 18px;
          padding: 12px;
        }

        /* ===== 결재란 ===== */
        .approval-cell {
          padding: 0;
          vertical-align: top;
          width: 90px;
        }

        .approval-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
        }

        .approval-table th,
        .approval-table td {
          border: 1px solid #000;
          text-align: center;
          font-size: 9pt;
          padding: 2px;
        }

        .approval-title {
          background-color: #e8f5e9;
          height: 20px;
          font-weight: bold;
        }

        .approval-sign {
          height: 35px;
        }

        .approval-name {
          height: 18px;
          font-size: 8pt;
          letter-spacing: 3px;
        }

        /* ===== 라벨/값 셀 ===== */
        .label-cell {
          background-color: #e8f5e9;
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
        }

        .budget-value {
          font-weight: bold;
          font-size: 12pt;
        }

        .notice-box {
          background-color: #fff59d;
          padding: 8px 12px;
          font-size: 9pt;
          color: #000;
          line-height: 1.5;
        }

        .amount-value {
          font-size: 16pt;
          font-weight: bold;
        }

        /* ===== 좌측 결재선 ===== */
        .left-approval-cell {
          background-color: #e8f5e9;
          text-align: center;
          padding: 4px 2px;
        }

        .name-cell {
          /* 신창국 셀 */
        }

        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-size: 8pt;
          font-weight: bold;
          white-space: nowrap;
          letter-spacing: 2px;
        }
      `}</style>
    </table>
  );
}
