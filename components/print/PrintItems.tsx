'use client';

import React from 'react';
import { ExpenseItem, formatCurrency } from './types';

interface PrintItemsProps {
  items: ExpenseItem[];
  totalAmount: number;
}

export default function PrintItems({ items, totalAmount }: PrintItemsProps) {
  // 빈 행 채우기 (최대 12행)
  const emptyRows = Math.max(0, 12 - items.length);

  return (
    <div className="print-items-container">
      {/* 안내 문구 */}
      <div className="notice-text">
        ※ 아래 예시 참조하여 【세목, 행사일자, 행사명과 내용, 단가, 인원(수량)】 등 자세하게 기록하여 주세요.
      </div>

      {/* 예시 행 */}
      <div className="example-row">
        <span className="example-label">행사비(리더세미나)</span>
        <span className="example-content">2/8 유치부 교사 성경학교 준비 다과비</span>
        <span className="example-price">3,000</span>
        <span className="example-qty">35</span>
        <span className="example-amount">105,000</span>
      </div>

      {/* 세목 테이블 */}
      <table className="items-table">
        <thead>
          <tr>
            <th className="col-no">순번</th>
            <th className="col-detail">세 목</th>
            <th className="col-desc">적 요</th>
            <th className="col-price">단 가</th>
            <th className="col-qty">수량</th>
            <th className="col-amount">금 액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="cell-no">{index + 1}</td>
              <td className="cell-detail">{item.budgetDetail}</td>
              <td className="cell-desc">{item.description}</td>
              <td className="cell-price">{formatCurrency(item.unitPrice)}</td>
              <td className="cell-qty">{item.quantity}</td>
              <td className="cell-amount">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
          {/* 빈 행 */}
          {Array.from({ length: emptyRows }).map((_, index) => (
            <tr key={`empty-${index}`} className="empty-row">
              <td className="cell-no">&nbsp;</td>
              <td className="cell-detail">&nbsp;</td>
              <td className="cell-desc">&nbsp;</td>
              <td className="cell-price">&nbsp;</td>
              <td className="cell-qty">&nbsp;</td>
              <td className="cell-amount">&nbsp;</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={5} className="total-label">합 계</td>
            <td className="total-amount">{formatCurrency(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>

      <style jsx>{`
        .print-items-container {
          margin-top: 0;
        }

        .notice-text {
          font-size: 9pt;
          color: #0066cc;
          margin-bottom: 3px;
          padding-left: 2px;
        }

        .example-row {
          display: flex;
          align-items: center;
          background-color: #f0f7ff;
          border: 2px solid #000;
          border-bottom: none;
          font-size: 8pt;
          color: #0066cc;
          padding: 4px 8px;
        }

        .example-label {
          width: 18%;
          font-weight: bold;
          padding-left: 8%;
          white-space: nowrap;
        }

        .example-content {
          width: 34%;
        }

        .example-price {
          width: 14%;
          text-align: right;
          padding-right: 10px;
        }

        .example-qty {
          width: 8%;
          text-align: center;
        }

        .example-amount {
          width: 18%;
          text-align: right;
          padding-right: 10px;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          border-top: none;
          border-bottom: none;
        }

        .items-table th,
        .items-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          text-align: center;
          vertical-align: middle;
        }

        .items-table th {
          background-color: #f8f8f8;
          font-weight: bold;
          font-size: 10pt;
          height: 38px;
          letter-spacing: 2px;
        }

        /* 컬럼 폭 */
        .col-no { width: 8%; }
        .col-detail { width: 18%; }
        .col-desc { width: 34%; }
        .col-price { width: 14%; }
        .col-qty { width: 8%; }
        .col-amount { width: 18%; }

        .items-table tbody tr {
          height: 34px;
        }

        .empty-row {
          height: 34px;
        }

        .cell-no {
          font-size: 9pt;
        }

        .cell-detail {
          font-size: 9pt;
          text-align: left;
          padding-left: 8px !important;
        }

        .cell-desc {
          text-align: left;
          padding-left: 10px !important;
          font-size: 9pt;
        }

        .cell-price {
          text-align: right;
          padding-right: 10px !important;
          font-size: 9pt;
        }

        .cell-qty {
          font-size: 9pt;
        }

        .cell-amount {
          text-align: right;
          padding-right: 10px !important;
          font-size: 9pt;
          font-weight: 500;
        }

        .total-row {
          background-color: #f8f8f8;
          border-top: 3px double #000;
          height: 40px;
        }

        .total-label {
          text-align: right;
          padding-right: 20px !important;
          font-weight: bold;
          font-size: 11pt;
          letter-spacing: 8px;
        }

        .total-amount {
          text-align: right;
          padding-right: 10px !important;
          font-weight: bold;
          font-size: 12pt;
        }

        @media print {
          .example-row {
            background-color: #fffde7 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .items-table {
            border: 2px solid #000 !important;
            border-top: none !important;
            border-bottom: none !important;
          }

          .items-table th {
            background-color: #f8f8f8 !important;
          }

          .total-row {
            background-color: #f8f8f8 !important;
            border-top: 3px double #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
