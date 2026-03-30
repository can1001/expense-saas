'use client';

import { useState, useEffect, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import BulkPrintableExpenses, { ExpenseWithApproval } from './BulkPrintableExpenses';
import { PrintOptionsSelector, PrintMode } from './print';

interface BulkPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
}

export function BulkPrintModal({
  isOpen,
  onClose,
  selectedIds,
}: BulkPrintModalProps) {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseWithApproval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('both');
  const printContentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 모달이 열릴 때 데이터 조회
  useEffect(() => {
    if (isOpen && selectedIds.length > 0) {
      fetchExpenses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedIds]);

  // 모달이 닫힐 때 초기화
  useEffect(() => {
    if (!isOpen) {
      setExpenses([]);
      setError(null);
    }
  }, [isOpen]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/expenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '데이터 조회에 실패했습니다.');
      }

      setExpenses(data.expenses);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printContentRef.current || !iframeRef.current) return;

    try {
      setPrinting(true);

      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDoc) {
        throw new Error('인쇄 프레임을 초기화할 수 없습니다.');
      }

      // 스타일 수집 (현재 문서의 모든 스타일)
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((style) => style.outerHTML)
        .join('\n');

      // iframe에 컨텐츠 주입
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>지출결의서 일괄 인쇄</title>
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
            .bulk-print-item.page-break {
              page-break-after: always;
            }
            .attachments-page {
              page-break-before: always;
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

      // 인쇄 실행 (약간의 지연 후)
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 모달 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              지출결의서 일괄 인쇄
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? '데이터를 불러오는 중...' : `${expenses.length}건의 지출결의서`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 인쇄 옵션 */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-2">인쇄 옵션</p>
          <PrintOptionsSelector
            value={printMode}
            onChange={setPrintMode}
            disabled={printing}
          />
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
              <p className="text-gray-500">데이터를 불러오는 중입니다...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchExpenses}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                다시 시도
              </button>
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500">인쇄할 지출결의서가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  아래 미리보기는 실제 인쇄 결과와 다를 수 있습니다. 각 지출결의서는 별도 페이지로 인쇄됩니다.
                </p>
              </div>

              {/* 미리보기 목록 */}
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {expenses.map((item, index) => (
                  <div key={item.expense.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.expense.applicantName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {item.expense.committee} / {item.expense.department}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {item.expense.requestAmount.toLocaleString()}원
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.expense.attachments?.length || 0}개 첨부파일
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            disabled={printing}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={loading || printing || expenses.length === 0}
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
                인쇄하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hidden: 인쇄용 컨텐츠 */}
      <div ref={printContentRef} className="hidden">
        {expenses.length > 0 && (
          <BulkPrintableExpenses expenses={expenses} printMode={printMode} />
        )}
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
