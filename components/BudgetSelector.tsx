'use client';

import { useState, useEffect } from 'react';
import { SELECT_BASE, INPUT_DISABLED, LABEL_BASE, LABEL_REQUIRED, SPINNER } from '@/lib/constants/styles';
import { ChevronRight } from 'lucide-react';

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
  showDetail?: boolean;  // 세목 표시 여부 (기본값: true)
  onDetailsLoaded?: (details: string[]) => void;  // 세목 옵션 외부 전달
}

interface BudgetHierarchyResponse {
  field: string;
  options: string[];
}

export default function BudgetSelector({
  value,
  onChange,
  disabled = false,
  showDetail = true,
  onDetailsLoaded,
}: BudgetSelectorProps) {
  const [committees, setCommittees] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [details, setDetails] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  // 초기 위원회 목록 로드
  useEffect(() => {
    fetchNextLevel({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 위원회 선택 시 → 부서 로드
  useEffect(() => {
    if (value.committee) {
      const needsFetch = departments.length === 0 ||
        (value.department && !departments.includes(value.department));
      if (needsFetch) {
        fetchNextLevel({ committee: value.committee });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.committee, value.department, departments.length]);

  // 부서 선택 시 → 카테고리(항) 로드
  useEffect(() => {
    if (value.committee && value.department) {
      const needsFetch = categories.length === 0 ||
        (value.category && !categories.includes(value.category));
      if (needsFetch) {
        fetchNextLevel({ committee: value.committee, department: value.department });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.committee, value.department, value.category, categories.length]);

  // 카테고리 선택 시 → 서브카테고리(목) 로드
  useEffect(() => {
    if (value.committee && value.department && value.category) {
      const needsFetch = subcategories.length === 0 ||
        (value.subcategory && !subcategories.includes(value.subcategory));
      if (needsFetch) {
        fetchNextLevel({
          committee: value.committee,
          department: value.department,
          category: value.category,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.committee, value.department, value.category, value.subcategory, subcategories.length]);

  // 서브카테고리 선택 시 → 세목 로드
  useEffect(() => {
    if (value.committee && value.department && value.category && value.subcategory) {
      const needsFetch = details.length === 0 ||
        (value.detail && !details.includes(value.detail));
      if (needsFetch) {
        fetchNextLevel({
          committee: value.committee,
          department: value.department,
          category: value.category,
          subcategory: value.subcategory,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.committee, value.department, value.category, value.subcategory, value.detail, details.length]);

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
          // 세목 옵션 외부 전달
          if (onDetailsLoaded) {
            onDetailsLoaded(data.options);
          }
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

  const selectClasses = `${SELECT_BASE} ${disabled ? INPUT_DISABLED : ''}`;

  // 선택 진행률 계산
  const getProgress = () => {
    let count = 0;
    if (value.committee) count++;
    if (value.department) count++;
    if (value.category) count++;
    if (value.subcategory) count++;
    if (showDetail && value.detail) count++;
    return count;
  };

  const totalSteps = showDetail ? 5 : 4;
  const progress = getProgress();

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 모바일 진행률 표시 */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">예산 선택</span>
          <span className="text-sm text-gray-500">{progress}/{totalSteps} 완료</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(progress / totalSteps) * 100}%` }}
          />
        </div>

        {/* 선택된 항목 요약 (모바일) */}
        {progress > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-gray-600">
            {value.committee && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{value.committee}</span>}
            {value.department && (
              <>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{value.department}</span>
              </>
            )}
            {value.category && (
              <>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{value.category}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 위원회 */}
      <div>
        <label htmlFor="committee" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
          위원회
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
          <label htmlFor="department" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            사역팀(부)
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
          <label htmlFor="category" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            예산(항)
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
          <label htmlFor="subcategory" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            예산(목)
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

      {/* 예산(세목) - showDetail이 true일 때만 표시 */}
      {showDetail && value.subcategory && (
        <div>
          <label htmlFor="detail" className={LABEL_BASE}>
            예산(세목) <span className="text-gray-400 text-xs">(선택사항)</span>
          </label>
          {details.length === 0 ? (
            <div className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm min-h-[44px] flex items-center">
              해당 예산(목)에는 세목이 없습니다.
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
          <div className={SPINNER}></div>
          <span>옵션을 불러오는 중...</span>
        </div>
      )}
    </div>
  );
}
