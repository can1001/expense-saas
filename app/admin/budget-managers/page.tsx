'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Copy, Search, ChevronDown, ChevronRight, Users, AlertTriangle } from 'lucide-react';
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

// 5단계 트리 구조: 위원회 → 사역팀 → 항 → 목 → 세목
interface TreeData {
  [committee: string]: {
    [department: string]: {
      [category: string]: {
        [subcategory: string]: BudgetDetail[];
      };
    };
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
  const [expandedCommittees, setExpandedCommittees] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [copyFromYear, setCopyFromYear] = useState(currentYear - 1);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false);
  const [teamLeaders, setTeamLeaders] = useState<Map<string, { id: string; name: string }>>(new Map());

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [detailsRes, usersRes, yearRolesRes] = await Promise.all([
        fetch(`/api/budget-details/year?year=${year}`),
        fetch('/api/users?pageSize=1000&isActive=true'),
        fetch(`/api/users/year-roles?year=${year}&includeUser=true`),
      ]);

      const detailsData = await detailsRes.json();
      const usersData = await usersRes.json();
      const yearRolesData = await yearRolesRes.json();

      setDetails(detailsData.details || []);
      setUsers(usersData.users || []);
      setChanges(new Map());

      // 팀장 정보 맵 생성 (department -> teamLeader)
      const leaderMap = new Map<string, { id: string; name: string }>();
      (yearRolesData.yearRoles || []).forEach((yr: { role: string; department: string | null; userId: string; user: { username: string } }) => {
        if (yr.role === 'team_leader' && yr.department) {
          leaderMap.set(yr.department, { id: yr.userId, name: yr.user.username });
        }
      });
      setTeamLeaders(leaderMap);

      // 모든 위원회 펼치기
      const committees = new Set<string>();
      (detailsData.details || []).forEach((d: BudgetDetail) => {
        if (d.departments.length === 0) {
          committees.add('미지정');
        } else {
          d.departments.forEach((dept) => committees.add(dept.committee));
        }
      });
      setExpandedCommittees(committees);
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

