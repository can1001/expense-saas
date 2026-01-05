'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Copy, Search, ChevronDown, ChevronRight, Users } from 'lucide-react';
import {
  SECTION_CARD,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_SUCCESS,
  BTN_SM,
  SELECT_BASE,
  INPUT_BASE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  SPINNER_MD,
} from '@/lib/constants/styles';

interface User {
  id: string;
  userid: string;
  username: string;
}

interface YearSetting {
  id: string;
  year: number;
  managerId: string | null;
  managerName: string | null;
  budgetAmount: number;
  usedAmount: number;
}

interface BudgetDetail {
  id: string;
  name: string;
  accountCode: string | null;
  description: string | null;
  category: string;
  categoryId: string;
  subcategory: string;
  subcategoryId: string;
  departments: Array<{
    id: string;
    name: string;
    committee: string;
  }>;
  yearSetting: YearSetting | null;
}

interface GroupedDetails {
  [category: string]: {
    [subcategory: string]: BudgetDetail[];
  };
}

export default function BudgetManagersPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [details, setDetails] = useState<BudgetDetail[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [changes, setChanges] = useState<Map<string, { managerId?: string | null; budgetAmount?: number }>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [copyFromYear, setCopyFromYear] = useState(currentYear - 1);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [detailsRes, usersRes] = await Promise.all([
        fetch(`/api/budget-details/year?year=${year}`),
        fetch('/api/users?pageSize=1000&isActive=true'),
      ]);

      const detailsData = await detailsRes.json();
      const usersData = await usersRes.json();

      setDetails(detailsData.details || []);
      setUsers(usersData.users || []);
      setChanges(new Map());

      // 모든 카테고리 펼치기
      const categories = new Set<string>(detailsData.details?.map((d: BudgetDetail) => d.category) || []);
      setExpandedCategories(categories);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 담당자 변경
  const handleManagerChange = (detailId: string, managerId: string | null) => {
    setChanges((prev) => {
      const newChanges = new Map(prev);
      const existing = newChanges.get(detailId) || {};
      newChanges.set(detailId, { ...existing, managerId });
      return newChanges;
    });
  };

  // 예산금액 변경
  const handleBudgetChange = (detailId: string, budgetAmount: number) => {
    setChanges((prev) => {
      const newChanges = new Map(prev);
      const existing = newChanges.get(detailId) || {};
      newChanges.set(detailId, { ...existing, budgetAmount });
      return newChanges;
    });
  };

  // 현재 값 가져오기
  const getCurrentManager = (detail: BudgetDetail): string => {
    const change = changes.get(detail.id);
    if (change?.managerId !== undefined) {
      return change.managerId || '';
    }
    return detail.yearSetting?.managerId || '';
  };

  const getCurrentBudget = (detail: BudgetDetail): number => {
    const change = changes.get(detail.id);
    if (change?.budgetAmount !== undefined) {
      return change.budgetAmount;
    }
    return detail.yearSetting?.budgetAmount || 0;
  };

  // 저장
  const handleSave = async () => {
    if (changes.size === 0) {
      alert('변경된 항목이 없습니다.');
      return;
    }

    setSaving(true);
    try {
      const settings = Array.from(changes.entries()).map(([budgetDetailId, change]) => {
        const detail = details.find((d) => d.id === budgetDetailId);
        return {
          budgetDetailId,
          managerId: change.managerId !== undefined ? change.managerId : detail?.yearSetting?.managerId,
          budgetAmount: change.budgetAmount !== undefined ? change.budgetAmount : detail?.yearSetting?.budgetAmount || 0,
        };
      });

      const res = await fetch('/api/budget-details/year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, settings }),
      });

      if (res.ok) {
        alert(`${settings.length}건 저장 완료`);
        loadData();
      } else {
        const error = await res.json();
        alert(`저장 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 이전 연도 복사
  const handleCopy = async () => {
    try {
      const res = await fetch('/api/budget-details/year/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromYear: copyFromYear, toYear: year }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`${data.createdCount}건 복사 완료 (${data.skippedCount}건 스킵)`);
        setShowCopyModal(false);
        loadData();
      } else {
        alert(`복사 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('복사 오류:', error);
      alert('복사 중 오류가 발생했습니다.');
    }
  };

  // 카테고리별 그룹핑
  const groupedDetails = details.reduce<GroupedDetails>((acc, detail) => {
    if (!acc[detail.category]) {
      acc[detail.category] = {};
    }
    if (!acc[detail.category][detail.subcategory]) {
      acc[detail.category][detail.subcategory] = [];
    }
    acc[detail.category][detail.subcategory].push(detail);
    return acc;
  }, {});

  // 검색 필터링
  const filterDetails = (items: BudgetDetail[]) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.category.toLowerCase().includes(term) ||
        d.subcategory.toLowerCase().includes(term) ||
        d.departments.some((dept) => dept.name.toLowerCase().includes(term) || dept.committee.toLowerCase().includes(term))
    );
  };

  // 카테고리 토글
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // 서브카테고리 토글
  const toggleSubcategory = (key: string) => {
    setExpandedSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className={SPINNER_MD}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리 메뉴로 돌아가기
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold">세목별 담당자 관리</h1>
              <p className="text-gray-600">예산 세목별 담당자(1차 결재자)와 예산금액을 설정합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCopyModal(true)} className={`${BTN_OUTLINE} ${BTN_SM}`}>
              <Copy className="w-4 h-4" />
              이전연도 복사
            </button>
            <button onClick={handleSave} disabled={saving || changes.size === 0} className={`${BTN_SUCCESS} ${BTN_SM}`}>
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : `저장 (${changes.size}건)`}
            </button>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className={SECTION_CARD}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">연도:</label>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={`${SELECT_BASE} w-28`}>
              {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="세목명, 위원회, 사역팀 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${INPUT_BASE} pl-10`}
            />
          </div>
          <div className="text-sm text-gray-500">총 {details.length}개 세목</div>
        </div>
      </div>

      {/* 세목 목록 */}
      <div className={SECTION_CARD}>
        <div className="overflow-x-auto">
          <table className={TABLE_BASE}>
            <thead className={TABLE_HEADER}>
              <tr>
                <th className={`${TABLE_HEADER_CELL} w-64`}>예산(항) / 예산(목) / 예산(세목)</th>
                <th className={`${TABLE_HEADER_CELL} w-40`}>위원회/사역팀</th>
                <th className={`${TABLE_HEADER_CELL} w-40`}>담당자</th>
                <th className={`${TABLE_HEADER_CELL} w-32 text-right`}>예산금액</th>
                <th className={`${TABLE_HEADER_CELL} w-32 text-right`}>사용금액</th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY}>
              {Object.entries(groupedDetails).map(([category, subcategories]) => {
                const isExpanded = expandedCategories.has(category);
                const allItems = Object.values(subcategories).flat();
                const filteredItems = filterDetails(allItems);

                if (filteredItems.length === 0 && searchTerm) return null;

                return (
                  <React.Fragment key={category}>
                    {/* 카테고리 헤더 */}
                    <tr
                      className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                      onClick={() => toggleCategory(category)}
                    >
                      <td colSpan={5} className="px-4 py-2">
                        <div className="flex items-center gap-2 font-semibold text-blue-800">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span>{category || '(미분류)'}</span>
                          <span className="text-sm font-normal text-blue-600">({allItems.length}개 세목)</span>
                        </div>
                      </td>
                    </tr>

                    {isExpanded &&
                      Object.entries(subcategories).map(([subcategory, items]) => {
                        const subKey = `${category}|${subcategory}`;
                        const isSubExpanded = expandedSubcategories.has(subKey) || searchTerm;
                        const filteredSubItems = filterDetails(items);

                        if (filteredSubItems.length === 0 && searchTerm) return null;

                        return (
                          <React.Fragment key={subKey}>
                            {/* 서브카테고리 헤더 */}
                            <tr
                              className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                              onClick={() => toggleSubcategory(subKey)}
                            >
                              <td colSpan={5} className="px-4 py-2 pl-8">
                                <div className="flex items-center gap-2 font-medium text-gray-700">
                                  {isSubExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  <span>{subcategory || '(미분류)'}</span>
                                  <span className="text-sm font-normal text-gray-500">({items.length}개)</span>
                                </div>
                              </td>
                            </tr>

                            {/* 세목 목록 */}
                            {isSubExpanded &&
                              filteredSubItems.map((detail) => {
                                const isChanged = changes.has(detail.id);
                                return (
                                  <tr
                                    key={detail.id}
                                    className={`hover:bg-gray-50 ${isChanged ? 'bg-yellow-50' : ''}`}
                                  >
                                    <td className={`${TABLE_CELL} pl-12`}>
                                      <div className="font-medium">{detail.name || '(미지정)'}</div>
                                      {detail.accountCode && (
                                        <div className="text-xs text-gray-500">{detail.accountCode}</div>
                                      )}
                                    </td>
                                    <td className={TABLE_CELL}>
                                      {detail.departments.length > 0 ? (
                                        <div className="text-xs text-gray-600">
                                          {detail.departments
                                            .slice(0, 2)
                                            .map((d) => d.name)
                                            .join(', ')}
                                          {detail.departments.length > 2 && ` 외 ${detail.departments.length - 2}개`}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className={TABLE_CELL}>
                                      <select
                                        value={getCurrentManager(detail)}
                                        onChange={(e) => handleManagerChange(detail.id, e.target.value || null)}
                                        className={`${SELECT_BASE} text-sm py-1 ${isChanged ? 'ring-2 ring-yellow-400' : ''}`}
                                      >
                                        <option value="">선택</option>
                                        {users.map((user) => (
                                          <option key={user.id} value={user.id}>
                                            {user.username}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className={`${TABLE_CELL} text-right`}>
                                      <input
                                        type="number"
                                        value={getCurrentBudget(detail)}
                                        onChange={(e) => handleBudgetChange(detail.id, parseInt(e.target.value) || 0)}
                                        className={`${INPUT_BASE} text-sm py-1 text-right w-28 ${isChanged ? 'ring-2 ring-yellow-400' : ''}`}
                                      />
                                    </td>
                                    <td className={`${TABLE_CELL} text-right`}>
                                      <span className="text-gray-600">
                                        {formatAmount(detail.yearSetting?.usedAmount || 0)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 이전 연도 복사 모달 */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">이전 연도 설정 복사</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 mb-4">선택한 연도의 담당자 및 예산 설정을 {year}년으로 복사합니다.</p>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">복사할 연도:</label>
                <select
                  value={copyFromYear}
                  onChange={(e) => setCopyFromYear(parseInt(e.target.value))}
                  className={`${SELECT_BASE} w-28`}
                >
                  {[year - 1, year - 2, year - 3].map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <span className="text-gray-500">→</span>
                <span className="font-medium">{year}년</span>
              </div>
              <p className="text-sm text-amber-600 mt-4">* 이미 설정된 항목은 스킵됩니다.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCopyModal(false)} className={BTN_OUTLINE}>
                취소
              </button>
              <button onClick={handleCopy} className={BTN_PRIMARY}>
                <Copy className="w-4 h-4" />
                복사
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
