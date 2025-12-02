'use client';

import { useState, useEffect } from 'react';

interface BudgetSelectorProps {
  value: {
    committee?: string;
    department?: string;
    category?: string;
    subcategory?: string;
    detail?: string;
  };
  onChange: (value: {
    committee?: string;
    department?: string;
    category?: string;
    subcategory?: string;
    detail?: string;
  }) => void;
  disabled?: boolean;
}

interface BudgetHierarchyResponse {
  field: string;
  options: string[];
}

export default function BudgetSelector({ value, onChange, disabled = false }: BudgetSelectorProps) {
  const [committees, setCommittees] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [details, setDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  // 초기 위원회 목록 로드
  useEffect(() => {
    fetchNextLevel({});
  }, []);

  // 선택값 변경 시 다음 레벨 로드
  useEffect(() => {
    if (value.committee && !value.department) {
      fetchNextLevel({ committee: value.committee });
    }
  }, [value.committee]);

  useEffect(() => {
    if (value.committee && value.department && !value.category) {
      fetchNextLevel({ committee: value.committee, department: value.department });
    }
  }, [value.department]);

  useEffect(() => {
    if (value.committee && value.department && value.category && !value.subcategory) {
      fetchNextLevel({
        committee: value.committee,
        department: value.department,
        category: value.category,
      });
    }
  }, [value.category]);

  useEffect(() => {
    if (value.committee && value.department && value.category && value.subcategory) {
      fetchNextLevel({
        committee: value.committee,
        department: value.department,
        category: value.category,
        subcategory: value.subcategory,
      });
    }
  }, [value.subcategory]);

  const fetchNextLevel = async (params: {
    committee?: string;
    department?: string;
    category?: string;
    subcategory?: string;
  }) => {
    try {
      setLoading('loading');
      const response = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) throw new Error('Failed to fetch budget data');

      const data: BudgetHierarchyResponse = await response.json();

      switch (data.field) {
        case 'committees':
          setCommittees(data.options);
          break;
        case 'departments':
          setDepartments(data.options);
          break;
        case 'categories':
          setCategories(data.options);
          break;
        case 'subcategories':
          setSubcategories(data.options);
          break;
        case 'details':
          setDetails(data.options);
          break;
      }
    } catch (error) {
      console.error('Error fetching budget hierarchy:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleChange = (field: string, selectedValue: string) => {
    // 빈 값을 선택한 경우 undefined로 처리
    const actualValue = selectedValue === '' ? undefined : selectedValue;
    const newValue = { ...value };

    switch (field) {
      case 'committee':
        newValue.committee = actualValue;
        newValue.department = undefined;
        newValue.category = undefined;
        newValue.subcategory = undefined;
        newValue.detail = undefined;
        setDepartments([]);
        setCategories([]);
        setSubcategories([]);
        setDetails([]);
        break;
      case 'department':
        newValue.department = actualValue;
        newValue.category = undefined;
        newValue.subcategory = undefined;
        newValue.detail = undefined;
        setCategories([]);
        setSubcategories([]);
        setDetails([]);
        break;
      case 'category':
        newValue.category = actualValue;
        newValue.subcategory = undefined;
        newValue.detail = undefined;
        setSubcategories([]);
        setDetails([]);
        break;
      case 'subcategory':
        newValue.subcategory = actualValue;
        newValue.detail = undefined;
        setDetails([]);
        break;
      case 'detail':
        newValue.detail = actualValue;
        break;
    }

    console.log('BudgetSelector handleChange:', field, actualValue, newValue);
    onChange(newValue);
  };

  const selectClasses = `w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900 ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  }`;

  return (
    <div className="space-y-4">
      {/* 위원회 */}
      <div>
        <label htmlFor="committee" className="block text-sm font-medium text-gray-700 mb-2">
          위원회 <span className="text-red-500">*</span>
        </label>
        <select
          id="committee"
          value={value.committee || ''}
          onChange={(e) => handleChange('committee', e.target.value)}
          disabled={disabled || committees.length === 0}
          className={selectClasses}
          required
        >
          <option value="">선택하세요</option>
          {committees.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {/* 사역팀(부) */}
      {value.committee && (
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
            사역팀(부) <span className="text-red-500">*</span>
          </label>
          <select
            id="department"
            value={value.department || ''}
            onChange={(e) => handleChange('department', e.target.value)}
            disabled={disabled || departments.length === 0}
            className={selectClasses}
            required
          >
            <option value="">선택하세요</option>
            {departments.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 예산(항) */}
      {value.department && (
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            예산(항) <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            value={value.category || ''}
            onChange={(e) => handleChange('category', e.target.value)}
            disabled={disabled || categories.length === 0}
            className={selectClasses}
            required
          >
            <option value="">선택하세요</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 예산(목) */}
      {value.category && (
        <div>
          <label htmlFor="subcategory" className="block text-sm font-medium text-gray-700 mb-2">
            예산(목) <span className="text-red-500">*</span>
          </label>
          <select
            id="subcategory"
            value={value.subcategory || ''}
            onChange={(e) => handleChange('subcategory', e.target.value)}
            disabled={disabled || subcategories.length === 0}
            className={selectClasses}
            required
          >
            <option value="">선택하세요</option>
            {subcategories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 예산(세목) - 항목별로 선택 */}
      {value.subcategory && (
        <div>
          <label htmlFor="detail" className="block text-sm font-medium text-gray-700 mb-2">
            예산(세목) (선택사항)
          </label>
          {details.length === 0 ? (
            <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
              해당 예산(목)에는 세목이 없습니다. 세부 항목에 직접 입력해주세요.
            </div>
          ) : (
            <select
              id="detail"
              value={value.detail || ''}
              onChange={(e) => handleChange('detail', e.target.value)}
              disabled={disabled}
              className={selectClasses}
            >
              <option value="">선택하세요</option>
              {details.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span>옵션을 불러오는 중...</span>
        </div>
      )}
    </div>
  );
}
