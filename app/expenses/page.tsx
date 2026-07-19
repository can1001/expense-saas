'use client';

import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import Image from 'next/image';
import GlobalShell from '@/components/layout/GlobalShell';
import { ExcelExportModal } from '@/components/ExcelExportModal';
import { BulkPaymentStatusModal } from '@/components/BulkPaymentStatusModal';
import { BulkExpenseDateModal } from '@/components/BulkExpenseDateModal';
import { BulkPrintModal } from '@/components/BulkPrintModal';
import ExpenseCard from '@/components/ExpenseCard';
import MobileFilterPanel, { MobileFilterButton } from '@/components/MobileFilterPanel';
import { ExpenseListSkeleton, FilterSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { LoadMoreIndicator } from '@/components/ui/LoadingIndicator';
import { ExpenseListItem, ExpenseListResponse, UserRole } from '@/lib/types';
import { BTN_PRIMARY, BTN_LG, BTN_PAGINATION, BTN_PAGE_ACTIVE, BTN_PAGE_INACTIVE, FLEX_CENTER } from '@/lib/constants/styles';
import { formatCurrency, getExpenseEditPath } from '@/lib/utils';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';
import { useOrgTerms } from '@/lib/contexts/TenantContext';
import { apiBase } from '@/lib/api/api-base';

interface CurrentUser {
  id: string;
  userid: string;
  username: string;
  role: UserRole | string;
}

type SortKey = 'requestDate' | 'applicantName' | 'budgetCategory' | 'budgetSubcategory' | 'budgetDetail' | 'requestAmount' | 'committee' | 'status' | 'approvedAt' | 'paymentStatus' | 'expenseDate';
type SortDirection = 'asc' | 'desc';

function ExpensesPageContent() {
  const terms = useOrgTerms();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터에서 초기값 읽기
  const getInitialFilters = useCallback(() => ({
    committee: searchParams.get('committee') || '',
    department: searchParams.get('department') || '',
    budgetCategory: searchParams.get('category') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    minAmount: searchParams.get('minAmount') || '',
    maxAmount: searchParams.get('maxAmount') || '',
    status: searchParams.get('status') || '',
    paymentStatus: searchParams.get('paymentStatus') || '',
    approvedStartDate: searchParams.get('approvedStart') || '',
    approvedEndDate: searchParams.get('approvedEnd') || '',
    expenseStartDate: searchParams.get('expenseStart') || '',
    expenseEndDate: searchParams.get('expenseEnd') || '',
  }), [searchParams]);

  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [serverPagination, setServerPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [serverAggregates, setServerAggregates] = useState({ totalCount: 0, totalRequestAmount: 0 });
  const [filterOptions, setFilterOptions] = useState<{ committees: string[]; departments: string[]; budgetCategories: string[] }>({
    committees: [],
    departments: [],
    budgetCategories: [],
  });
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const refetch = useCallback(() => setRefetchTrigger((t) => t + 1), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get('q') || '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // 정렬 상태
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'requestDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>((searchParams.get('dir') as SortDirection) || 'desc');

  // 엑셀 다운로드용 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // 현재 사용자 및 일괄 변경 상태
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [showBulkExpenseDateModal, setShowBulkExpenseDateModal] = useState(false);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);

  // 모바일 무한 스크롤
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 고급 필터
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState(getInitialFilters);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${apiBase('auth')}/auth/me`);
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch {
      // 로그인 안 된 경우 무시
    }
  };

  // 지급상태 변경 권한 확인 — permission 단일 출처
  const canBulkChangePaymentStatus =
    !!currentUser && roleHasPermission(currentUser.role, PERMISSIONS.EXPENSE_PAYMENT_MANAGE);

  // 검색어 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 마운트 시 1회: 현재 사용자 + 필터 옵션
  useEffect(() => {
    fetchCurrentUser();
    fetch('/api/expenses/filter-options')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setFilterOptions(data))
      .catch(() => {
        // 옵션 조회 실패는 무시 (드롭다운만 빈 상태)
      });
  }, []);

  // 지출결의서 목록 fetch (필터/검색/정렬/페이지 변경 시)
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('limit', String(itemsPerPage));
        params.set('sortBy', sortKey);
        params.set('sortDir', sortDirection);
        if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
        if (filters.committee) params.set('committee', filters.committee);
        if (filters.department) params.set('department', filters.department);
        if (filters.budgetCategory) params.set('category', filters.budgetCategory);
        if (filters.startDate) params.set('startDate', filters.startDate);
        if (filters.endDate) params.set('endDate', filters.endDate);
        if (filters.minAmount) params.set('minAmount', filters.minAmount);
        if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
        if (filters.status) params.set('status', filters.status);
        if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
        if (filters.approvedStartDate) params.set('approvedStart', filters.approvedStartDate);
        if (filters.approvedEndDate) params.set('approvedEnd', filters.approvedEndDate);
        if (filters.expenseStartDate) params.set('expenseStart', filters.expenseStartDate);
        if (filters.expenseEndDate) params.set('expenseEnd', filters.expenseEndDate);

        const response = await fetch(`${apiBase('expenses')}/expenses?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('데이터를 불러오는데 실패했습니다.');
        }

        const data = await response.json();
        setExpenses(data.expenses || []);
        if (data.pagination) setServerPagination(data.pagination);
        if (data.aggregates) setServerAggregates(data.aggregates);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [
    debouncedSearchQuery,
    currentPage,
    itemsPerPage,
    sortKey,
    sortDirection,
    filters,
    refetchTrigger,
  ]);

  // URL 동기화 - 필터/검색 상태가 변경되면 URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchQuery) params.set('q', searchQuery);
    if (sortKey !== 'requestDate') params.set('sort', sortKey);
    if (sortDirection !== 'desc') params.set('dir', sortDirection);
    if (currentPage > 1) params.set('page', String(currentPage));
    if (filters.committee) params.set('committee', filters.committee);
    if (filters.department) params.set('department', filters.department);
    if (filters.budgetCategory) params.set('category', filters.budgetCategory);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.minAmount) params.set('minAmount', filters.minAmount);
    if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
    if (filters.status) params.set('status', filters.status);
    if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    if (filters.approvedStartDate) params.set('approvedStart', filters.approvedStartDate);
    if (filters.approvedEndDate) params.set('approvedEnd', filters.approvedEndDate);
    if (filters.expenseStartDate) params.set('expenseStart', filters.expenseStartDate);
    if (filters.expenseEndDate) params.set('expenseEnd', filters.expenseEndDate);

    const queryString = params.toString();
    const newUrl = queryString ? `/expenses?${queryString}` : '/expenses';

    // 현재 URL과 다를 때만 업데이트 (무한 루프 방지)
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [searchQuery, sortKey, sortDirection, currentPage, filters]);

  // 필터링/검색은 이제 서버에서 처리 — 응답을 그대로 사용
  const filteredExpenses = expenses;

  // 정렬은 이제 서버에서 처리 — 응답을 그대로 사용
  const sortedExpenses = filteredExpenses;

  // 정렬 토글 핸들러
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return (
        <svg className="w-4 h-4 ml-1 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // 페이지네이션 — 서버 응답을 그대로 사용
  const totalPages = serverPagination.totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + sortedExpenses.length;
  const paginatedExpenses = sortedExpenses;

  // 조회 결과 전체의 청구금액 합계 — 서버 aggregate 값
  const totalRequestAmount = serverAggregates.totalRequestAmount;

  // 필터/검색/정렬 변경 시 첫 페이지로 리셋 (페이지 자체 변경엔 반응 X)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, itemsPerPage, filters, sortKey, sortDirection]);

  // 모바일 표시 항목 (무한 스크롤은 2단계 후속 PR 에서 복원 — 임시로 페이지네이션 사용)
  const mobileVisibleExpenses = sortedExpenses;
  const hasMoreMobile = false;

  // 필터 옵션 — 서버 reference API 응답 사용
  const uniqueCommittees = filterOptions.committees;
  const uniqueDepartments = filterOptions.departments;
  const uniqueCategories = filterOptions.budgetCategories;

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
      status: '',
      paymentStatus: '',
      approvedStartDate: '',
      approvedEndDate: '',
      expenseStartDate: '',
      expenseEndDate: '',
    });
    setSearchQuery('');
  };

  const handleRowClick = (id: string) => {
    // 상세 페이지 이동 전 현재 URL 저장
    const currentUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem('expenseListReturnUrl', currentUrl);
    router.push(`/expenses/${id}`);
  };

  // 복제 핸들러
  const handleDuplicate = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses/${id}/duplicate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '복제에 실패했습니다.');
      }

      alert('지출결의서가 복제되었습니다.');
      const expense = expenses.find(e => e.id === id);
      router.push(getExpenseEditPath(data.expense.id, expense?.version));
    } catch (err) {
      alert(err instanceof Error ? err.message : '복제 중 오류가 발생했습니다.');
    }
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

  // 정렬 순서를 유지한 선택된 ID 목록 반환
  const getSortedSelectedIds = () => {
    return sortedExpenses
      .filter(e => selectedIds.has(e.id))
      .map(e => e.id);
  };

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
      const ids = getSortedSelectedIds().join(',');

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

    // 지급완료의 경우 모달 열기 (서명 선택)
    if (newStatus === 'COMPLETED') {
      setShowBulkPaymentModal(true);
      return;
    }

    // 지급대기의 경우 바로 처리
    const confirmed = confirm(`선택한 ${selectedIds.size}건을 지급대기로 변경하시겠습니까?\n\n※ 최종 승인된 항목만 변경됩니다.`);

    if (!confirmed) return;

    await processBulkPaymentStatus('PENDING');
  };

  // 일괄 지급완료 처리 (서명 + 지출일자 포함)
  const handleBulkPaymentComplete = async (
    signature?: { type: string; signatureId?: string; data?: string } | null,
    dateOptions?: { expenseDate: string | null; overwriteExisting: boolean }
  ) => {
    await processBulkPaymentStatus('COMPLETED', signature, dateOptions);
    setShowBulkPaymentModal(false);
  };

  // 실제 일괄 처리 로직
  const processBulkPaymentStatus = async (
    newStatus: 'PENDING' | 'COMPLETED',
    signature?: { type: string; signatureId?: string; data?: string } | null,
    dateOptions?: { expenseDate: string | null; overwriteExisting: boolean }
  ) => {
    try {
      setBulkProcessing(true);
      const response = await fetch('/api/expenses/bulk-payment-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: getSortedSelectedIds(),
          paymentStatus: newStatus,
          signature,
          expenseDate: dateOptions?.expenseDate,
          overwriteExisting: dateOptions?.overwriteExisting,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '일괄 변경에 실패했습니다.');
      }

      alert(data.message);

      // 목록 새로고침 및 선택 초기화
      refetch();
      setSelectedIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : '일괄 변경 중 오류가 발생했습니다.');
    } finally {
      setBulkProcessing(false);
    }
  };

  // 일괄 지출일자 설정 처리
  const handleBulkExpenseDateChange = async (expenseDate: string, overwriteExisting: boolean) => {
    try {
      setBulkProcessing(true);
      const response = await fetch('/api/expenses/bulk-expense-date', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: getSortedSelectedIds(),
          expenseDate,
          overwriteExisting,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '지출일자 변경에 실패했습니다.');
      }

      alert(data.message);

      // 목록 새로고침 및 선택 초기화
      refetch();
      setSelectedIds(new Set());
      setShowBulkExpenseDateModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '지출일자 변경 중 오류가 발생했습니다.');
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <GlobalShell title="지출결의서 목록">
        <div className="max-w-7xl mx-auto">
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
      </GlobalShell>
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
            onClick={refetch}
            className={BTN_PRIMARY}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <GlobalShell
      title="지출결의서 목록"
      actions={
        <button
          onClick={() => router.push('/expenses/new')}
          className={`${BTN_PRIMARY} hidden sm:flex items-center gap-2`}
        >
          + 신규 지출결의서 작성
        </button>
      }
    >
      <div className="max-w-7xl mx-auto">
        {/* 총 건수 */}
        <p className="mb-4 sm:mb-6 md:mb-8 text-sm sm:text-base text-gray-600">
          총 {serverPagination.total}건의 지출결의서
        </p>

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
                  {filters.status && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {filters.status === 'DRAFT' ? '임시저장' :
                       filters.status === 'PENDING' ? '결재대기' :
                       filters.status === 'APPROVED_STEP_1' ? '1차승인' :
                       filters.status === 'APPROVED_STEP_2' ? '2차승인' :
                       filters.status === 'APPROVED_FINAL' ? '최종승인' :
                       filters.status === 'REJECTED' ? '반려' : '회수'}
                      <button onClick={() => handleFilterChange('status', '')} className="hover:text-blue-900">×</button>
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
                  placeholder={`청구인, ${terms.committee}, ${terms.department}, 예산항목 검색...`}
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
                      {terms.committee}
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
                      {terms.departmentFull}
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
                      결재상태
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    >
                      <option value="">전체</option>
                      <option value="DRAFT">임시저장</option>
                      <option value="PENDING">결재대기</option>
                      <option value="APPROVED_STEP_1">1차승인</option>
                      <option value="APPROVED_STEP_2">2차승인</option>
                      <option value="APPROVED_FINAL">최종승인</option>
                      <option value="REJECTED">반려</option>
                      <option value="WITHDRAWN">회수</option>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      최종승인일 범위
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={filters.approvedStartDate}
                        onChange={(e) => handleFilterChange('approvedStartDate', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                      />
                      <span className="text-gray-500">~</span>
                      <input
                        type="date"
                        value={filters.approvedEndDate}
                        onChange={(e) => handleFilterChange('approvedEndDate', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지급일자 범위
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={filters.expenseStartDate}
                        onChange={(e) => handleFilterChange('expenseStartDate', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                      />
                      <span className="text-gray-500">~</span>
                      <input
                        type="date"
                        value={filters.expenseEndDate}
                        onChange={(e) => handleFilterChange('expenseEndDate', e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
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
                  <button
                    onClick={() => setShowBulkExpenseDateModal(true)}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        일괄 지출일자
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
                  const ids = getSortedSelectedIds().join(',');
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
              {/* 일괄 인쇄 버튼 */}
              <button
                onClick={() => setShowBulkPrintModal(true)}
                disabled={exporting || bulkProcessing}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                일괄 인쇄
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
              {mobileVisibleExpenses.length} / {serverPagination.total}건
            </span>
          </div>

          {/* 카드 목록 - 무한 스크롤 */}
          {sortedExpenses.length === 0 ? (
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
                  onDuplicate={handleDuplicate}
                  userRole={currentUser?.role}
                />
              ))}
              {/* 무한 스크롤 로딩 인디케이터 */}
              <LoadMoreIndicator
                isLoading={false}
                hasMore={hasMoreMobile}
                loadMoreRef={loadMoreRef}
              />
              {/* 조회 결과 합계 카드 */}
              <div className="mt-2 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    합계 ({serverAggregates.totalCount}건)
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatCurrency(totalRequestAmount)}
                  </span>
                </div>
              </div>
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
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('requestDate')}
                  >
                    <div className="flex items-center">
                      신청일자
                      {renderSortIcon('requestDate')}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('applicantName')}
                  >
                    <div className="flex items-center">
                      청구인
                      {renderSortIcon('applicantName')}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('committee')}
                  >
                    <div className="flex flex-col text-xs leading-tight">
                      <span>{terms.committee}</span>
                      <span>{terms.department}</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    {/* 예산 컬럼 정렬은 ExpenseItem 관계 정렬이 Prisma orderBy로 불가능해 비활성화 (2단계 spec 참조) */}
                    <div className="flex flex-col gap-0.5">
                      <div className="px-1 py-0.5 select-none whitespace-nowrap">예산(항)</div>
                      <div className="px-1 py-0.5 select-none text-blue-200 whitespace-nowrap">예산(목)</div>
                      <div className="px-1 py-0.5 select-none text-blue-300 whitespace-nowrap">예산(세목)</div>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    적요
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                    첨부
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('requestAmount')}
                  >
                    <div className="flex items-center justify-end">
                      청구금액
                      {renderSortIcon('requestAmount')}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center">
                      결재상태
                      {renderSortIcon('status')}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('approvedAt')}
                  >
                    <div className="flex items-center justify-center">
                      최종승인일
                      {renderSortIcon('approvedAt')}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('expenseDate')}
                  >
                    <div className="flex items-center justify-center">
                      지급일자
                      {renderSortIcon('expenseDate')}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-blue-600 transition-colors select-none"
                    onClick={() => handleSort('paymentStatus')}
                  >
                    <div className="flex items-center justify-center">
                      지급상태
                      {renderSortIcon('paymentStatus')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? '검색 결과가 없습니다.' : '등록된 지출결의서가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(expense.id)}
                          onChange={(e) => handleSelectOne(expense.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap text-sm text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.applicantName}
                      </td>
                      <td
                        className="px-3 py-3 text-sm text-gray-700"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        <div className="flex flex-col text-xs leading-tight">
                          <span className="font-medium text-gray-900">{expense.committee}</span>
                          <span className="text-gray-500">{expense.department}</span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 text-sm text-gray-700"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        <div className="flex flex-col text-xs leading-tight">
                          <span className="font-medium text-gray-900">{expense.items?.[0]?.budgetCategory || '-'}</span>
                          <span className="text-gray-700">{expense.items?.[0]?.budgetSubcategory || '-'}</span>
                          <span className="text-gray-500">{expense.items?.[0]?.budgetDetail || '-'}</span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 text-sm text-gray-700"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        <span className="block max-w-[180px] line-clamp-2 text-xs">
                          {expense.items?.[0]?.description || '-'}
                        </span>
                      </td>
                      <td
                        className="px-2 py-3 text-center"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.attachments && expense.attachments.length > 0 ? (
                          <Image
                            src={expense.attachments[0].secureUrl}
                            alt="첨부파일"
                            width={28}
                            height={28}
                            className="object-cover rounded border border-gray-200 mx-auto"
                          />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {formatCurrency(expense.requestAmount)}
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap text-sm text-center"
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
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.approvedAt
                          ? format(new Date(expense.approvedAt), 'yyyy-MM-dd')
                          : '-'}
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-900"
                        onClick={() => handleRowClick(expense.id)}
                      >
                        {expense.expenseDate
                          ? format(new Date(expense.expenseDate), 'yyyy-MM-dd')
                          : '-'}
                      </td>
                      <td
                        className="px-3 py-3 whitespace-nowrap text-sm text-center"
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
                {serverAggregates.totalCount > 0 && (
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                    <td colSpan={7} className="px-3 py-3 text-right text-sm text-gray-700">
                      합계 ({serverAggregates.totalCount}건)
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm text-blue-700">
                      {formatCurrency(totalRequestAmount)}
                    </td>
                    <td colSpan={4} />
                  </tr>
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
                {Math.min(endIndex, serverPagination.total)}
              </span>
              {' / '}
              <span className="font-medium">{serverPagination.total}</span>
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

      {/* 일괄 지급완료 모달 */}
      <BulkPaymentStatusModal
        isOpen={showBulkPaymentModal}
        onClose={() => setShowBulkPaymentModal(false)}
        onConfirm={handleBulkPaymentComplete}
        selectedCount={selectedIds.size}
        isProcessing={bulkProcessing}
      />

      {/* 일괄 지출일자 설정 모달 */}
      <BulkExpenseDateModal
        isOpen={showBulkExpenseDateModal}
        onClose={() => setShowBulkExpenseDateModal(false)}
        onConfirm={handleBulkExpenseDateChange}
        selectedCount={selectedIds.size}
        isProcessing={bulkProcessing}
      />

      {/* 일괄 인쇄 모달 */}
      <BulkPrintModal
        isOpen={showBulkPrintModal}
        onClose={() => setShowBulkPrintModal(false)}
        selectedIds={getSortedSelectedIds()}
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
    </GlobalShell>
  );
}

// Suspense 래퍼 컴포넌트 (useSearchParams 사용을 위해 필요)
export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <GlobalShell title="지출결의서 목록">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <FilterSkeleton />
          <div className="md:hidden mt-4">
            <ExpenseListSkeleton count={5} />
          </div>
          <div className="hidden md:block mt-4">
            <TableSkeleton rows={10} columns={8} />
          </div>
        </div>
      </GlobalShell>
    }>
      <ExpensesPageContent />
    </Suspense>
  );
}