  // 5단계 트리 구조로 그룹핑: 위원회 → 사역팀 → 항 → 목 → 세목
  const treeData = details.reduce<TreeData>((acc, detail) => {
    // 부서가 없는 세목은 "미지정" 그룹으로
    const depts = detail.departments.length > 0 ? detail.departments : [{ id: '', name: '미지정', committee: '미지정' }];

    depts.forEach((dept) => {
      const committee = dept.committee || '미지정';
      const department = dept.name || '미지정';
      const category = detail.category || '미분류';
      const subcategory = detail.subcategory || '미분류';

      if (!acc[committee]) acc[committee] = {};
      if (!acc[committee][department]) acc[committee][department] = {};
      if (!acc[committee][department][category]) acc[committee][department][category] = {};
      if (!acc[committee][department][category][subcategory]) acc[committee][department][category][subcategory] = [];

      acc[committee][department][category][subcategory].push(detail);
    });

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

  // 위원회 토글
  const toggleCommittee = (committee: string) => {
    setExpandedCommittees((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(committee)) {
        newSet.delete(committee);
      } else {
        newSet.add(committee);
      }
      return newSet;
    });
  };

  // 사역팀 토글
  const toggleDepartment = (key: string) => {
    setExpandedDepartments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 카테고리 토글
  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
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

  // 금액 포맷 (표시용)
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  // 예외 케이스 확인 (담당자가 팀장과 다른 경우)
  const isException = (detail: BudgetDetail, deptName: string): boolean => {
    const managerId = getCurrentManager(detail);
    if (!managerId) return false;
    const teamLeader = teamLeaders.get(deptName);
    if (!teamLeader) return true; // 팀장이 지정되지 않은 경우도 예외
    return managerId !== teamLeader.id;
  };

  // 팀장 이름 가져오기
  const getTeamLeaderName = (deptName: string): string | null => {
    return teamLeaders.get(deptName)?.name || null;
  };

  // 예산금액 입력 처리 (콤마 제거 후 숫자만 추출)
  const handleBudgetInputChange = (detailId: string, inputValue: string) => {
    const numericValue = parseInt(inputValue.replace(/[^0-9]/g, '')) || 0;
    handleBudgetChange(detailId, numericValue);
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
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showExceptionsOnly}
                onChange={(e) => setShowExceptionsOnly(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                예외만 보기
              </span>
            </label>
            <div className="text-sm text-gray-500">총 {details.length}개 세목</div>
          </div>
        </div>
      </div>

      {/* 세목 목록 */}
      <div className={SECTION_CARD}>
        <div className="overflow-x-auto">
          <table className={TABLE_BASE}>
            <thead className={TABLE_HEADER}>
              <tr>
                <th className={`${TABLE_HEADER_CELL} w-80`}>위원회 / 사역팀 / 항 / 목 / 세목</th>
                <th className={`${TABLE_HEADER_CELL} w-40`}>담당자</th>
                <th className={`${TABLE_HEADER_CELL} w-32 text-right`}>예산금액</th>
                <th className={`${TABLE_HEADER_CELL} w-32 text-right`}>사용금액</th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY}>
              {Object.entries(treeData).map(([committee, departments]) => {
                const isCommitteeExpanded = expandedCommittees.has(committee);

                // 위원회 내 전체 세목 수 계산
                const committeeDetailCount = Object.values(departments).reduce((sum, cats) =>
                  sum + Object.values(cats).reduce((catSum, subs) =>
                    catSum + Object.values(subs).reduce((subSum, items) => subSum + items.length, 0), 0), 0);

                // 검색어가 있을 때 해당 위원회 내 검색 결과가 있는지 확인
                const hasSearchResults = !searchTerm || Object.values(departments).some((cats) =>
                  Object.values(cats).some((subs) =>
                    Object.values(subs).some((items) => filterDetails(items).length > 0)));

                if (!hasSearchResults) return null;

                return (
                  <React.Fragment key={committee}>
                    {/* 1단계: 위원회 헤더 */}
                    <tr
                      className="bg-indigo-100 cursor-pointer hover:bg-indigo-200"
                      onClick={() => toggleCommittee(committee)}
                    >
                      <td colSpan={4} className="px-4 py-2">
                        <div className="flex items-center gap-2 font-bold text-indigo-900">
                          {isCommitteeExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          <span>{committee}</span>
                          <span className="text-sm font-normal text-indigo-600">({committeeDetailCount}개 세목)</span>
                        </div>
                      </td>
                    </tr>

                    {isCommitteeExpanded &&
                      Object.entries(departments).map(([department, categories]) => {
                        const deptKey = `${committee}|${department}`;
                        const isDeptExpanded = expandedDepartments.has(deptKey) || !!searchTerm;

                        // 사역팀 내 전체 세목 수 계산
                        const deptDetailCount = Object.values(categories).reduce((sum, subs) =>
                          sum + Object.values(subs).reduce((subSum, items) => subSum + items.length, 0), 0);

                        // 검색 결과 확인
                        const hasDeptSearchResults = !searchTerm || Object.values(categories).some((subs) =>
                          Object.values(subs).some((items) => filterDetails(items).length > 0));

                        if (!hasDeptSearchResults) return null;

                        return (
                          <React.Fragment key={deptKey}>
                            {/* 2단계: 사역팀 헤더 */}
                            <tr
                              className="bg-blue-50 cursor-pointer hover:bg-blue-100"
                              onClick={() => toggleDepartment(deptKey)}
                            >
                              <td colSpan={4} className="px-4 py-2 pl-8">
                                <div className="flex items-center gap-2 font-semibold text-blue-800">
                                  {isDeptExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  <span>{department}</span>
                                  <span className="text-sm font-normal text-blue-600">({deptDetailCount}개 세목)</span>
                                </div>
                              </td>
                            </tr>

                            {isDeptExpanded &&
                              Object.entries(categories).map(([category, subcategories]) => {
                                const catKey = `${deptKey}|${category}`;
                                const isCatExpanded = expandedCategories.has(catKey) || !!searchTerm;

                                // 항 내 전체 세목 수 계산
                                const catDetailCount = Object.values(subcategories).reduce((sum, items) => sum + items.length, 0);

                                // 검색 결과 확인
                                const hasCatSearchResults = !searchTerm || Object.values(subcategories).some((items) => filterDetails(items).length > 0);

                                if (!hasCatSearchResults) return null;

                                return (
                                  <React.Fragment key={catKey}>
                                    {/* 3단계: 항 헤더 */}
                                    <tr
                                      className="bg-gray-100 cursor-pointer hover:bg-gray-200"
                                      onClick={() => toggleCategory(catKey)}
                                    >
                                      <td colSpan={4} className="px-4 py-2 pl-12">
                                        <div className="flex items-center gap-2 font-medium text-gray-700">
                                          {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                          <span>{category}</span>
                                          <span className="text-sm font-normal text-gray-500">({catDetailCount}개)</span>
                                        </div>
                                      </td>
                                    </tr>

                                    {isCatExpanded &&
                                      Object.entries(subcategories).map(([subcategory, items]) => {
                                        const subKey = `${catKey}|${subcategory}`;
                                        const isSubExpanded = expandedSubcategories.has(subKey) || !!searchTerm;
                                        const filteredItems = filterDetails(items);

                                        if (filteredItems.length === 0 && searchTerm) return null;

                                        return (
                                          <React.Fragment key={subKey}>
                                            {/* 4단계: 목 헤더 */}
                                            <tr
                                              className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                                              onClick={() => toggleSubcategory(subKey)}
                                            >
                                              <td colSpan={4} className="px-4 py-2 pl-16">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                  {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                  <span>{subcategory}</span>
                                                  <span className="text-sm font-normal text-gray-400">({items.length}개)</span>
                                                </div>
                                              </td>
                                            </tr>

                                            {/* 5단계: 세목 목록 */}
                                            {isSubExpanded &&
                                              filteredItems
                                                .filter((detail) => !showExceptionsOnly || isException(detail, department))
                                                .map((detail) => {
                                                const isChanged = changes.has(detail.id);
                                                const hasException = isException(detail, department);
                                                const leaderName = getTeamLeaderName(department);
                                                return (
                                                  <tr
                                                    key={`${subKey}|${detail.id}`}
                                                    className={`hover:bg-gray-50 ${isChanged ? 'bg-yellow-50' : ''} ${hasException ? 'bg-amber-50' : ''}`}
                                                  >
                                                    <td className={`${TABLE_CELL} pl-20`}>
                                                      <div className="font-medium">{detail.name}</div>
                                                      {detail.accountCode && (
                                                        <div className="text-xs text-gray-500">{detail.accountCode}</div>
                                                      )}
                                                    </td>
                                                    <td className={TABLE_CELL}>
                                                      <div className="flex items-center gap-2">
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
                                                        {hasException && (
                                                          <span
                                                            className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded flex items-center gap-1"
                                                            title={leaderName ? `기본 팀장: ${leaderName}` : '팀장 미지정'}
                                                          >
                                                            <AlertTriangle className="w-3 h-3" />
                                                            예외
                                                          </span>
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td className={`${TABLE_CELL} text-right`}>
                                                      <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={formatAmount(getCurrentBudget(detail))}
                                                        onChange={(e) => handleBudgetInputChange(detail.id, e.target.value)}
                                                        className={`${INPUT_BASE} text-sm py-1 text-right w-32 ${isChanged ? 'ring-2 ring-yellow-400' : ''}`}
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
