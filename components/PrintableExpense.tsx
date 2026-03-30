'use client';

import React from 'react';
import { PrintHeader, PrintItems, PrintFooter } from './print';
import type { Expense, ApprovalLine, ExpenseAttachment } from './print/types';
import type { PrintMode } from './print';

interface PrintableExpenseProps {
  expense: Expense;
  approvalLine?: ApprovalLine | null;
  printMode?: PrintMode;
}

// 첨부파일 타입 분류 (문서 vs 영수증)
// - 문서: 가로/세로 비율 >= 0.6 (A4: 0.707), PDF 파일
// - 영수증: 가로/세로 비율 < 0.6 (세로로 긴 형태)
const classifyAttachment = (attachment: ExpenseAttachment): 'document' | 'receipt' => {
  const { width, height, format } = attachment;

  // PDF는 문서로 처리
  if (format === 'pdf') return 'document';

  // 이미지는 비율로 판별
  if (width && height) {
    const aspectRatio = width / height;
    return aspectRatio >= 0.6 ? 'document' : 'receipt';
  }

  // 기본값: 영수증
  return 'receipt';
};

// 첨부파일을 문서와 영수증으로 그룹화
const groupAttachments = (attachments: ExpenseAttachment[]) => {
  const documents: ExpenseAttachment[] = [];
  const receipts: ExpenseAttachment[] = [];

  attachments.forEach(att => {
    const type = classifyAttachment(att);
    if (type === 'document') {
      documents.push(att);
    } else {
      receipts.push(att);
    }
  });

  return { documents, receipts };
};

// 문서 개수에 따라 그리드 클래스 반환
const getDocumentGridClass = (count: number): string => {
  if (count === 1) return 'doc-single';
  return 'doc-multi';
};

// 영수증 개수에 따라 그리드 클래스 반환
const getReceiptGridClass = (count: number): string => {
  if (count <= 2) return 'receipt-double';
  if (count <= 4) return 'receipt-quad';
  return 'receipt-many';
};

