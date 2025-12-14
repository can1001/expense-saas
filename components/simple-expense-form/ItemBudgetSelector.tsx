/**
 * 항목별 예산 선택기 컴포넌트
 * 각 세부 항목에서 예산(항/목/세목) 선택
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { SELECT_BASE, INPUT_DISABLED, SPINNER } from '@/lib/constants/styles';

interface ItemBudgetSelectorProps {
  value: {
    category: string;
    subcategory: string;
    detail: string;
  };
  onChange: (value: {
    category: string;
    subcategory: string;
    detail: string;
  }) => void;
  disabled?: boolean;
}

export default function ItemBudgetSelector({
  value,
  onChange,
  disabled = false,
}: ItemBudgetSelectorProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [details, setDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 예산(항) 목록 로드
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/budget/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.options || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 예산(목) 목록 로드
  const fetchSubcategories = useCallback(async (category: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/budget/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      if (!response.ok) throw new Error('Failed to fetch subcategories');
      const data = await response.json();
      setSubcategories(data.options || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 예산(세목) 목록 로드
  const fetchDetails = useCallback(async (category: string, subcategory: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/budget/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subcategory }),
      });
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setDetails(data.options || []);
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // category 변경 시 subcategories 로드
  useEffect(() => {
    if (value.category) {
      fetchSubcategories(value.category);
    } else {
      setSubcategories([]);
      setDetails([]);
    }
  }, [value.category, fetchSubcategories]);

  // subcategory 변경 시 details 로드
  useEffect(() => {
    if (value.category && value.subcategory) {
      fetchDetails(value.category, value.subcategory);
    } else {
      setDetails([]);
    }
  }, [value.category, value.subcategory, fetchDetails]);

  const handleCategoryChange = (newCategory: string) => {
    onChange({
      category: newCategory,
      subcategory: '',
      detail: '',
    });
    setSubcategories([]);
    setDetails([]);
  };

  const handleSubcategoryChange = (newSubcategory: string) => {
    onChange({
      ...value,
      subcategory: newSubcategory,
      detail: '',
    });
    setDetails([]);
  };

  const handleDetailChange = (newDetail: string) => {
    onChange({
      ...value,
      detail: newDetail,
    });
  };

  const selectClasses = `${SELECT_BASE} ${disabled ? INPUT_DISABLED : ''} text-sm py-1.5`;

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* 예산(항) */}
      <select
        value={value.category || ''}
        onChange={(e) => handleCategoryChange(e.target.value)}
        disabled={disabled || categories.length === 0}
        className={selectClasses}
      >
        <option value="">예산(항)</option>
        {categories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {/* 예산(목) */}
      <select
        value={value.subcategory || ''}
        onChange={(e) => handleSubcategoryChange(e.target.value)}
        disabled={disabled || !value.category || subcategories.length === 0}
        className={selectClasses}
      >
        <option value="">예산(목)</option>
        {subcategories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {/* 예산(세목) */}
      <select
        value={value.detail || ''}
        onChange={(e) => handleDetailChange(e.target.value)}
        disabled={disabled || !value.subcategory || details.length === 0}
        className={selectClasses}
      >
        <option value="">예산(세목)</option>
        {details.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {loading && (
        <div className="col-span-3 flex items-center gap-1 text-xs text-gray-500">
          <div className={`${SPINNER} w-3 h-3`}></div>
          <span>로딩 중...</span>
        </div>
      )}
    </div>
  );
}
