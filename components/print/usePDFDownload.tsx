'use client';

import React from 'react';
import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ExpensePDFDocument } from '../PDFDocument';
import type { Expense } from '@/lib/types';
import type { PrintMode } from './PrintOptionsSelector';

interface ApprovalLine {
  id: string;
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    id: string;
    stepNumber: number;
    stepName: string;
    approverName: string;
    status: string;
    approvedAt?: Date | null;
    signatureType?: string | null;
    signatureData?: string | null;
  }>;
}

interface UsePDFDownloadOptions {
  expense: Expense | null;
  approvalLine?: ApprovalLine | null;
}

export function usePDFDownload({ expense, approvalLine }: UsePDFDownloadOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadPDF = useCallback(async (printMode: PrintMode) => {
    if (!expense) {
      setError('지출결의서 데이터가 없습니다.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // PDF 문서 생성
      const doc = <ExpensePDFDocument expense={expense} approvalLine={approvalLine} printMode={printMode} />;
      const blob = await pdf(doc).toBlob();

      // 파일명 생성
      const dateStr = format(new Date(), 'yyyyMMdd');
      const modeSuffix = printMode === 'expense' ? '_결의서' : printMode === 'receipt' ? '_영수증' : '';
      const filename = `지출결의서_${expense.applicantName}_${dateStr}${modeSuffix}.pdf`;

      // 다운로드 실행
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      setError(err instanceof Error ? err.message : 'PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [expense, approvalLine]);

  return {
    downloadPDF,
    loading,
    error,
  };
}