export default function PrintableExpense({ expense, approvalLine, printMode = 'both' }: PrintableExpenseProps) {
  return (
    <div className={`print-only print-mode-${printMode}`}>
      {/* 지출결의서 본문 */}
      <div className="expense-document">
        {/* 1. 지출결의서 상단 (헤더) */}
        <PrintHeader expense={expense} approvalLine={approvalLine} />

        {/* 2. 세목 입력부분 (테이블) */}
        <PrintItems
          items={expense.items}
          totalAmount={expense.requestAmount}
          isSimpleExpense={expense.version === '4.1.4'}
        />

        {/* 3. 청구내역 (푸터) */}
        <PrintFooter expense={expense} />
      </div>

      {/* 첨부파일 페이지 - 항상 렌더링 (양면 인쇄용) */}
      <div className="attachments-page">
        {expense.attachments && expense.attachments.length > 0 ? (
          (() => {
            const { documents, receipts } = groupAttachments(expense.attachments);
            let numberIndex = 0;
            return (
              <>
                <h2 className="attachments-title">첨 부 서 류</h2>
                <p className="attachments-subtitle">(영수증 및 증빙자료)</p>

                {/* 문서류 - 크게 출력 */}
                {documents.length > 0 && (
                  <div className="attachments-section">
                    {receipts.length > 0 && <p className="section-label">문서</p>}
                    <div className={`attachments-grid ${getDocumentGridClass(documents.length)}`}>
                      {documents.map((attachment) => {
                        numberIndex++;
                        return (
                          <div key={attachment.id} className="attachment-item document-item">
                            <div className="attachment-number">{numberIndex}</div>
                            <img
                              src={attachment.secureUrl}
                              alt={`문서 ${numberIndex}`}
                              className="attachment-image"
                            />
                            <p className="attachment-name">{attachment.fileName}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 영수증류 - 적정 크기로 그리드 출력 */}
                {receipts.length > 0 && (
                  <div className="attachments-section">
                    {documents.length > 0 && <p className="section-label">영수증</p>}
                    <div className={`attachments-grid ${getReceiptGridClass(receipts.length)}`}>
                      {receipts.map((attachment) => {
                        numberIndex++;
                        return (
                          <div key={attachment.id} className="attachment-item receipt-item">
                            <div className="attachment-number">{numberIndex}</div>
                            <img
                              src={attachment.secureUrl}
                              alt={`영수증 ${numberIndex}`}
                              className="attachment-image"
                            />
                            <p className="attachment-name">{attachment.fileName}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <div className="no-attachments">
            <p className="no-attachments-text">(첨부서류 없음)</p>
          </div>
        )}
      </div>

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

          /* 지출결의서 본문 (1페이지) - 항상 다음 페이지로 넘김 */
          .expense-document {
            padding: 12mm 15mm;
            page-break-after: always;
          }

          /* 첨부파일 페이지 (2페이지) */
          .attachments-page {
            padding: 12mm 15mm;
            min-height: 250mm;
          }

          /* 첨부파일 없음 상태 */
          .no-attachments {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 250mm;
          }

          .no-attachments-text {
            font-size: 14pt;
            color: #999;
            letter-spacing: 2px;
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
            margin-bottom: 15px;
            font-size: 10pt;
            color: #666;
          }

          .attachments-section {
            margin-bottom: 10mm;
          }

          .section-label {
            font-size: 9pt;
            color: #666;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
          }

          .attachments-grid {
            display: grid;
            gap: 12px;
            justify-items: center;
          }

          /* 문서 - 1장: 크게 출력 */
          .attachments-grid.doc-single {
            grid-template-columns: 1fr;
          }
          .attachments-grid.doc-single .document-item {
            max-width: 170mm;
          }
          .attachments-grid.doc-single .attachment-image {
            max-height: 200mm;
          }

          /* 문서 - 2장 이상: 상하 배치 */
          .attachments-grid.doc-multi {
            grid-template-columns: 1fr;
          }
          .attachments-grid.doc-multi .document-item {
            max-width: 170mm;
          }
          .attachments-grid.doc-multi .attachment-image {
            max-height: 90mm;
          }

          /* 영수증 - 1~2장: 2열 그리드 */
          .attachments-grid.receipt-double {
            grid-template-columns: repeat(2, 1fr);
          }
          .attachments-grid.receipt-double .receipt-item {
            max-width: 80mm;
          }
          .attachments-grid.receipt-double .attachment-image {
            max-height: 100mm;
          }

          /* 영수증 - 3~4장: 2x2 그리드 */
          .attachments-grid.receipt-quad {
            grid-template-columns: repeat(2, 1fr);
          }
          .attachments-grid.receipt-quad .receipt-item {
            max-width: 80mm;
          }
          .attachments-grid.receipt-quad .attachment-image {
            max-height: 90mm;
          }

          /* 영수증 - 5장 이상: 3열 그리드 */
          .attachments-grid.receipt-many {
            grid-template-columns: repeat(3, 1fr);
          }
          .attachments-grid.receipt-many .receipt-item {
            max-width: 55mm;
          }
          .attachments-grid.receipt-many .attachment-image {
            max-height: 70mm;
          }

          .attachment-item {
            border: 1px solid #000;
            padding: 8px;
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
            object-fit: contain;
          }

          .attachment-name {
            font-size: 8pt;
            text-align: center;
            margin-top: 6px;
            color: #333;
            border-top: 1px solid #ddd;
            padding-top: 4px;
            word-break: break-all;
          }

          /* 인쇄 모드별 페이지 선택 */
          .print-mode-expense .attachments-page {
            display: none !important;
          }
          .print-mode-expense .expense-document {
            page-break-after: auto;
          }
          .print-mode-receipt .expense-document {
            display: none !important;
          }
          .print-mode-receipt .attachments-page {
            page-break-before: auto;
          }
        }
      `}</style>
    </div>
  );
}
