'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Header from '@/components/Header';
import { ExcelExportModal } from '@/components/ExcelExportModal';
import ExpenseCard from '@/components/ExpenseCard';
import MobileFilterPanel, { MobileFilterButton } from '@/components/MobileFilterPanel';
import { ExpenseListSkeleton, FilterSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { LoadMoreIndicator } from '@/components/ui/LoadingIndicator';
import { ExpenseListItem, ExpenseListResponse, UserRole } from '@/lib/types';
import { INPUT_BASE, SELECT_BASE, BTN_PRIMARY, BTN_OUTLINE, BTN_LG, BTN_PAGINATION, BTN_PAGE_ACTIVE, BTN_PAGE_INACTIVE, SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';
import { formatCurrency } from '@/lib/utils';

interface CurrentUser {
  id: string;
  userid: string;
  username: string;
  role: UserRole | string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // 엑셀 다운로드용 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // 현재 사용자 및 일괄 변경 상태
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // 모바일 무한 스크롤
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 고급 필터
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState({
    committee: '',
    department: '',
    budgetCategory: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    paymentStatus: '',  // 지출 상태 필터 추가
  });

  useEffect(() => {
    fetchExpenses();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch {
      // 로그인 안 된 경우 무시
    }
  };

  // 관리자 또는 재정팀장인지 확인
  const canBulkChangePaymentStatus = currentUser &&
    ['admin', '재정팀장'].includes(currentUser.role);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/expenses?limit=10000');

      if (!response.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const data: ExpenseListResponse = await response.json();
      setExpenses(data.expenses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 검색 및 필터링
  const filteredExpenses = expenses.filter(expense => {
    // 첫 번째 항목의 예산 정보 (항/목은 이제 items에 있음)
    const firstItemCategory = expense.items?.[0]?.budgetCategory || '';

    // 텍스트 검색
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        expense.applicantName.toLowerCase().includes(query) ||
        expense.committee.toLowerCase().includes(query) ||
        expense.department.toLowerCase().includes(query) ||
        firstItemCategory.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // 위원회 필터
    if (filters.committee && expense.committee !== filters.committee) {
      return false;
    }

    // 사역팀 필터
    if (filters.department && expense.department !== filters.department) {
      return false;
    }

    // 예산항목 필터 (첫 번째 항목 기준)
    if (filters.budgetCategory && firstItemCategory !== filters.budgetCategory) {
      return false;
    }

    // 날짜 범위 필터
    if (filters.startDate) {
      const expenseDate = new Date(expense.requestDate);
      const startDate = new Date(filters.startDate);
      if (expenseDate < startDate) return false;
    }

    if (filters.endDate) {
      const expenseDate = new Date(expense.requestDate);
      const endDate = new Date(filters.endDate);
      if (expenseDate > endDate) return false;
    }

    // 금액 범위 필터
    if (filters.minAmount && expense.requestAmount < Number(filters.minAmount)) {
      return false;
    }

    if (filters.maxAmount && expense.requestAmount > Number(filters.maxAmount)) {
      return false;
    }

    // 지출 상태 필터
    if (filters.paymentStatus) {
      // 최종 승인된 항목만 지출 상태 필터 적용
      if (expense.status === 'APPROVED_FINAL') {
        if (expense.paymentStatus !== filters.paymentStatus) {
          return false;
        }
      } else {
        // 최종 승인 전 항목은 지출 상태 필터 시 제외
        return false;
      }
    }

    return true;
  });

  // 페이지네이션
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  // 페이지 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
    setMobileVisibleCount(10); // 모바일도 리셋
  }, [searchQuery, itemsPerPage, filters]);

  // 모바일 무한 스크롤 - Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && mobileVisibleCount < filteredExpenses.length) {
          setMobileVisibleCount(prev => Math.min(prev + 10, filteredExpenses.length));
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [mobileVisibleCount, filteredExpenses.length]);

  // 모바일용 표시 항목
  const mobileVisibleExpenses = filteredExpenses.slice(0, mobileVisibleCount);
  const hasMoreMobile = mobileVisibleCount < filteredExpenses.length;

  // 필터 옵션 추출 (첫 번째 항목의 예산 정보 사용)
  const uniqueCommittees = Array.from(new Set(expenses.map(e => e.committee))).sort();
  const uniqueDepartments = Array.from(new Set(expenses.map(e => e.department))).sort();
  const uniqueCategories = Array.from(new Set(
    expenses.map(e => e.items?.[0]?.budgetCategory).filter(Boolean)
  )).sort() as string[];

  // 활성화된 필터 개수 계산
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const handleFilterChange = (field: string, value: string) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      committee: '',
      department: '',
      budgetCategory: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      paymentStatus: '',
    });
    setSearchQuery('');
  };

  const handleRowClick = (id: string) => {
    router.push(`/expenses/${id}`);
  };

  // 체크박스 선택 핸들러
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // 전체 선택 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedExpenses.map(e => e.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  // 현재 페이지 전체 선택 여부
  const isAllSelected = paginatedExpenses.length > 0 &&
    paginatedExpenses.every(e => selectedIds.has(e.id));

  // 엑셀 다운로드 모달 열기
  const handleOpenExportModal = () => {
    if (selectedIds.size === 0) {
      alert('엑셀로 내보낼 지출결의서를 선택해주세요.');
      return;
    }
    setShowExportModal(true);
  };

  // 엑셀 다운로드 실행
  const handleExportExcel = async (options: { date: string | null; useSameDate: boolean }) => {
    try {
      setExporting(true);
      const ids = Array.from(selectedIds).join(',');

      // URL 파라미터 구성
      const params = new URLSearchParams({
        ids,
        status: 'all',
      });

      // 사용자 지정 날짜가 있으면 추가
      if (options.useSameDate && options.date) {
        params.append('expenseDate', options.date);
        params.append('useSameDate', 'true');
      }

      const response = await fetch(`/api/expenses/export/excel?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '엑셀 내보내기에 실패했습니다.');
      }

      // 파일 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Content-Disposition 헤더에서 파일명 추출
      const disposition = response.headers.get('Content-Disposition');
      let filename = '지출재정.xlsx';
      if (disposition) {
        const filenameMatch = disposition.match(/filename\*=UTF-8''(.+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // 선택 초기화 및 모달 닫기
      setSelectedIds(new Set());
      setShowExportModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '엑셀 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  // 지출 상태 일괄 변경 핸들러
  const handleBulkPaymentStatusChange = async (newStatus: 'PENDING' | 'COMPLETED') => {
    if (selectedIds.size === 0) {
      alert('변경할 지출결의서를 선택해주세요.');
      return;
    }

    const statusText = newStatus === 'COMPLETED' ? '지급완료' : '지급대기';
    const confirmed = confirm(`선택한 ${selectedIds.size}건을 ${statusText}로 변경하시겠습니까?\n\n※ 최종 승인된 항목만 변경됩니다.`);

    if (!confirmed) return;

    try {
      setBulkProcessing(true);
      const response = await fetch('/api/expenses/bulk-payment-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          paymentStatus: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '일괄 변경에 실패했습니다.');
      }

      alert(data.message);

      // 목록 새로고침 및 선택 초기화
      await fetchExpenses();
      setSelectedIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : '일괄 변경 중 오류가 발생했습니다.');
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 헤더 스켈레톤 */}
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* 필터 스켈레톤 */}
          <FilterSkeleton />

          {/* 모바일: 카드 스켈레톤 */}
          <div className="md:hidden mt-4">
            <ExpenseListSkeleton count={5} />
          </div>

          {/* 데스크톱: 테이블 스켈레톤 */}
          <div className="hidden md:block mt-4">
            <TableSkeleton rows={10} columns={8} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-gray-50 ${FLEX_CENTER}`}>
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchExpenses}
            className={BTN_PRIMARY}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">지출결의서 목록</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            총 {filteredExpenses.length}건의 지출결의서
          </p>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-4">
            {/* 모바일 검색 + 필터 버튼 */}
            <div className="md:hidden">
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400 min-h-[48px]"
                  />
                </div>
                <MobileFilterButton
                  onClick={() => setShowMobileFilters(true)}
                  activeCount={activeFilterCount}
                />
              </div>
              {/* 활성 필터 태그 표시 */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {filters.committee && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {filters.committee}
                      <button onClick={() => handleFilterChange('committee', '')} className="hover:text-blue-900">×</button>
                    </span>
                  )}
                  {filters.department && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {filters.department}
                      <button onClick={() => handleFilterChange('department', '')} className="hover:text-blue-900">×</button>
                    </span>
                  )}
                  {filters.budgetCategory && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {filters.budgetCategory}
                      <button onClick={() => handleFilterChange('budgetCategory', '')} className="hover:text-blue-900">×</button>
                    </span>
                  )}
                  {filters.paymentStatus && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {filters.paymentStatus === 'PENDING' ? '지급대기' :
                       filters.paymentStatus === 'HOLD' ? '지급보류' :
                       filters.paymentStatus === 'CANCELLED' ? '지급취소' : '지급완료'}
                      <button onClick={() => handleFilterChange('paymentStatus', '')} className="hover:text-blue-900">×</button>
                    </span>
                  )}
                  {(filters.startDate || filters.endDate) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {filters.startDate || '시작'} ~ {filters.endDate || '종료'}
                      <button onClick={() => { handleFilterChange('startDate', ''); handleFilterChange('endDate', ''); }} className="hover:text-blue-900">×</button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 데스크톱 기본 검색 */}
            <div className="hidden md:flex flex-col sm:flex-row gap-4 items-end justify-between">
              <div className="w-full sm:flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  통합 검색
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="청구인, 위원회, 사역팀, 예산항목 검색..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  고급 필터
                  {showAdvancedFilters ? ' 닫기' : ' 열기'}
                </button>

                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-gray-900"
                >
                  <option value={10}>10개씩</option>
                  <option value={20}>20개씩</option>
                  <option value={50}>50개씩</option>
                </select>
              </div>
            </div>

            {/* 고급 필터 (데스크톱만) */}
            {showAdvancedFilters && (
              <div className="hidden md:block pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      위원회
                    </label>
                    <select
                      value={filters.committee}
                      onChange={(e) => handleFilterChange('committee', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    >
                      <option value="">전체</option>
                      {uniqueCommittees.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      사역팀(부)
                    </label>
                    <select
                      value={filters.department}
                      onChange={(e) => handleFilterChange('department', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    >
                      <option value="">전체</option>
                      {uniqueDepartments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      예산(항)
                    </label>
                    <select
                      value={filters.budgetCategory}
                      onChange={(e) => handleFilterChange('budgetCategory', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    >
                      <option value="">전체</option>
                      {uniqueCategories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지급 상태
                    </label>
                    <select
                      value={filters.paymentStatus}
                      onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    >
                      <option value="">전체</option>
                      <option value="PENDING">지급대기</option>
                      <option value="HOLD">지급보류</option>
                      <option value="CANCELLED">지급취소</option>
                      <option value="COMPLETED">지급완료</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      날짜 범위
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                      />
                      <span className="text-gray-500">~</span>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      금액 범위 (원)
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={filters.minAmount}
                        onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                        placeholder="최소"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white placeholder-gray-400"
                      />
                      <span className="text-gray-500">~</span>
                      <input
                        type="number"
                        value={filters.maxAmount}
                        onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                        placeholder="최대"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    필터 초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 선택 항목 액션 바 */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <span className="text-blue-700 font-medium text-center sm:text-left">
              {selectedIds.size}건 선택됨
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
              {/* 관리자/재정팀장 전용: 일괄 지출 상태 변경 버튼 */}
              {canBulkChangePaymentStatus && (
                <>
                  <button
                    onClick={() => handleBulkPaymentStatusChange('COMPLETED')}
                    disabled={bulkProcessing || exporting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {bulkProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        처리 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        일괄 지급완료
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleBulkPaymentStatusChange('PENDING')}
                    disabled={bulkProcessing || exporting}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {bulkProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        처리 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        일괄 지급대기
                      </>
                    )}
                  </button>
                </>
              )}
              {/* 엑셀 다운로드 버튼 */}
              <button
                onClick={handleOpenExportModal}
                disabled={exporting || bulkProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    내보내는 중...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    엑셀 다운로드
                  </>
                )}
              </button>
              {/* 대량이체 다운로드 버튼 (우리은행) */}
              <button
                onClick={() => {
                  const ids = Array.from(selectedIds).join(',');
                  window.location.href = `/api/expenses/export/excel?ids=${ids}&format=woori`;
                }}
                disabled={exporting || bulkProcessing}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                대량이체 다운로드
              </button>
            </div>
          </div>
        )}

        {/* 모바일 카드 뷰 (md 미만) - 무한 스크롤 */}
        <div className="md:hidden space-y-3">
          {/* 전체 선택 헤더 */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">전체 선택</span>
            </label>
            <span className="text-sm text-gray-500">
              {mobileVisibleExpenses.length} / {filteredExpenses.length}건
            </span>
          </div>

          {/* 카드 목록 - 무한 스크롤 */}
          {filteredExpenses.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 지출결의서가 없습니다.'}
            </div>
          ) : (
            <>
              {mobileVisibleExpenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  isSelected={selectedIds.has(expense.id)}
                  onSelect={handleSelectOne}
                  onClick={handleRowClick}
                />
              ))}
              {/* 무한 스크롤 로딩 인디케이터 */}
              <LoadMoreIndicator
                isLoading={false}
                hasMore={hasMoreMobile}
                loadMoreRef={loadMoreRef}
              />
            </>
          )}
        </div>

        {/* 데스크톱 테이블 뷰 (md 이상) */}
        <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-500">
                <tr>
                  <th className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    신청일자
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    청구인
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    예산항목
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                    청구금액
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    위원회
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    결재상태
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                    지급상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? '검색 결과가 없습니다.' : '등록된 지출결의서가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(expense.id)}
                          onChange={(e) => handleSelectOne(expense.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.applicantName}
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-700"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{expense.items?.[0]?.budgetCategory || '-'}</span>
                          <span className="text-gray-500 text-xs">{expense.items?.[0]?.budgetSubcategory || '-'}</span>
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {formatCurrency(expense.requestAmount)}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.committee}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-center"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.status === 'DRAFT' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            임시저장
                          </span>
                        ) : expense.status === 'PENDING' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            결재대기
                          </span>
                        ) : expense.status === 'APPROVED_STEP_1' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            1차승인
                          </span>
                        ) : expense.status === 'APPROVED_STEP_2' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            2차승인
                          </span>
                        ) : expense.status === 'APPROVED_FINAL' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            최종승인
                          </span>
                        ) : expense.status === 'REJECTED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            반려
                          </span>
                        ) : expense.status === 'WITHDRAWN' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            회수
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            -
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-center"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.status === 'APPROVED_FINAL' ? (
                          expense.paymentStatus === 'COMPLETED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              지급완료
                            </span>
                          ) : expense.paymentStatus === 'HOLD' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              지급보류
                            </span>
                          ) : expense.paymentStatus === 'CANCELLED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              지급취소
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              지급대기
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* 페이지네이션 (모바일/데스크톱 공통) */}
        {paginatedExpenses.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{startIndex + 1}</span>
              {' - '}
              <span className="font-medium">
                {Math.min(endIndex, filteredExpenses.length)}
              </span>
              {' / '}
              <span className="font-medium">{filteredExpenses.length}</span>
              {' 건'}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`${BTN_PAGINATION} min-h-[44px] min-w-[44px]`}
              >
                이전
              </button>

              {/* 모바일: 간소화된 페이지 표시 */}
              <div className="flex gap-1 items-center">
                <span className="md:hidden text-sm text-gray-600 px-2">
                  {currentPage} / {totalPages}
                </span>
                {/* 데스크톱: 전체 페이지 버튼 */}
                <div className="hidden md:flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={currentPage === page ? BTN_PAGE_ACTIVE : BTN_PAGE_INACTIVE}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2 py-2 text-gray-500">...</span>;
                    }
                    return null;
                  })}
                </div>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`${BTN_PAGINATION} min-h-[44px] min-w-[44px]`}
              >
                다음
              </button>
            </div>
          </div>
        )}

        {/* 신규 등록 버튼 - 데스크톱 */}
        <div className="mt-6 hidden md:flex justify-end">
          <button
            onClick={() => router.push('/expenses/new')}
            className={`${BTN_PRIMARY} ${BTN_LG} shadow-sm`}
          >
            + 신규 지출결의서 작성
          </button>
        </div>

        {/* 하단 여백 (모바일 플로팅 버튼 공간 확보) */}
        <div className="h-20 md:hidden" />
      </div>

      {/* 신규 등록 버튼 - 모바일 플로팅 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-100 to-transparent">
        <button
          onClick={() => router.push('/expenses/new')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          신규 지출결의서 작성
        </button>
      </div>

      {/* 엑셀 다운로드 모달 */}
      <ExcelExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportExcel}
        selectedCount={selectedIds.size}
        isExporting={exporting}
      />

      {/* 모바일 필터 패널 */}
      <MobileFilterPanel
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        uniqueCommittees={uniqueCommittees}
        uniqueDepartments={uniqueDepartments}
        uniqueCategories={uniqueCategories}
      />
    </div>
  );
}
