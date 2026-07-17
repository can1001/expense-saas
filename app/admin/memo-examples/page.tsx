'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Search, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import {
  SECTION_CARD,
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
import { useOrgTerms } from '@/lib/contexts/TenantContext';
import { apiBase } from '@/lib/api/api-base';

interface Committee {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  committeeId: string;
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
    committeeId: string;
  }>;
}

interface GroupedDetails {
  [category: string]: {
    [subcategory: string]: BudgetDetail[];
  };
}

export default function MemoExamplesPage() {
  const terms = useOrgTerms();
  const currentYear = new Date().getFullYear();
  const [details, setDetails] = useState<BudgetDetail[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommittee, setSelectedCommittee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [changes, setChanges] = useState<Map<string, string>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [detailsRes, committeesRes, departmentsRes] = await Promise.all([
        fetch(`/api/budget-details/year?year=${currentYear}`),
        fetch(`${apiBase('budget-master')}/committees`),
        fetch(`${apiBase('budget-master')}/departments`),
      ]);

      const detailsData = await detailsRes.json();
      const committeesData = await committeesRes.json();
      const departmentsData = await departmentsRes.json();

      setDetails(detailsData.details || []);
      setCommittees(committeesData.committees || []);
      setDepartments(departmentsData.departments || []);
      setChanges(new Map());

      // 모든 카테고리 펼치기
      const categories = new Set<string>(detailsData.details?.map((d: BudgetDetail) => d.category) || []);
      setExpandedCategories(categories);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 필터링된 부서 목록
  const filteredDepartments = selectedCommittee
    ? departments.filter((d) => d.committeeId === selectedCommittee)
    : departments;

  // 적요 예제 변경
  const handleDescriptionChange = (detailId: string, description: string) => {
    setChanges((prev) => {
      const newChanges = new Map(prev);
      newChanges.set(detailId, description);
      return newChanges;
    });
  };

  // 현재 적요 값 가져오기
  const getCurrentDescription = (detail: BudgetDetail): string => {
    const change = changes.get(detail.id);
    if (change !== undefined) {
      return change;
    }
    return detail.description || '';
  };

  // 개별 저장
  const handleSave = async (detailId: string) => {
    const description = changes.get(detailId);
    if (description === undefined) return;

    setSaving(detailId);
    try {
      const res = await fetch(`/api/budget-details/${detailId}/description`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (res.ok) {
        // 성공 시 로컬 상태 업데이트
        setDetails((prev) =>
          prev.map((d) => (d.id === detailId ? { ...d, description } : d))
        );
        // 변경 목록에서 제거
        setChanges((prev) => {
          const newChanges = new Map(prev);
          newChanges.delete(detailId);
          return newChanges;
        });
      } else {
        const error = await res.json();
        alert(`저장 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(null);
    }
  };

  // 전체 저장
  const handleSaveAll = async () => {
    if (changes.size === 0) {
      alert('변경된 항목이 없습니다.');
      return;
    }

    setSaving('all');
    let successCount = 0;
    let failCount = 0;

    for (const [detailId, description] of changes.entries()) {
      try {
        const res = await fetch(`/api/budget-details/${detailId}/description`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        });

        if (res.ok) {
          setDetails((prev) =>
            prev.map((d) => (d.id === detailId ? { ...d, description } : d))
          );
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setChanges(new Map());
    setSaving(null);

    if (failCount > 0) {
      alert(`${successCount}건 저장 완료, ${failCount}건 실패`);
    } else {
      alert(`${successCount}건 저장 완료`);
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

  // 검색 및 필터링
  const filterDetails = (items: BudgetDetail[]) => {
    return items.filter((d) => {
      // 위원회 필터
      if (selectedCommittee) {
        const hasCommittee = d.departments.some((dept) => dept.committeeId === selectedCommittee);
        if (!hasCommittee) return false;
      }

      // 부서 필터
      if (selectedDepartment) {
        const hasDepartment = d.departments.some((dept) => dept.id === selectedDepartment);
        if (!hasDepartment) return false;
      }

      // 검색어 필터
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          d.name.toLowerCase().includes(term) ||
          d.category.toLowerCase().includes(term) ||
          d.subcategory.toLowerCase().includes(term) ||
          (d.description || '').toLowerCase().includes(term)
        );
      }

      return true;
    });
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
            <FileText className="w-8 h-8 text-teal-600" />
            <div>
              <h1 className="text-2xl font-bold">적요 예제 관리</h1>
              <p className="text-gray-600">세목별 적요 예제를 관리합니다. 콤마(,)로 구분하여 입력하세요.</p>
            </div>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={saving !== null || changes.size === 0}
            className={`${BTN_SUCCESS} ${BTN_SM}`}
          >
            <Save className="w-4 h-4" />
            {saving === 'all' ? '저장 중...' : `전체 저장 (${changes.size}건)`}
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className={SECTION_CARD}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">{terms.committee}:</label>
            <select
              value={selectedCommittee}
              onChange={(e) => {
                setSelectedCommittee(e.target.value);
                setSelectedDepartment('');
              }}
              className={`${SELECT_BASE} w-36`}
            >
              <option value="">전체</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">부서:</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={`${SELECT_BASE} w-36`}
              disabled={!selectedCommittee}
            >
              <option value="">전체</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="세목명, 적요 예제 검색..."
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
                <th className={`${TABLE_HEADER_CELL} w-48`}>예산(항) / 예산(목) / 세목</th>
                <th className={`${TABLE_HEADER_CELL} w-32`}>부서</th>
                <th className={TABLE_HEADER_CELL}>적요 예제 (콤마로 구분)</th>
                <th className={`${TABLE_HEADER_CELL} w-20 text-center`}>저장</th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY}>
              {Object.entries(groupedDetails).map(([category, subcategories]) => {
                const isExpanded = expandedCategories.has(category);
                const allItems = Object.values(subcategories).flat();
                const filteredItems = filterDetails(allItems);

                if (filteredItems.length === 0) return null;

                return (
                  <React.Fragment key={category}>
                    {/* 카테고리 헤더 */}
                    <tr
                      className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                      onClick={() => toggleCategory(category)}
                    >
                      <td colSpan={4} className="px-4 py-2">
                        <div className="flex items-center gap-2 font-semibold text-blue-800">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span>{category || '(미분류)'}</span>
                          <span className="text-sm font-normal text-blue-600">
                            ({filteredItems.length}개 세목)
                          </span>
                        </div>
                      </td>
                    </tr>

                    {isExpanded &&
                      Object.entries(subcategories).map(([subcategory, items]) => {
                        const subKey = `${category}|${subcategory}`;
                        const isSubExpanded = expandedSubcategories.has(subKey) || searchTerm || selectedCommittee;
                        const filteredSubItems = filterDetails(items);

                        if (filteredSubItems.length === 0) return null;

                        return (
                          <React.Fragment key={subKey}>
                            {/* 서브카테고리 헤더 */}
                            <tr
                              className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                              onClick={() => toggleSubcategory(subKey)}
                            >
                              <td colSpan={4} className="px-4 py-2 pl-8">
                                <div className="flex items-center gap-2 font-medium text-gray-700">
                                  {isSubExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  <span>{subcategory || '(미분류)'}</span>
                                  <span className="text-sm font-normal text-gray-500">
                                    ({filteredSubItems.length}개)
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* 세목 목록 */}
                            {isSubExpanded &&
                              filteredSubItems.map((detail) => {
                                const isChanged = changes.has(detail.id);
                                const isSaving = saving === detail.id;
                                return (
                                  <tr
                                    key={detail.id}
                                    className={`hover:bg-gray-50 ${isChanged ? 'bg-yellow-50' : ''}`}
                                  >
                                    <td className={`${TABLE_CELL} pl-12`}>
                                      <div className="font-medium">{detail.name}</div>
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
                                          {detail.departments.length > 2 && ` 외 ${detail.departments.length - 2}`}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className={TABLE_CELL}>
                                      <input
                                        type="text"
                                        value={getCurrentDescription(detail)}
                                        onChange={(e) => handleDescriptionChange(detail.id, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && isChanged) {
                                            handleSave(detail.id);
                                          } else if (e.key === 'Escape') {
                                            setChanges((prev) => {
                                              const newChanges = new Map(prev);
                                              newChanges.delete(detail.id);
                                              return newChanges;
                                            });
                                          }
                                        }}
                                        placeholder="출장비, 택시비, 주차비..."
                                        className={`${INPUT_BASE} text-sm py-1 ${isChanged ? 'ring-2 ring-yellow-400' : ''}`}
                                      />
                                    </td>
                                    <td className={`${TABLE_CELL} text-center`}>
                                      {isChanged && (
                                        <button
                                          onClick={() => handleSave(detail.id)}
                                          disabled={isSaving}
                                          className="text-teal-600 hover:text-teal-800 disabled:text-gray-400"
                                          title="저장 (Enter)"
                                        >
                                          {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <Save className="w-4 h-4" />
                                          )}
                                        </button>
                                      )}
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

      {/* 도움말 */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-medium mb-2">사용 방법:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>적요 예제는 콤마(,)로 구분하여 입력합니다. 예: 출장비, 택시비, 주차비</li>
          <li>Enter 키를 누르면 해당 항목이 저장됩니다.</li>
          <li>Escape 키를 누르면 변경 내용이 취소됩니다.</li>
          <li>변경된 항목은 노란색으로 표시됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
