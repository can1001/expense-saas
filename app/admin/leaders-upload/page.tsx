/**
 * 사역팀장 일괄 업로드 관리 페이지
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOrgTerms } from '@/lib/contexts/TenantContext';
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
} from '@/lib/constants/styles';

interface UploadSummary {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface UploadResult {
  success: boolean;
  message?: string;
  data?: {
    summary: UploadSummary;
    dryRun: boolean;
    preview?: Array<{ department: string; leader: string }>;
  };
  error?: {
    type: string;
    message: string;
    fields?: Array<{ fieldName: string; message: string }>;
  };
}

export default function LeadersUploadPage() {
  const terms = useOrgTerms();
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async (isDryRun: boolean = dryRun) => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', String(isDryRun));

      const response = await fetch('/api/departments/leaders-upload', {
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

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/departments/leaders-upload');
      if (!response.ok) throw new Error('템플릿 다운로드 실패');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leaders_template_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '템플릿 다운로드 실패');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{terms.department}장 일괄 등록</h1>
        <Link
          href="/admin/departments"
          className={BTN_OUTLINE}
        >
          {terms.department} 목록
        </Link>
      </div>

      {/* 설명 */}
      <div className={`${SECTION_CARD} mb-6`}>
        <h2 className={SECTION_TITLE}>사용 안내</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>Excel 파일을 업로드하여 {terms.department}장을 일괄 설정할 수 있습니다.</p>
          <p>
            <strong>열 구조:</strong> 위원회, 사역팀, 팀장
          </p>
          <p>
            <strong>팀장 매칭:</strong> 팀장 이름이 사용자 목록의 이름과 정확히 일치해야 합니다.
          </p>
          <p>
            <strong>팀장 해제:</strong> 팀장 열을 비워두면 해당 {terms.department}의 팀장이 해제됩니다.
          </p>
        </div>
      </div>

      {/* 업로드 폼 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>파일 업로드</h2>

        {/* 템플릿 다운로드 */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className={`${BTN_OUTLINE} text-sm`}
          >
            현재 {terms.department}장 목록 다운로드 (템플릿)
          </button>
          <p className="mt-1 text-xs text-gray-500">
            현재 {terms.department}장 데이터가 포함된 Excel 파일을 다운로드합니다. 이 파일을 수정하여 업로드하세요.
          </p>
        </div>

        {/* 파일 선택 */}
        <div className="mb-4">
          <label htmlFor="file" className={LABEL_BASE}>
            Excel 파일
          </label>
          <input
            type="file"
            id="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className={INPUT_BASE}
          />
          {file && (
            <p className="mt-1 text-sm text-gray-600">
              선택된 파일: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Dry Run 옵션 */}
        <div className="mb-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">
              <strong>미리보기 모드 (Dry Run)</strong> - 실제 DB 변경 없이 결과만 확인
            </span>
          </label>
        </div>

        {/* 에러 메시지 */}
        {error && <div className={`${ALERT_ERROR} mb-4`}>{error}</div>}

        {/* 결과 표시 */}
        {result && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <h3 className={`font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? '성공' : '실패'}
              {result.data?.dryRun && ' (미리보기)'}
            </h3>
            {result.data?.summary && (
              <div className="text-sm space-y-1">
                <p>총 행: {result.data.summary.totalRows}개</p>
                <p className="text-blue-600">설정 예정: {result.data.summary.updated}개 {terms.department}</p>
                <p className="text-gray-600">건너뜀: {result.data.summary.skipped}개</p>
                <p className="text-red-600">오류: {result.data.summary.errors}건</p>
              </div>
            )}
            {result.data?.preview && result.data.preview.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-semibold text-gray-700 mb-1">미리보기 (최대 10건):</p>
                <ul className="list-disc list-inside text-gray-600 max-h-40 overflow-y-auto">
                  {result.data.preview.map((p, i) => (
                    <li key={i}>
                      {p.department} → {p.leader}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.error?.fields && result.error.fields.length > 0 && (
              <div className="mt-2 text-sm text-red-600">
                <p className="font-semibold">오류 상세:</p>
                <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                  {result.error.fields.slice(0, 20).map((f, i) => (
                    <li key={i}>
                      <strong>{f.fieldName}:</strong> {f.message}
                    </li>
                  ))}
                  {result.error.fields.length > 20 && (
                    <li>... 외 {result.error.fields.length - 20}건</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 업로드 버튼 */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => handleUpload(dryRun)}
            disabled={!file || loading}
            className={`${BTN_PRIMARY} ${BTN_LG} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading && <div className={SPINNER}></div>}
            {loading ? '처리 중...' : dryRun ? '검증하기' : '업로드하기'}
          </button>

          {result?.success && result.data?.dryRun && (
            <button
              type="button"
              onClick={() => handleUpload(false)}
              disabled={loading}
              className={`${BTN_PRIMARY} ${BTN_LG} bg-green-600 hover:bg-green-700`}
            >
              실제 업로드 실행
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
