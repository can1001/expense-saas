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
      {/* 지출결의서 본문 */}
      <div className="expense-document">
        {/* 1. 지출결의서 상단 (헤더) */}
        <PrintHeader expense={expense} approvalLine={approvalLine} />

        {/* 2. 세목 입력부분 (테이블) */}
        <PrintItems
          items={expense.items}
          totalAmount={expense.requestAmount}
        />

        {/* 3. 청구내역 (푸터) */}
        <PrintFooter expense={expense} />
      </div>

      {/* 첨부파일이 있는 경우 다음 페이지에 출력 */}
      {expense.attachments && expense.attachments.length > 0 && (
        <div className="attachments-page">
          <h2 className="attachments-title">첨 부 서 류</h2>
          <p className="attachments-subtitle">(영수증 및 증빙자료)</p>
          <div className="attachments-grid">
            {expense.attachments.map((attachment, index) => (
              <div key={attachment.id} className="attachment-item">
                <div className="attachment-number">{index + 1}</div>
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
            margin: 0 auto;
            background: white;
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            font-size: 10pt;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .expense-document {
            padding: 12mm 15mm;
          }

          /* 첨부파일 페이지 */
          .attachments-page {
            page-break-before: always;
            padding: 12mm 15mm;
          }

          .attachments-title {
            text-align: center;
            margin-bottom: 4px;
            font-size: 18pt;
            font-weight: bold;
            letter-spacing: 8px;
            padding-left: 8px;
          }

          .attachments-subtitle {
            text-align: center;
            margin-bottom: 20px;
            font-size: 10pt;
            color: #666;
          }

          .attachments-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            justify-items: center;
          }

          .attachment-item {
            border: 1px solid #000;
            padding: 10px;
            max-width: 85mm;
            page-break-inside: avoid;
            text-align: center;
            position: relative;
          }

          .attachment-number {
            position: absolute;
            top: -10px;
            left: -10px;
            width: 24px;
            height: 24px;
            background-color: #333;
            color: #fff;
            font-size: 10pt;
            font-weight: bold;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .attachment-image {
            max-width: 100%;
            max-height: 110mm;
            object-fit: contain;
          }

          .attachment-name {
            font-size: 8pt;
            text-align: center;
            margin-top: 8px;
            color: #333;
            border-top: 1px solid #ddd;
            padding-top: 6px;
          }
        }
      `}</style>
    </div>
  );
}
