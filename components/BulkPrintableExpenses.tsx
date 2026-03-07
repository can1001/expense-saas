'use client';

import React from 'react';
import { PrintHeader, PrintItems, PrintFooter } from './print';
import type { Expense, ApprovalLine } from './print/types';

export interface ExpenseWithApproval {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
}

interface BulkPrintableExpensesProps {
  expenses: ExpenseWithApproval[];
}

// 첨부파일 개수에 따라 그리드 클래스 반환
const getGridClass = (count: number): string => {
  if (count === 1) return 'single';
  if (count === 2) return 'double';
  return 'multi';
};

export default function BulkPrintableExpenses({ expenses }: BulkPrintableExpensesProps) {
  return (
    <div className="bulk-print-container">
      {expenses.map((item, index) => (
        <div
          key={item.expense.id}
          className={`bulk-print-item ${index < expenses.length - 1 ? 'page-break' : ''}`}
        >
          {/* 지출결의서 본문 */}
          <div className="expense-document">
            <PrintHeader expense={item.expense} approvalLine={item.approvalLine} />
            <PrintItems
              items={item.expense.items}
              totalAmount={item.expense.requestAmount}
            />
            <PrintFooter expense={item.expense} />
          </div>

          {/* 첨부파일이 있는 경우 */}
          {item.expense.attachments && item.expense.attachments.length > 0 && (
            <div className="attachments-page">
              <h2 className="attachments-title">첨 부 서 류</h2>
              <p className="attachments-subtitle">(영수증 및 증빙자료)</p>
              <div className={`attachments-grid ${getGridClass(item.expense.attachments.length)}`}>
                {item.expense.attachments.map((attachment, attachIndex) => (
                  <div key={attachment.id} className="attachment-item">
                    <div className="attachment-number">{attachIndex + 1}</div>
                    <img
                      src={attachment.secureUrl}
                      alt={`첨부파일 ${attachIndex + 1}`}
                      className="attachment-image"
                    />
                    <p className="attachment-name">{attachment.fileName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <style jsx>{`
        .bulk-print-container {
          width: 210mm;
          margin: 0 auto;
          background: white;
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
          font-size: 10pt;
          color: #000;
        }

        .bulk-print-item {
          width: 210mm;
          min-height: 297mm;
          background: white;
        }

        .bulk-print-item.page-break {
          page-break-after: always;
        }

        .expense-document {
          padding: 12mm 15mm;
        }

        /* 첨부파일 페이지 스타일 */
        .attachments-page {
          page-break-before: always;
          padding: 15mm;
          min-height: 297mm;
          box-sizing: border-box;
        }

        .attachments-title {
          text-align: center;
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 5mm;
          letter-spacing: 8px;
        }

        .attachments-subtitle {
          text-align: center;
          font-size: 10pt;
          color: #666;
          margin-bottom: 10mm;
        }

        .attachments-grid {
          display: flex;
          flex-direction: column;
          gap: 10mm;
          align-items: center;
        }

        .attachments-grid.single .attachment-item {
          max-width: 170mm;
          max-height: 220mm;
        }

        .attachments-grid.double .attachment-item {
          max-width: 170mm;
          max-height: 110mm;
        }

        .attachments-grid.multi {
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: center;
        }

        .attachments-grid.multi .attachment-item {
          max-width: 90mm;
          max-height: 120mm;
        }

        .attachment-item {
          position: relative;
          text-align: center;
        }

        .attachment-number {
          position: absolute;
          top: -10px;
          left: -10px;
          width: 24px;
          height: 24px;
          background-color: #333;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }

        .attachment-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border: 1px solid #ddd;
        }

        .attachment-name {
          font-size: 8pt;
          color: #666;
          margin-top: 2mm;
          word-break: break-all;
        }

        @media print {
          .bulk-print-container {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
