'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import {
  BTN_PRIMARY,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface BudgetCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count: {
    subcategories: number;
  };
}

interface BudgetSubcategory {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
  isActive: boolean;
  _count: {
    details: number;
  };
}

interface BudgetDetail {
  id: string;
  name: string;
  subcategoryId: string;
  subcategory: string;
  isActive: boolean;
  categoryIsActive: boolean;
  subcategoryIsActive: boolean;
}

export default function BudgetItemsPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [subcategories, setSubcategories] = useState<BudgetSubcategory[]>([]);
  const [details, setDetails] = useState<BudgetDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [catRes, subcatRes, detailRes] = await Promise.all([
        fetch('/api/budget-categories?includeInactive=true'),
        fetch('/api/budget-subcategories?includeInactive=true'),
        fetch(`/api/budget-details/year?year=${new Date().getFullYear()}&includeInactive=true`),
      ]);

      if (!catRes.ok || !subcatRes.ok || !detailRes.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const [catData, subcatData, detailData] = await Promise.all([
        catRes.json(),
        subcatRes.json(),
        detailRes.json(),
      ]);

      setCategories(catData.categories || []);
      setSubcategories(subcatData.subcategories || []);
      setDetails(detailData.details || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSubcategory = (id: string) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleActive = async (
    type: 'category' | 'subcategory' | 'detail',
    id: string,
    currentActive: boolean
  ) => {
    setToggling(`${type}-${id}`);
    try {
      const endpoint =
        type === 'category'
          ? `/api/budget-categories/${id}`
          : type === 'subcategory'
            ? `/api/budget-subcategories/${id}`
            : `/api/budget-details/${id}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!response.ok) {
        throw new Error('상태 변경에 실패했습니다.');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setToggling(null);
    }
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter((sub) => sub.categoryId === categoryId);
  };

  const getDetailsForSubcategory = (subcategoryId: string) => {
    return details.filter((detail) => detail.subcategoryId === subcategoryId);
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categories.map((c) => c.id)));
    setExpandedSubcategories(new Set(subcategories.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedSubcategories(new Set());
  };

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} py-20`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예산 항목 관리</h1>
          <p className="text-gray-600 mt-1">
            예산 항(Category), 목(Subcategory), 세목(Detail)의 활성/비활성 상태를 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            모두 펼치기
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            모두 접기
          </button>
          <button
            onClick={fetchData}
            className={`${BTN_PRIMARY} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">예산(항)</div>
          <div className="text-2xl font-bold">
            {categories.filter((c) => c.isActive).length}
            <span className="text-sm font-normal text-gray-400">
              {' '}
              / {categories.length}
            </span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">예산(목)</div>
          <div className="text-2xl font-bold">
            {subcategories.filter((s) => s.isActive).length}
            <span className="text-sm font-normal text-gray-400">
              {' '}
              / {subcategories.length}
            </span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">예산(세목)</div>
          <div className="text-2xl font-bold">
            {details.filter((d) => d.isActive).length}
            <span className="text-sm font-normal text-gray-400">
              {' '}
              / {details.length}
            </span>
          </div>
        </div>
      </div>

      {/* 트리 구조 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center text-sm font-medium text-gray-600">
            <span className="flex-1">항목명</span>
            <span className="w-24 text-center">하위 항목</span>
            <span className="w-24 text-center">상태</span>
          </div>
        </div>

        <div className="divide-y">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              등록된 예산 항목이 없습니다.
            </div>
          ) : (
            categories.map((category) => {
              const isExpanded = expandedCategories.has(category.id);
              const subs = getSubcategoriesForCategory(category.id);

              return (
                <div key={category.id}>
                  {/* 항(Category) */}
                  <div
                    className={`flex items-center p-3 hover:bg-gray-50 ${
                      !category.isActive ? 'bg-gray-100' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="p-1 hover:bg-gray-200 rounded mr-2"
                      disabled={subs.length === 0}
                    >
                      {subs.length > 0 ? (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )
                      ) : (
                        <span className="w-4 h-4 inline-block" />
                      )}
                    </button>
                    <span
                      className={`flex-1 font-medium ${
                        !category.isActive ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}
                    >
                      {category.name}
                      {!category.isActive && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-300 text-gray-600 rounded">
                          비활성
                        </span>
                      )}
                    </span>
                    <span className="w-24 text-center text-sm text-gray-500">
                      {category._count.subcategories}개
                    </span>
                    <span className="w-24 text-center">
                      <button
                        onClick={() =>
                          handleToggleActive('category', category.id, category.isActive)
                        }
                        disabled={toggling === `category-${category.id}`}
                        className={`text-xs px-2 py-1 rounded ${
                          category.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        } ${toggling === `category-${category.id}` ? 'opacity-50' : ''}`}
                      >
                        {category.isActive ? '활성' : '비활성'}
                      </button>
                    </span>
                  </div>

                  {/* 목(Subcategory) */}
                  {isExpanded &&
                    subs.map((subcategory) => {
                      const isSubExpanded = expandedSubcategories.has(subcategory.id);
                      const detailsForSub = getDetailsForSubcategory(subcategory.id);
                      const isParentInactive = !category.isActive;

                      return (
                        <div key={subcategory.id}>
                          <div
                            className={`flex items-center p-3 pl-10 hover:bg-gray-50 ${
                              !subcategory.isActive || isParentInactive
                                ? 'bg-gray-100'
                                : ''
                            }`}
                          >
                            <button
                              onClick={() => toggleSubcategory(subcategory.id)}
                              className="p-1 hover:bg-gray-200 rounded mr-2"
                              disabled={detailsForSub.length === 0}
                            >
                              {detailsForSub.length > 0 ? (
                                isSubExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )
                              ) : (
                                <span className="w-4 h-4 inline-block" />
                              )}
                            </button>
                            <span
                              className={`flex-1 ${
                                !subcategory.isActive || isParentInactive
                                  ? 'text-gray-400 line-through'
                                  : 'text-gray-900'
                              }`}
                            >
                              {subcategory.name}
                              {!subcategory.isActive && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-300 text-gray-600 rounded">
                                  비활성
                                </span>
                              )}
                              {isParentInactive && subcategory.isActive && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-200 text-yellow-700 rounded">
                                  상위 비활성
                                </span>
                              )}
                            </span>
                            <span className="w-24 text-center text-sm text-gray-500">
                              {subcategory._count.details}개
                            </span>
                            <span className="w-24 text-center">
                              <button
                                onClick={() =>
                                  handleToggleActive(
                                    'subcategory',
                                    subcategory.id,
                                    subcategory.isActive
                                  )
                                }
                                disabled={toggling === `subcategory-${subcategory.id}`}
                                className={`text-xs px-2 py-1 rounded ${
                                  subcategory.isActive
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                } ${toggling === `subcategory-${subcategory.id}` ? 'opacity-50' : ''}`}
                              >
                                {subcategory.isActive ? '활성' : '비활성'}
                              </button>
                            </span>
                          </div>

                          {/* 세목(Detail) */}
                          {isSubExpanded &&
                            detailsForSub.map((detail) => {
                              const isAncestorInactive =
                                isParentInactive || !subcategory.isActive;

                              return (
                                <div
                                  key={detail.id}
                                  className={`flex items-center p-3 pl-20 hover:bg-gray-50 ${
                                    !detail.isActive || isAncestorInactive
                                      ? 'bg-gray-100'
                                      : ''
                                  }`}
                                >
                                  <span className="w-4 h-4 mr-3" />
                                  <span
                                    className={`flex-1 text-sm ${
                                      !detail.isActive || isAncestorInactive
                                        ? 'text-gray-400 line-through'
                                        : 'text-gray-900'
                                    }`}
                                  >
                                    {detail.name}
                                    {!detail.isActive && (
                                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-300 text-gray-600 rounded">
                                        비활성
                                      </span>
                                    )}
                                    {isAncestorInactive && detail.isActive && (
                                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-200 text-yellow-700 rounded">
                                        상위 비활성
                                      </span>
                                    )}
                                  </span>
                                  <span className="w-24 text-center text-sm text-gray-500">
                                    -
                                  </span>
                                  <span className="w-24 text-center">
                                    <button
                                      onClick={() =>
                                        handleToggleActive(
                                          'detail',
                                          detail.id,
                                          detail.isActive
                                        )
                                      }
                                      disabled={toggling === `detail-${detail.id}`}
                                      className={`text-xs px-2 py-1 rounded ${
                                        detail.isActive
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                      } ${toggling === `detail-${detail.id}` ? 'opacity-50' : ''}`}
                                    >
                                      {detail.isActive ? '활성' : '비활성'}
                                    </button>
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 안내 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">사용 안내</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            <span className="font-medium">활성/비활성 토글:</span> 각 항목의 상태 버튼을 클릭하여 활성/비활성을 전환합니다.
          </li>
          <li>
            <span className="font-medium">상위 비활성:</span> 상위 항목(항 또는 목)이 비활성화되면 하위 항목들은 자동으로 조회에서 제외됩니다.
          </li>
          <li>
            <span className="font-medium">복원:</span> 상위 항목을 재활성화하면 하위 항목들의 기존 상태가 그대로 복원됩니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
