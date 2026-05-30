/**
 * 지출결의서 일괄 업로드 페이지 (행정간사/관리자 전용)
 *
 * 흐름: 파일 선택 → 검증(dry-run) → 결과/오류 확인 → 확정 업로드
 * 권한 게이팅은 AdminLayout이 menu-permissions 기반으로 자동 수행.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_SUCCESS,
  BTN_LG,
  SPINNER,
  ALERT_ERROR,
  INPUT_BASE,
  LABEL_BASE,
} from '@/lib/constants/styles';

interface ValidationError {
  rowNumber: number;
  groupId?: string;
  field?: string;
  message: string;
}

interface PreviewItem {
  groupId: string;
  committee: string;
  department: string;
  applicantName: string;
  itemsCount: number;
  requestAmount: number;
}

interface BulkUploadResult {
  dryRun: boolean;
  totalRows: number;
  totalExpenses: number;
  errors: ValidationError[];
  preview?: PreviewItem[];
  createdIds?: string[];
}

export default function ExpenseUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<BulkUploadResult | null>(null);
  const [commitResult, setCommitResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetAll = () => {
    setPreviewResult(null);
    setCommitResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setFile(selected || null);
    resetAll();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/expenses/bulk-upload-template');
      if (!res.ok) throw new Error('템플릿 다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'expense-bulk-upload-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '템플릿 다운로드 실패');
    }
  };

  const uploadFile = async (dryRun: boolean): Promise<BulkUploadResult | null> => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dryRun', String(dryRun));

    const res = await fetch('/api/expenses/bulk-upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.detail || '업로드 실패');
    }
    return data as BulkUploadResult;
  };

  const handleValidate = async () => {
    if (!file) return setError('파일을 선택해주세요.');
    setValidating(true);
    setError(null);
    setCommitResult(null);
    try {
      const result = await uploadFile(true);
      setPreviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '검증 실패');
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await uploadFile(false);
      setCommitResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '확정 업로드 실패');
    } finally {
      setCommitting(false);
    }
  };

  const canCommit =
    !!previewResult &&
    previewResult.errors.length === 0 &&
    !commitResult &&
    !committing;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">지출결의서 일괄 업로드</h1>

      {/* 안내 */}
      <div className={`${SECTION_CARD} mb-6`}>
        <h2 className={SECTION_TITLE}>사용 안내</h2>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
          <li>&apos;템플릿 다운로드&apos; 버튼으로 양식 파일을 받아 작성합니다.</li>
          <li>파일을 선택한 뒤 &apos;검증(미리보기)&apos;를 클릭합니다.</li>
          <li>모든 오류가 해결되면 &apos;확정 업로드&apos;가 활성화됩니다.</li>
          <li>일괄 등록된 지출결의서는 <strong>DRAFT(임시저장)</strong> 상태로 저장됩니다. 작성자가 별도로 결재 상신을 진행해야 합니다.</li>
          <li>한 행이라도 실패하면 전체 롤백됩니다.</li>
        </ol>
      </div>

      {/* 업로드 폼 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>파일 업로드</h2>

        <div className="mb-6">
          <button type="button" onClick={handleDownloadTemplate} className={`${BTN_OUTLINE} text-sm`}>
            템플릿 다운로드
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor="file" className={LABEL_BASE}>Excel 파일 (.xlsx)</label>
          <input
            type="file"
            id="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className={INPUT_BASE}
          />
          {file && (
            <p className="mt-1 text-sm text-gray-600">
              선택된 파일: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {error && <div className={`${ALERT_ERROR} mb-4`}>{error}</div>}

        {/* 검증 / 확정 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={!file || validating || committing}
            className={`${BTN_PRIMARY} ${BTN_LG} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {validating && <div className={SPINNER}></div>}
            {validating ? '검증 중...' : '검증(미리보기)'}
          </button>

          <button
            type="button"
            onClick={handleCommit}
            disabled={!canCommit}
            className={`${BTN_SUCCESS} ${BTN_LG} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {committing && <div className={SPINNER}></div>}
            {committing ? '저장 중...' : '확정 업로드'}
          </button>
        </div>
      </div>

      {/* 미리보기 결과 */}
      {previewResult && (
        <div className={`${SECTION_CARD} mt-6`}>
          <h2 className={SECTION_TITLE}>미리보기 결과</h2>
          <div className="text-sm text-gray-700 mb-3">
            총 {previewResult.totalRows}행 → {previewResult.totalExpenses}건의 지출결의서 생성 예정
            {previewResult.errors.length > 0 && (
              <span className="ml-2 text-red-600 font-semibold">
                · 오류 {previewResult.errors.length}건
              </span>
            )}
          </div>

          {previewResult.errors.length > 0 ? (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-3 py-2 text-left">행</th>
                    <th className="px-3 py-2 text-left">그룹</th>
                    <th className="px-3 py-2 text-left">필드</th>
                    <th className="px-3 py-2 text-left">메시지</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResult.errors.map((e, i) => (
                    <tr key={i} className="border-t border-red-100">
                      <td className="px-3 py-2">{e.rowNumber}</td>
                      <td className="px-3 py-2 text-gray-600">{e.groupId || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{e.field || '-'}</td>
                      <td className="px-3 py-2 text-red-700">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="bg-green-50 px-3 py-2 text-sm text-green-800 font-semibold">
                ✓ 검증 통과 — &apos;확정 업로드&apos;를 클릭하면 저장됩니다.
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">그룹</th>
                    <th className="px-3 py-2 text-left">위원회</th>
                    <th className="px-3 py-2 text-left">사역팀</th>
                    <th className="px-3 py-2 text-left">청구인</th>
                    <th className="px-3 py-2 text-right">항목 수</th>
                    <th className="px-3 py-2 text-right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewResult.preview || []).map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2">{p.groupId}</td>
                      <td className="px-3 py-2">{p.committee}</td>
                      <td className="px-3 py-2">{p.department}</td>
                      <td className="px-3 py-2">{p.applicantName}</td>
                      <td className="px-3 py-2 text-right">{p.itemsCount}</td>
                      <td className="px-3 py-2 text-right">{p.requestAmount.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 확정 결과 */}
      {commitResult && (
        <div className={`${SECTION_CARD} mt-6 bg-green-50 border border-green-200`}>
          <h2 className="text-lg font-semibold text-green-800 mb-2">
            ✓ {commitResult.createdIds?.length || 0}건 등록 완료
          </h2>
          <p className="text-sm text-green-700 mb-3">
            모든 지출결의서가 DRAFT 상태로 저장되었습니다.
          </p>
          <Link href="/expenses" className={`${BTN_PRIMARY}`}>
            지출결의서 목록으로
          </Link>
        </div>
      )}
    </div>
  );
}
