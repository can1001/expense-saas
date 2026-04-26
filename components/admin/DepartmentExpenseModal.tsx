'use client';

import { useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink, Building2, ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import {
  MODAL_OVERLAY,
  MODAL_CONTAINER,
  MODAL_HEADER,
  MODAL_BODY,
  MODAL_FOOTER,
  BTN_OUTLINE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  TABLE_CELL_RIGHT,
  SPINNER_MD,
} from '@/lib/constants/styles';

interface DetailData {
  detail: string;
  amount: number;
  count: number;
}

interface SubcategoryData {
  subcategory: string;
  amount: number;
  count: number;
  details: DetailData[];
}

interface CategoryData {
  category: string;
  amount: number;
  count: number;
  subcategories: SubcategoryData[];
}

interface ExpenseItem {
  description: string;
  amount: number;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
}

interface ExpenseData {
  id: string;
  requestDate: string;
  applicantName: string;
  paymentStatus: string;
  items: ExpenseItem[];
}

export interface DepartmentExpenseData {
  categoryBreakdown: CategoryData[];
  expenses: ExpenseData[];
  summary: {
    totalCount: number;
    totalAmount: number;
  };
  filterInfo: {
    year: number;
    toQuarter: number;
    committee: string;
    department: string;
  };
}

interface DepartmentInfo {
  committee: string;
  department: string;
}

interface DepartmentExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: DepartmentExpenseData | null;
  departmentInfo: DepartmentInfo | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

function getPaymentStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: '지급대기',
    HOLD: '지급보류',
    CANCELLED: '지급취소',
    COMPLETED: '지급완료',
  };
  return statusMap[status] || status;
}

function getPaymentStatusClass(status: string): string {
  const classMap: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    HOLD: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-green-100 text-green-800',
  };
  return classMap[status] || 'bg-gray-100 text-gray-800';
}

