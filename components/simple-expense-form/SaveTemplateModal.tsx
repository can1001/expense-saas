/**
 * 템플릿 저장 모달
 *
 * 지출결의서 제출 성공 후 템플릿으로 저장할 수 있는 모달입니다.
 */

'use client';

import { useState } from 'react';
import { useTemplates, CreateTemplateData } from '@/lib/hooks';
import { INPUT_BASE, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/constants/styles';

interface SaveTemplateModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 저장 성공 시 콜백 */
  onSuccess?: () => void;
  /** 템플릿에 저장할 데이터 */
  templateData: {
    budgetCategory: string;
    budgetSubcategory: string;
    budgetDetail: string;
    description?: string;
    defaultAmount?: number;
  };
}

export default function SaveTemplateModal({
  isOpen,
  onClose,
  onSuccess,
  templateData,
}: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createTemplate, isMaxReached } = useTemplates();

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('템플릿 이름을 입력하세요.');
      return;
    }

    if (name.length > 50) {
      setError('템플릿 이름은 50자 이하여야 합니다.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const data: CreateTemplateData = {
        name: name.trim(),
        budgetCategory: templateData.budgetCategory,
        budgetSubcategory: templateData.budgetSubcategory,
        budgetDetail: templateData.budgetDetail,
        description: templateData.description,
        defaultAmount: templateData.defaultAmount,
      };

      await createTemplate(data);

      // 성공 처리
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '템플릿 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">템플릿으로 저장</h3>
              <p className="text-sm text-gray-500">
                자주 사용하는 항목을 템플릿으로 저장하세요
              </p>
            </div>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6">
          {/* 최대 개수 안내 */}
          {isMaxReached && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                최대 20개의 템플릿만 저장할 수 있습니다.
                <br />
                기존 템플릿을 삭제한 후 저장해주세요.
              </p>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 템플릿 정보 미리보기 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">예산항목</div>
            <div className="text-sm text-gray-900">
              {templateData.budgetCategory} &gt; {templateData.budgetSubcategory} &gt; {templateData.budgetDetail}
            </div>
            {templateData.description && (
              <>
                <div className="text-xs text-gray-500 mt-2 mb-1">적요</div>
                <div className="text-sm text-gray-900">{templateData.description}</div>
              </>
            )}
            {templateData.defaultAmount && (
              <>
                <div className="text-xs text-gray-500 mt-2 mb-1">기본 금액</div>
                <div className="text-sm text-gray-900">
                  {templateData.defaultAmount.toLocaleString('ko-KR')}원
                </div>
              </>
            )}
          </div>

          {/* 이름 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              템플릿 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 월례 회의비, 출장 교통비"
              maxLength={50}
              disabled={saving || isMaxReached}
              className={`${INPUT_BASE} ${isMaxReached ? 'bg-gray-100' : ''}`}
            />
            <div className="mt-1 text-xs text-gray-400 text-right">
              {name.length}/50자
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className={`flex-1 ${BTN_OUTLINE}`}
          >
            나중에
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isMaxReached || !name.trim()}
            className={`flex-1 ${BTN_PRIMARY} disabled:opacity-50`}
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
