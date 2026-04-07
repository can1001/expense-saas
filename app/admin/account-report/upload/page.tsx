/**
 * 재정보고서 업로드 페이지
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_LG,
  SPINNER,
  ALERT_ERROR,
  INPUT_BASE,
  LABEL_BASE,
  SELECT_BASE,
} from '@/lib/constants/styles';

interface UploadResult {
  success: boolean;
  message?: string;
  data?: {
    dryRun: boolean;
    year: number;
    quarter: number;
    currentYear?: {
      fileName: string;
      incomeItems: number;
      expenseItems: number;
      summary?: {
        current: {
          totalIncome: number;
          totalExpense: number;
          nextCarryover: number;
        };
      };
      warnings?: string[];
    };
    previousYear?: {
      fileName: string;
      incomeItems: number;
      expenseItems: number;
      summary?: {
        current: {
          totalIncome: number;
          totalExpense: number;
          nextCarryover: number;
        };
      };
      warnings?: string[];
    };
  };
  error?: {
    message: string;
  };
}

export default function AccountReportUploadPage() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [currentYearFile, setCurrentYearFile] = useState<File | null>(null);
  const [previousYearFile, setPreviousYearFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCurrentYearFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentYearFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handlePreviousYearFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviousYearFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!currentYearFile && !previousYearFile) {
      setError('최소 하나의 파일을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (currentYearFile) {
        formData.append('currentYearFile', currentYearFile);
      }
      if (previousYearFile) {
        formData.append('previousYearFile', previousYearFile);
      }
      formData.append('year', String(year));
      formData.append('quarter', String(quarter));
      formData.append('dryRun', String(dryRun));

      const response = await fetch('/api/admin/account-report/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (!data.success) {
        setError(data.error?.message || data.message || '업로드 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleActualUpload = async () => {
    setDryRun(false);
    // 바로 업로드 실행
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (currentYearFile) {
        formData.append('currentYearFile', currentYearFile);
      }
      if (previousYearFile) {
        formData.append('previousYearFile', previousYearFile);
      }
      formData.append('year', String(year));
      formData.append('quarter', String(quarter));
      formData.append('dryRun', 'false');

      const response = await fetch('/api/admin/account-report/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (!data.success) {
        setError(data.error?.message || data.message || '업로드 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류 발생');
    } finally {
      setLoading(false);
      setDryRun(true);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/account-report" className={BTN_OUTLINE}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">재정보고서 업로드</h1>
      </div>

      {/* 안내 */}
      <div className={`${SECTION_CARD} mb-6`}>
        <h2 className={SECTION_TITLE}>사용 안내</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>재정보고서 엑셀 파일(.xls, .xlsx)을 업로드하여 데이터를 저장합니다.</p>
          <p>
            <strong>지원 파일:</strong> HTML 형식으로 저장된 .xls 파일 또는 표준 .xlsx 파일
          </p>
          <p>
            <strong>파일 구조:</strong> 수지개황, 수입부, 지출부 테이블이 포함된 파일
          </p>
        </div>
      </div>

      {/* 업로드 폼 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>파일 업로드</h2>

        {/* 연도/분기 선택 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="year" className={LABEL_BASE}>
              연도
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={SELECT_BASE}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quarter" className={LABEL_BASE}>
              분기
            </label>
            <select
              id="quarter"
              value={quarter}
              onChange={(e) => setQuarter(parseInt(e.target.value))}
              className={SELECT_BASE}
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  {q}분기
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 당해년도 파일 */}
        <div className="mb-4">
          <label htmlFor="currentYearFile" className={LABEL_BASE}>
            <FileSpreadsheet className="w-4 h-4 inline mr-2" />
            재정보고서 (당해년도)
          </label>
          <input
            type="file"
            id="currentYearFile"
            accept=".xlsx,.xls"
            onChange={handleCurrentYearFileChange}
            className={INPUT_BASE}
          />
          {currentYearFile && (
            <p className="mt-1 text-sm text-blue-600">
              선택됨: {currentYearFile.name} ({(currentYearFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* 전년도 파일 */}
        <div className="mb-6">
          <label htmlFor="previousYearFile" className={LABEL_BASE}>
            <FileSpreadsheet className="w-4 h-4 inline mr-2" />
            재정보고서 (전년도) - 선택사항
          </label>
          <input
            type="file"
            id="previousYearFile"
            accept=".xlsx,.xls"
            onChange={handlePreviousYearFileChange}
            className={INPUT_BASE}
          />
          {previousYearFile && (
            <p className="mt-1 text-sm text-blue-600">
              선택됨: {previousYearFile.name} ({(previousYearFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Dry Run 옵션 */}
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">
              <strong>미리보기 모드 (Dry Run)</strong> - 실제 저장 없이 결과만 확인
            </span>
          </label>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className={`${ALERT_ERROR} mb-4 flex items-center gap-2`}>
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* 결과 표시 */}
        {result && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <h3
              className={`font-semibold mb-3 flex items-center gap-2 ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {result.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {result.success ? '성공' : '실패'}
              {result.data?.dryRun && ' (미리보기)'}
            </h3>

            {result.data && (
              <div className="space-y-4">
                {/* 당해년도 결과 */}
                {result.data.currentYear && (
                  <div className="bg-white p-3 rounded border">
                    <h4 className="font-medium text-gray-800 mb-2">당해년도: {result.data.currentYear.fileName}</h4>
                    <div className="text-sm space-y-1">
                      <p>수입 항목: {result.data.currentYear.incomeItems}개</p>
                      <p>지출 항목: {result.data.currentYear.expenseItems}개</p>
                      {result.data.currentYear.summary && (
                        <div className="mt-2 pt-2 border-t">
                          <p>수입 총계: {formatAmount(result.data.currentYear.summary.current.totalIncome)}</p>
                          <p>지출 총계: {formatAmount(result.data.currentYear.summary.current.totalExpense)}</p>
                          <p>차기 이월: {formatAmount(result.data.currentYear.summary.current.nextCarryover)}</p>
                        </div>
                      )}
                      {result.data.currentYear.warnings && result.data.currentYear.warnings.length > 0 && (
                        <div className="mt-2 text-amber-600">
                          <p className="font-medium">경고:</p>
                          <ul className="list-disc list-inside">
                            {result.data.currentYear.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 전년도 결과 */}
                {result.data.previousYear && (
                  <div className="bg-white p-3 rounded border">
                    <h4 className="font-medium text-gray-800 mb-2">전년도: {result.data.previousYear.fileName}</h4>
                    <div className="text-sm space-y-1">
                      <p>수입 항목: {result.data.previousYear.incomeItems}개</p>
                      <p>지출 항목: {result.data.previousYear.expenseItems}개</p>
                      {result.data.previousYear.summary && (
                        <div className="mt-2 pt-2 border-t">
                          <p>수입 총계: {formatAmount(result.data.previousYear.summary.current.totalIncome)}</p>
                          <p>지출 총계: {formatAmount(result.data.previousYear.summary.current.totalExpense)}</p>
                          <p>차기 이월: {formatAmount(result.data.previousYear.summary.current.nextCarryover)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleUpload}
            disabled={(!currentYearFile && !previousYearFile) || loading}
            className={`${BTN_PRIMARY} ${BTN_LG} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {loading && <div className={SPINNER}></div>}
            {loading ? '처리 중...' : dryRun ? '검증하기' : '업로드하기'}
          </button>

          {result?.success && result.data?.dryRun && (
            <button
              type="button"
              onClick={handleActualUpload}
              disabled={loading}
              className={`${BTN_PRIMARY} ${BTN_LG} bg-green-600 hover:bg-green-700 flex items-center gap-2`}
            >
              <Upload className="w-4 h-4" />
              실제 업로드 실행
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
