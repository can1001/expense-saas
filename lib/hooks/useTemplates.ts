/**
 * 지출 템플릿 관리 훅
 *
 * - 템플릿 목록 조회 (usageCount 순 정렬)
 * - 템플릿 사용 (usageCount 증가)
 * - 템플릿 생성
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

/** 템플릿 타입 */
export interface ExpenseTemplate {
  id: string;
  userId: string;
  name: string;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  description: string | null;
  defaultAmount: number | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 템플릿 생성 데이터 */
export interface CreateTemplateData {
  name: string;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  description?: string;
  defaultAmount?: number;
}

/** 훅 옵션 */
interface UseTemplatesOptions {
  /** 초기 로드 스킵 여부 */
  skip?: boolean;
}

/** 훅 반환 타입 */
interface UseTemplatesResult {
  /** 템플릿 목록 */
  templates: ExpenseTemplate[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 템플릿 목록 새로고침 */
  refresh: () => Promise<void>;
  /** 템플릿 사용 (usageCount 증가) */
  useTemplate: (templateId: string) => Promise<ExpenseTemplate | null>;
  /** 템플릿 생성 */
  createTemplate: (data: CreateTemplateData) => Promise<ExpenseTemplate | null>;
  /** 템플릿 삭제 */
  deleteTemplate: (templateId: string) => Promise<boolean>;
  /** 최대 템플릿 수 도달 여부 */
  isMaxReached: boolean;
}

const MAX_TEMPLATES = 20;

export function useTemplates(options: UseTemplatesOptions = {}): UseTemplatesResult {
  const { skip = false } = options;
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  /** 템플릿 목록 조회 */
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/expense-templates');

      if (!response.ok) {
        if (response.status === 401) {
          // 로그인되지 않은 경우 빈 목록 반환
          setTemplates([]);
          return;
        }
        throw new Error('템플릿 목록을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  /** 템플릿 사용 (usageCount 증가) */
  const useTemplate = useCallback(async (templateId: string): Promise<ExpenseTemplate | null> => {
    try {
      const response = await fetch(`/api/expense-templates/${templateId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '템플릿 사용 기록에 실패했습니다.');
      }

      const updatedTemplate = await response.json();

      // 로컬 상태 업데이트
      setTemplates((prev) =>
        prev
          .map((t) => (t.id === templateId ? updatedTemplate : t))
          .sort((a, b) => b.usageCount - a.usageCount)
      );

      return updatedTemplate;
    } catch (err) {
      console.error('템플릿 사용 기록 실패:', err);
      return null;
    }
  }, []);

  /** 템플릿 생성 */
  const createTemplate = useCallback(async (data: CreateTemplateData): Promise<ExpenseTemplate | null> => {
    try {
      setError(null);

      const response = await fetch('/api/expense-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '템플릿 생성에 실패했습니다.');
      }

      const newTemplate = await response.json();

      // 로컬 상태에 추가
      setTemplates((prev) => [newTemplate, ...prev]);

      return newTemplate;
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
      throw err;
    }
  }, []);

  /** 템플릿 삭제 */
  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/expense-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '템플릿 삭제에 실패했습니다.');
      }

      // 로컬 상태에서 제거
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));

      return true;
    } catch (err) {
      console.error('템플릿 삭제 실패:', err);
      return false;
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    if (!skip) {
      fetchTemplates();
    }
  }, [skip, fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refresh: fetchTemplates,
    useTemplate,
    createTemplate,
    deleteTemplate,
    isMaxReached: templates.length >= MAX_TEMPLATES,
  };
}

export default useTemplates;
