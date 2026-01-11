'use client';

import React from 'react';
import { PrintHeader, PrintItems, PrintFooter } from './print';
import type { Expense, ApprovalLine } from './print/types';

interface PrintableExpenseProps {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
}

export default function PrintableExpense({ expense, approvalLine }: PrintableExpenseProps) {
  return (
    <div className="print-only">
      {/* 1. 지출결의서 상단 (헤더) */}
      <PrintHeader expense={expense} approvalLine={approvalLine} />

      {/* 2. 세목 입력부분 (테이블) */}
      <PrintItems
        items={expense.items}
        totalAmount={expense.requestAmount}
      />

      {/* 3. 청구내역 (푸터) */}
      <PrintFooter expense={expense} />

      {/* 첨부파일이 있는 경우 다음 페이지에 출력 */}
      {expense.attachments && expense.attachments.length > 0 && (
        <div className="attachments-page">
          <h2 className="attachments-title">첨부파일 (영수증)</h2>
          <div className="attachments-grid">
            {expense.attachments.map((attachment, index) => (
              <div key={attachment.id} className="attachment-item">
                <img
                  src={attachment.secureUrl}
                  alt={`첨부파일 ${index + 1}`}
                  className="attachment-image"
                />
                <p className="attachment-name">{attachment.fileName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .print-only {
          display: none;
        }

        @media print {
          .print-only {
            display: block !important;
            width: 210mm;
            min-height: 297mm;
            padding: 8mm 10mm;
            margin: 0 auto;
            background: white;
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            font-size: 10pt;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .attachments-page {
            page-break-before: always;
            padding-top: 10mm;
          }

          .attachments-title {
            text-align: center;
            margin-bottom: 20px;
            font-size: 16pt;
            font-weight: bold;
          }

          .attachments-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            justify-items: center;
          }

          .attachment-item {
            border: 1px solid #ddd;
            padding: 8px;
            max-width: 90mm;
            page-break-inside: avoid;
            text-align: center;
          }

          .attachment-image {
            max-width: 100%;
            max-height: 120mm;
            object-fit: contain;
          }

          .attachment-name {
            font-size: 8pt;
            text-align: center;
            margin-top: 5px;
            color: #666;
          }
        }
      `}</style>
    </div>
  );
}
