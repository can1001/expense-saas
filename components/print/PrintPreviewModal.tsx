'use client';

import { useState, useRef } from 'react';
import { Printer, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import PrintOptionsSelector, { PrintMode } from './PrintOptionsSelector';
import PrintableExpense from '../PrintableExpense';
import type { Expense, ApprovalLine } from './types';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense;
  approvalLine?: ApprovalLine | null;
  onDownloadPDF?: (mode: PrintMode) => void;
  pdfLoading?: boolean;
}

export default function PrintPreviewModal({
  isOpen,
  onClose,
  expense,
  approvalLine,
  onDownloadPDF,
  pdfLoading = false,
}: PrintPreviewModalProps) {
  const [printMode, setPrintMode] = useState<PrintMode>('both');
  const [printing, setPrinting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const printContentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    if (!printContentRef.current || !iframeRef.current) return;

    try {
      setPrinting(true);

      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDoc) {
        throw new Error('인쇄 프레임을 초기화할 수 없습니다.');
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((style) => style.outerHTML)
        .join('\n');

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>지출결의서 인쇄</title>
          ${styles}
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${printContentRef.current.innerHTML}
        </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.print();
        setPrinting(false);
      }, 500);
    } catch (err) {
      console.error('Print error:', err);
      alert('인쇄 중 오류가 발생했습니다.');
      setPrinting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getPageCount = () => {
    if (printMode === 'both') return 2;
    return 1;
  };

  const hasAttachments = expense.attachments && expense.attachments.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 모달 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">인쇄 미리보기</h2>
            <p className="text-sm text-gray-500 mt-1">
              {expense.applicantName} / {expense.requestAmount.toLocaleString()}원
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 인쇄 옵션 */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-2">인쇄 옵션</p>
          <PrintOptionsSelector
            value={printMode}
            onChange={(mode) => {
              setPrintMode(mode);
              setCurrentPage(0);
            }}
            disabled={printing || pdfLoading}
          />
        </div>

        {/* 미리보기 영역 */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          {/* 데스크톱: 2페이지 나란히 */}
          <div className="hidden md:flex gap-6 justify-center">
            {/* 1페이지: 지출결의서 */}
            {printMode !== 'receipt' && (
              <div className="bg-white shadow-lg rounded overflow-hidden" style={{ width: '350px', height: '495px' }}>
                <div className="p-4 h-full overflow-hidden">
                  <div className="text-xs text-gray-500 mb-2 text-center font-medium">1페이지 - 지출결의서</div>
                  <div className="border rounded bg-gray-50 h-[calc(100%-24px)] flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-2">지출결의서</div>
                      <div className="text-sm">{expense.applicantName}</div>
                      <div className="text-sm">{expense.requestAmount.toLocaleString()}원</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2페이지: 첨부서류 */}
            {printMode !== 'expense' && (
              <div className="bg-white shadow-lg rounded overflow-hidden" style={{ width: '350px', height: '495px' }}>
                <div className="p-4 h-full overflow-hidden">
                  <div className="text-xs text-gray-500 mb-2 text-center font-medium">
                    {printMode === 'both' ? '2페이지 - ' : ''}첨부서류
                  </div>
                  <div className="border rounded bg-gray-50 h-[calc(100%-24px)] flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-2">첨부서류</div>
                      <div className="text-sm">
                        {hasAttachments
                          ? `${expense.attachments!.length}개 파일`
                          : '첨부파일 없음'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 모바일: 단일 페이지 + 페이지 전환 */}
          <div className="md:hidden">
            <div className="bg-white shadow-lg rounded overflow-hidden mx-auto" style={{ maxWidth: '300px', height: '424px' }}>
              <div className="p-4 h-full overflow-hidden">
                <div className="text-xs text-gray-500 mb-2 text-center font-medium">
                  {printMode === 'both' ? `${currentPage + 1}/${getPageCount()} - ` : ''}
                  {currentPage === 0 && printMode !== 'receipt' ? '지출결의서' : '첨부서류'}
                </div>
                <div className="border rounded bg-gray-50 h-[calc(100%-24px)] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    {currentPage === 0 && printMode !== 'receipt' ? (
                      <>
                        <div className="text-xl font-bold mb-2">지출결의서</div>
                        <div className="text-sm">{expense.applicantName}</div>
                        <div className="text-sm">{expense.requestAmount.toLocaleString()}원</div>
                      </>
                    ) : (
                      <>
                        <div className="text-xl font-bold mb-2">첨부서류</div>
                        <div className="text-sm">
                          {hasAttachments
                            ? `${expense.attachments!.length}개 파일`
                            : '첨부파일 없음'}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 페이지 전환 버튼 (양면 모드일 때만) */}
            {printMode === 'both' && (
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className={`p-3 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    currentPage === 0
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  {[0, 1].map((i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        currentPage === i ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`p-3 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* 안내 메시지 */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              미리보기는 실제 인쇄 결과와 다를 수 있습니다
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 px-6 py-4 border-t bg-gray-50">
          <div>
            {onDownloadPDF && (
              <button
                type="button"
                onClick={() => onDownloadPDF(printMode)}
                className="px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
                disabled={printing || pdfLoading}
              >
                {pdfLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    PDF 생성 중...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    PDF 다운로드
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors min-h-[44px]"
              disabled={printing}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
              disabled={printing || pdfLoading}
            >
              {printing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  인쇄 준비 중...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  인쇄
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden: 인쇄용 컨텐츠 */}
      <div ref={printContentRef} className="hidden">
        <PrintableExpense
          expense={expense}
          approvalLine={approvalLine}
          printMode={printMode}
        />
      </div>

      {/* Hidden: 인쇄용 iframe */}
      <iframe
        ref={iframeRef}
        className="hidden"
        title="print-frame"
      />
    </div>
  );
}
