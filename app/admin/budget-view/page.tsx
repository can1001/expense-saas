'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  Users2,
  FileText,
  AlertCircle,
  BarChart3,
  Download,
} from 'lucide-react';
import {
  SECTION_CARD,
  SELECT_BASE,
  INPUT_BASE,
  SPINNER_MD,
  BTN_OUTLINE,
} from '@/lib/constants/styles';

interface BudgetDetailItem {
  id: string;
  detailId: string;
  detailName: string;
  category: string;
  subcategory: string;
  fullPath: string;
  managerId: string | null;
  managerName: string | null;
  budgetAmount: number;
  usedAmount: number;
}

interface Department {
  id: string;
  name: string;
  detailCount: number;
  details: BudgetDetailItem[];
}

interface Committee {
  id: string;
  name: string;
  departmentCount: number;
  detailCount: number;
  departments: Department[];
}

interface Summary {
  totalCommittees: number;
  totalDepartments: number;
  totalDetails: number;
  totalBudgetAmount: number;
  unassignedCount: number;
}

interface CommitteeOption {
  id: string;
  name: string;
}

export default function BudgetViewPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [allCommittees, setAllCommittees] = useState<CommitteeOption[]>([]);
  const [expandedCommittees, setExpandedCommittees] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        search,
        committeeId: committeeFilter,
      });
      const res = await fetch(`/api/budget/hierarchy?${params}`);
      const data = await res.json();

      setSummary(data.summary);
      setCommittees(data.committees || []);
      setAllCommittees(data.allCommittees || []);

      // 첫 로드 시 모든 위원회 펼치기
      if (data.committees?.length > 0 && expandedCommittees.size === 0) {
        setExpandedCommittees(new Set(data.committees.map((c: Committee) => c.id)));
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [year, search, committeeFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadData]);

  // 위원회 토글
  const toggleCommittee = (id: string) => {
    setExpandedCommittees((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 사역팀 토글
  const toggleDepartment = (id: string) => {
    setExpandedDepartments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 전체 펼치기/접기
  const expandAll = () => {
    setExpandedCommittees(new Set(committees.map((c) => c.id)));
    const allDepts = committees.flatMap((c) => c.departments.map((d) => d.id));
    setExpandedDepartments(new Set(allDepts));
  };

  const collapseAll = () => {
    setExpandedCommittees(new Set());
    setExpandedDepartments(new Set());
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  // 사용률 계산
  const getUsagePercent = (used: number, budget: number) => {
    if (budget === 0) return 0;
    return Math.round((used / budget) * 100);
  };

  // 사용률 색상
  const getUsageColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // Excel 내보내기
  const handleExport = async () => {
    setExporting(true);
    try {
      // 서버에서 Excel 파일 생성
      const params = new URLSearchParams({
        year: String(year),
        committeeId: committeeFilter,
        format: 'excel',
      });

      const res = await fetch(`/api/budget/hierarchy/export?${params}`);

      if (!res.ok) {
        throw new Error('내보내기 실패');
      }

      // 파일 다운로드
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `예산현황_${year}년.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Excel 내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && committees.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={SPINNER_MD}></div>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리 메뉴로 돌아가기
        </Link>
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold">예산 현황 조회</h1>
            <p className="text-gray-600">조직별 예산 세목 담당자와 예산금액을 조회합니다.</p>
          </div>
        </div>
      </div>

      {/* 요약 통계 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">위원회</div>
            <div className="text-2xl font-bold text-indigo-600">{summary.totalCommittees}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">사역팀</div>
            <div className="text-2xl font-bold text-blue-600">{summary.totalDepartments}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">세목</div>
            <div className="text-2xl font-bold text-green-600">{summary.totalDetails}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">총 예산</div>
            <div className="text-xl font-bold text-gray-900">
              {formatAmount(summary.totalBudgetAmount)}원
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">담당자 미지정</div>
            <div className={`text-2xl font-bold ${summary.unassignedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {summary.unassignedCount}
              {summary.unassignedCount > 0 && <AlertCircle className="inline w-5 h-5 ml-1" />}
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className={SECTION_CARD}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">연도:</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={`${SELECT_BASE} w-28`}
            >
              {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">위원회:</label>
            <select
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
              className={`${SELECT_BASE} w-40`}
            >
              <option value="">전체</option>
              {allCommittees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="위원회, 사역팀, 세목명, 담당자 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT_BASE} pl-10`}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              전체 펼치기
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              전체 접기
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || committees.length === 0}
            className={`${BTN_OUTLINE} flex items-center gap-2 disabled:opacity-50`}
          >
            <Download className="w-4 h-4" />
            {exporting ? '내보내는 중...' : 'Excel 다운로드'}
          </button>
        </div>
      </div>

      {/* 계층 트리 */}
      <div className={SECTION_CARD}>
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <div className={SPINNER_MD}></div>
          </div>
        )}

        {committees.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>조회된 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {committees.map((committee) => {
              const isCommitteeExpanded = expandedCommittees.has(committee.id);

              return (
                <div key={committee.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* 위원회 헤더 */}
                  <div
                    onClick={() => toggleCommittee(committee.id)}
                    className="bg-indigo-50 px-4 py-3 cursor-pointer hover:bg-indigo-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCommitteeExpanded ? (
                        <ChevronDown className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-indigo-600" />
                      )}
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      <span className="font-semibold text-indigo-900">{committee.name}</span>
                      <span className="text-sm text-indigo-600">
                        ({committee.departmentCount}개 사역팀, {committee.detailCount}개 세목)
                      </span>
                    </div>
                  </div>

                  {/* 사역팀 목록 */}
                  {isCommitteeExpanded && (
                    <div className="divide-y divide-gray-100">
                      {committee.departments.map((dept) => {
                        const isDeptExpanded = expandedDepartments.has(dept.id);

                        return (
                          <div key={dept.id}>
                            {/* 사역팀 헤더 */}
                            <div
                              onClick={() => toggleDepartment(dept.id)}
                              className="bg-blue-50 px-4 py-2 pl-10 cursor-pointer hover:bg-blue-100 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {isDeptExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-blue-600" />
                                )}
                                <Users2 className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-blue-900">{dept.name}</span>
                                <span className="text-sm text-blue-600">({dept.detailCount}개 세목)</span>
                              </div>
                            </div>

                            {/* 세목 목록 */}
                            {isDeptExpanded && (
                              <div className="bg-white divide-y divide-gray-50">
                                {dept.details.map((detail) => {
                                  const usagePercent = getUsagePercent(detail.usedAmount, detail.budgetAmount);

                                  return (
                                    <div key={detail.id} className="px-4 py-3 pl-16 hover:bg-gray-50">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            <span className="font-medium text-gray-900 truncate">
                                              {detail.detailName}
                                            </span>
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1 pl-6">
                                            {detail.category} &gt; {detail.subcategory}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-6 flex-shrink-0">
                                          {/* 담당자 */}
                                          <div className="text-right min-w-[80px]">
                                            <div className="text-xs text-gray-500">담당자</div>
                                            {detail.managerName ? (
                                              <div className="font-medium text-gray-900">
                                                {detail.managerName}
                                              </div>
                                            ) : (
                                              <div className="text-red-500 flex items-center justify-end gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                미지정
                                              </div>
                                            )}
                                          </div>
                                          {/* 예산/사용 */}
                                          <div className="text-right min-w-[120px]">
                                            <div className="text-xs text-gray-500">예산</div>
                                            <div className="font-medium text-gray-900">
                                              {formatAmount(detail.budgetAmount)}원
                                            </div>
                                            {detail.budgetAmount > 0 && (
                                              <div className="mt-1">
                                                <div className="flex items-center gap-2">
                                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                      className={`h-full ${getUsageColor(usagePercent)} transition-all`}
                                                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-xs text-gray-500 w-10 text-right">
                                                    {usagePercent}%
                                                  </span>
                                                </div>
                                                <div className="text-xs text-gray-400 text-right">
                                                  사용: {formatAmount(detail.usedAmount)}원
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