export function DepartmentExpenseModal({
  isOpen,
  onClose,
  loading,
  data,
  departmentInfo,
}: DepartmentExpenseModalProps) {
  // 펼침/접힘 상태 관리
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [selectedDetail, setSelectedDetail] = useState<{
    category: string;
    subcategory: string;
    detail: string;
  } | null>(null);

  // ESC 키로 모달 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDetail) {
          setSelectedDetail(null);
        } else {
          onClose();
        }
      }
    },
    [onClose, selectedDetail]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // 모달 열릴 때 펼침 상태 초기화
      setExpandedCategories(new Set());
      setExpandedSubcategories(new Set());
      setSelectedDetail(null);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // 배경 클릭 시 모달 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleSubcategory = (key: string) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDetailDoubleClick = (category: string, subcategory: string, detail: string) => {
    setSelectedDetail({ category, subcategory, detail });
  };

  // 선택된 세목의 지출 내역 필터링
  const filteredExpenses = selectedDetail
    ? data?.expenses
        .map((expense) => ({
          ...expense,
          items: expense.items.filter(
            (item) =>
              item.budgetCategory === selectedDetail.category &&
              item.budgetSubcategory === selectedDetail.subcategory &&
              item.budgetDetail === selectedDetail.detail
          ),
        }))
        .filter((expense) => expense.items.length > 0) || []
    : [];

  if (!isOpen) return null;

  return (
    <div className={MODAL_OVERLAY} onClick={handleBackdropClick}>
      <div className={`${MODAL_CONTAINER} w-full max-w-5xl max-h-[85vh] flex flex-col`}>
        {/* 헤더 */}
        <div className={MODAL_HEADER}>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              {departmentInfo?.department || '-'} 세목별 지출 현황
            </h2>
            {data && (
              <p className="text-sm text-gray-500 mt-1">
                {data.filterInfo.committee} &gt; {data.filterInfo.department} |{' '}
                {data.filterInfo.year}년 1~{data.filterInfo.toQuarter}분기 누적
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className={`${MODAL_BODY} flex-1 overflow-y-auto`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={SPINNER_MD} />
              <p className="text-gray-500 mt-4">데이터를 불러오는 중...</p>
            </div>
          ) : !data || data.categoryBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">해당 부서의 지출 내역이 없습니다.</p>
            </div>
          ) : selectedDetail ? (
            // 세목 상세 내역 보기
            <>
              {/* 뒤로가기 */}
              <button
                onClick={() => setSelectedDetail(null)}
                className="mb-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                계층 구조로 돌아가기
              </button>

              {/* 세목 정보 */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-blue-600 mb-1">
                  {selectedDetail.category} &gt; {selectedDetail.subcategory}
                </div>
                <div className="text-lg font-bold text-blue-800">{selectedDetail.detail}</div>
              </div>

              {/* 상세 테이블 */}
              <div className="overflow-x-auto border rounded-lg">
                <table className={TABLE_BASE}>
                  <thead className={TABLE_HEADER}>
                    <tr>
                      <th className={TABLE_HEADER_CELL} style={{ width: '12%' }}>
                        청구일
                      </th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '12%' }}>
                        신청자
                      </th>
                      <th className={TABLE_HEADER_CELL}>적요</th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '15%' }}>
                        금액
                      </th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '10%' }}>
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {filteredExpenses.map((expense) =>
                      expense.items.map((item, itemIdx) => (
                        <tr key={`${expense.id}-${itemIdx}`} className="hover:bg-gray-50">
                          <td className={TABLE_CELL}>{expense.requestDate}</td>
                          <td className={TABLE_CELL}>
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              onClick={onClose}
                            >
                              {expense.applicantName}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className={TABLE_CELL}>{item.description}</td>
                          <td className={TABLE_CELL_RIGHT}>{formatAmount(item.amount)}</td>
                          <td className={TABLE_CELL}>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusClass(
                                expense.paymentStatus
                              )}`}
                            >
                              {getPaymentStatusText(expense.paymentStatus)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // 계층 구조 보기
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-600 mb-1">총 건수</div>
                  <div className="text-2xl font-bold text-blue-800">
                    {data.summary.totalCount}건
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 mb-1">합계 금액</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatAmount(data.summary.totalAmount)}
                  </div>
                </div>
              </div>

              {/* 계층 구조 테이블 */}
              <div className="border rounded-lg overflow-hidden">
                <table className={TABLE_BASE}>
                  <thead className={TABLE_HEADER}>
                    <tr>
                      <th className={TABLE_HEADER_CELL}>항 / 목 / 세목</th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '12%' }}>
                        건수
                      </th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '20%' }}>
                        금액
                      </th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {data.categoryBreakdown.map((category) => {
                      const isCategoryExpanded = expandedCategories.has(category.category);

                      return (
                        <>
                          {/* 항 행 */}
                          <tr
                            key={`cat-${category.category}`}
                            className="bg-indigo-50 cursor-pointer hover:bg-indigo-100"
                            onClick={() => toggleCategory(category.category)}
                          >
                            <td className="py-3 px-4 font-bold text-gray-900">
                              <div className="flex items-center gap-2">
                                {isCategoryExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                {category.category}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">
                              {category.count}건
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-gray-900">
                              {formatAmount(category.amount)}
                            </td>
                          </tr>

                          {/* 목 행들 */}
                          {isCategoryExpanded &&
                            category.subcategories.map((subcategory) => {
                              const subcategoryKey = `${category.category}|${subcategory.subcategory}`;
                              const isSubcategoryExpanded =
                                expandedSubcategories.has(subcategoryKey);

                              return (
                                <>
                                  <tr
                                    key={`sub-${subcategoryKey}`}
                                    className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                                    onClick={() => toggleSubcategory(subcategoryKey)}
                                  >
                                    <td className="py-2 px-4 pl-10 text-gray-700">
                                      <div className="flex items-center gap-2">
                                        {isSubcategoryExpanded ? (
                                          <ChevronDown className="w-4 h-4" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4" />
                                        )}
                                        {subcategory.subcategory}
                                      </div>
                                    </td>
                                    <td className="py-2 px-4 text-right text-gray-700">
                                      {subcategory.count}건
                                    </td>
                                    <td className="py-2 px-4 text-right text-gray-700">
                                      {formatAmount(subcategory.amount)}
                                    </td>
                                  </tr>

                                  {/* 세목 행들 */}
                                  {isSubcategoryExpanded &&
                                    subcategory.details.map((detail) => (
                                      <tr
                                        key={`detail-${subcategoryKey}-${detail.detail}`}
                                        className="hover:bg-blue-50 cursor-pointer"
                                        onDoubleClick={() =>
                                          handleDetailDoubleClick(
                                            category.category,
                                            subcategory.subcategory,
                                            detail.detail
                                          )
                                        }
                                        title="더블클릭하여 상세 내역 보기"
                                      >
                                        <td className="py-2 px-4 pl-16 text-gray-600">
                                          {detail.detail}
                                        </td>
                                        <td className="py-2 px-4 text-right text-gray-600">
                                          {detail.count}건
                                        </td>
                                        <td className="py-2 px-4 text-right text-gray-600">
                                          {formatAmount(detail.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                </>
                              );
                            })}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400 mt-3 text-center">
                세목을 더블클릭하면 개별 지출 내역을 확인할 수 있습니다.
              </p>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className={MODAL_FOOTER}>
          <button type="button" onClick={onClose} className={BTN_OUTLINE}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default DepartmentExpenseModal;
