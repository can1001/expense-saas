'use client';

import React from 'react';

interface SimpleExpenseItem {
  id: string;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order: number;
}

interface SimpleExpenseAttachment {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

interface SimpleExpense {
  id: string;
  expenseDate: string | null;
  requestAmount: number;
  requestDate: string;
  applicantName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  version: string;
  createdAt: string;
  items: SimpleExpenseItem[];
  attachments: SimpleExpenseAttachment[];
}

interface SimplePrintableExpenseProps {
  expense: SimpleExpense;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR');
}

export default function SimplePrintableExpense({ expense }: SimplePrintableExpenseProps) {
  // 지출일자 분리 (없으면 빈칸)
  const expenseDate = expense.expenseDate ? new Date(expense.expenseDate) : null;
  const expenseYear = expenseDate ? expenseDate.getFullYear() : '';
  const expenseMonth = expenseDate ? expenseDate.getMonth() + 1 : '';
  const expenseDay = expenseDate ? expenseDate.getDate() : '';

  // 청구일자 분리
  const requestDate = new Date(expense.requestDate);
  const requestYear = requestDate.getFullYear();
  const requestMonth = requestDate.getMonth() + 1;
  const requestDay = requestDate.getDate();

  // 빈 행 채우기 (최대 10행)
  const emptyRows = Math.max(0, 10 - expense.items.length);

  return (
    <div className="print-only">
      {/* ===== 1. 헤더 (지출결의서 제목 + 결재란) ===== */}
      <table className="print-header-table">
        <colgroup><col style={{ width: '85px' }} /><col style={{ width: '100px' }} /><col style={{ width: 'auto' }} /><col style={{ width: '90px' }} /></colgroup>
        <tbody>
          {/* 1행: 로고 + 지출결의서 제목 + 재정팀장 */}
          <tr style={{ height: '25px' }}>
            <td rowSpan={4} className="logo-cell">
              <div className="logo-container">
                <img src="/logo.png" alt="교회 로고" className="logo-image" />
              </div>
            </td>
            <td colSpan={2} rowSpan={2} className="title-cell">
              지 출 결 의 서
            </td>
            <td className="approval-title">재정팀장</td>
          </tr>

          {/* 2행: 재정팀장 서명란 */}
          <tr style={{ height: '25px' }}>
            <td rowSpan={2} className="approval-sign"></td>
          </tr>

          {/* 3행: 예산항목 (하단 예산항목 참조) */}
          <tr style={{ height: '25px' }}>
            <td rowSpan={2} className="label-cell">
              예 산 항 목<br />
              <span className="sub-label">(계정과목)</span>
            </td>
            <td rowSpan={2} className="value-cell budget-value">
              하단 예산항목 참조
            </td>
          </tr>

          {/* 4행: 예산항목 계속 + 신창국 */}
          <tr style={{ height: '25px' }}>
            <td className="approval-name">신 창 국</td>
          </tr>

          {/* 5행: 사역팀(부)장 + 지출일자 + 회계 */}
          <tr style={{ height: '25px' }}>
            <td className="left-approval-cell">사역팀(부)장</td>
            <td rowSpan={2} className="label-cell">지 출 일 자</td>
            <td rowSpan={2} className="value-cell">
              <div className="notice-box">
                {expenseYear} 년 {expenseMonth} 월 {expenseDay} 일
              </div>
            </td>
            <td className="approval-title">회계</td>
          </tr>

          {/* 6행: 재정팀장 전결 + 지출일자 계속 + 회계 서명란 */}
          <tr style={{ height: '25px' }}>
            <td rowSpan={2} className="left-approval-cell">재정팀장 전결</td>
            <td rowSpan={2} className="approval-sign"></td>
          </tr>

          {/* 7행: 재정팀장 전결 계속 + 청구금액 */}
          <tr style={{ height: '25px' }}>
            <td rowSpan={2} className="label-cell">청 구 금 액</td>
            <td rowSpan={2} className="value-cell amount-value">
              ₩ {formatCurrency(expense.requestAmount)} 원
            </td>
          </tr>

          {/* 8행: 신창국 + 청구금액 계속 + 윤운문 */}
          <tr style={{ height: '25px' }}>
            <td className="left-approval-cell name-cell">신 창 국</td>
            <td className="approval-name">윤 운 문</td>
          </tr>
        </tbody>
      </table>

      {/* ===== 2. 세부 항목 테이블 (7열: 항/목/세목/적요/단가/수량/금액) ===== */}
      <div className="print-items-container">
        {/* 안내 문구 */}
        <div className="notice-text">
          ※ 아래 예시 참조하여 【예산항목(항/목/세목), 적요, 단가, 인원(수량)】 등 자세하게 기록하여 주세요.
        </div>

        {/* 세목 테이블 */}
        <table className="items-table">
          <thead>
            <tr>
              <th className="col-category">예산(항)</th>
              <th className="col-subcategory">예산(목)</th>
              <th className="col-detail">예산(세목)</th>
              <th className="col-desc">적 요</th>
              <th className="col-price">단가</th>
              <th className="col-qty">수량</th>
              <th className="col-amount">금액</th>
            </tr>
          </thead>
          <tbody>
            {expense.items.map((item) => (
              <tr key={item.id}>
                <td className="cell-category">{item.budgetCategory}</td>
                <td className="cell-subcategory">{item.budgetSubcategory}</td>
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
                <td className="cell-category">&nbsp;</td>
                <td className="cell-subcategory">&nbsp;</td>
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
              <td colSpan={6} className="total-label">합 계</td>
              <td className="total-amount">{formatCurrency(expense.requestAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ===== 3. 푸터 (청구 정보 + 은행 정보) ===== */}
      <div className="print-footer">
        <div className="footer-row">
          <span className="footer-label">○ 청 구 일 자:</span>
          <span className="footer-value">
            {requestYear}년 {requestMonth}월 {requestDay}일
          </span>
        </div>

        <div className="footer-row">
          <span className="footer-label">○ 청 구 인:</span>
          <span className="footer-value">{expense.applicantName} (인)</span>
        </div>

        <div className="footer-row bank-row">
          <span className="footer-label">○ {expense.bankName}</span>
          <span className="footer-label">○ 계좌번호: {expense.accountNumber}</span>
          <span className="footer-label">○ 예금주: {expense.accountHolder}</span>
        </div>
      </div>

      {/* ===== 첨부파일 페이지 ===== */}
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

          /* ===== 헤더 테이블 스타일 ===== */
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

          .logo-image {
            width: 70px;
            height: auto;
            object-fit: contain;
          }

          .title-cell {
            font-size: 22pt;
            font-weight: bold;
            text-align: center;
            letter-spacing: 18px;
            padding: 12px;
          }

          .approval-title {
            background-color: #fff;
            height: 25px;
            font-weight: bold;
            text-align: center;
            font-size: 9pt;
            padding: 2px;
          }

          .approval-sign {
            height: 50px;
            background-color: #fff;
          }

          .approval-name {
            height: 25px;
            font-size: 8pt;
            letter-spacing: 3px;
            text-align: center;
            background-color: #fff;
          }

          .label-cell {
            background-color: #fff;
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
            text-align: center;
            vertical-align: middle;
          }

          .budget-value {
            font-weight: bold;
            font-size: 11pt;
            color: #0066cc;
          }

          .notice-box {
            background-color: #fff;
            padding: 8px 12px;
            font-size: 10pt;
            color: #000;
            line-height: 1.5;
            text-align: center;
            letter-spacing: 8px;
          }

          .amount-value {
            font-size: 16pt;
            font-weight: bold;
          }

          .left-approval-cell {
            background-color: #fff;
            text-align: center;
            vertical-align: middle;
            padding: 4px 2px;
            font-size: 8pt;
            font-weight: bold;
            height: 25px;
          }

          .name-cell {
            font-size: 9pt;
            letter-spacing: 3px;
          }

          /* ===== 세부 항목 테이블 스타일 ===== */
          .print-items-container {
            margin-top: 8px;
          }

          .notice-text {
            font-size: 9pt;
            color: #0066cc;
            margin-bottom: 3px;
            padding-left: 2px;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
          }

          .items-table th,
          .items-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            text-align: center;
            vertical-align: middle;
          }

          .items-table th {
            background-color: #c8e6c9;
            font-weight: bold;
            font-size: 9pt;
            height: 30px;
          }

          .col-category { width: 12%; }
          .col-subcategory { width: 12%; }
          .col-detail { width: 12%; }
          .col-desc { width: 30%; }
          .col-price { width: 10%; }
          .col-qty { width: 8%; }
          .col-amount { width: 14%; }

          .items-table tbody tr {
            height: 28px;
          }

          .empty-row {
            height: 28px;
          }

          .cell-category,
          .cell-subcategory,
          .cell-detail {
            font-size: 8pt;
          }

          .cell-desc {
            text-align: left;
            padding-left: 8px !important;
            font-size: 8pt;
          }

          .cell-price {
            text-align: right;
            padding-right: 8px !important;
            font-size: 8pt;
          }

          .cell-qty {
            font-size: 8pt;
          }

          .cell-amount {
            text-align: right;
            padding-right: 8px !important;
            font-size: 8pt;
          }

          .total-row {
            background-color: #f5f5f5;
          }

          .total-label {
            text-align: right;
            padding-right: 15px !important;
            font-weight: bold;
            font-size: 10pt;
            letter-spacing: 5px;
          }

          .total-amount {
            text-align: right;
            padding-right: 8px !important;
            font-weight: bold;
            font-size: 10pt;
          }

          /* ===== 푸터 스타일 ===== */
          .print-footer {
            margin-top: 15px;
            padding: 10px;
            border: 1px solid #000;
          }

          .footer-row {
            margin-bottom: 8px;
            font-size: 10pt;
          }

          .footer-row:last-child {
            margin-bottom: 0;
          }

          .footer-label {
            font-weight: bold;
            margin-right: 8px;
          }

          .footer-value {
            font-size: 10pt;
          }

          .bank-row {
            display: flex;
            gap: 20px;
          }

          /* ===== 첨부파일 페이지 ===== */
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
