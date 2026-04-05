'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';
import { useSwipeable } from 'react-swipeable';
import { ExpenseListItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Eye, Edit, ChevronLeft } from 'lucide-react';

interface ExpenseCardProps {
  expense: ExpenseListItem;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: (id: string) => void;
}

// 결재 상태 배지 컴포넌트
function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', label: '임시저장' },
    PENDING: { bg: 'bg-blue-100', text: 'text-blue-700', label: '결재대기' },
    APPROVED_STEP_1: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: '1차승인' },
    APPROVED_STEP_2: { bg: 'bg-purple-100', text: 'text-purple-700', label: '2차승인' },
    APPROVED_FINAL: { bg: 'bg-green-100', text: 'text-green-700', label: '최종승인' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: '반려' },
    WITHDRAWN: { bg: 'bg-orange-100', text: 'text-orange-700', label: '회수' },
  };

  const { bg, text, label } = (status && config[status]) || { bg: 'bg-gray-100', text: 'text-gray-500', label: '-' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// 지급 상태 배지 컴포넌트
function PaymentStatusBadge({ status, paymentStatus }: { status?: string; paymentStatus?: string }) {
  if (status !== 'APPROVED_FINAL') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        -
      </span>
    );
  }

  const config: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-800', label: '지급대기' },
    HOLD: { bg: 'bg-orange-100', text: 'text-orange-800', label: '지급보류' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: '지급취소' },
    COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: '지급완료' },
  };

  const { bg, text, label } = config[paymentStatus || 'PENDING'] || config.PENDING;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// 스와이프 힌트 표시 (처음 로드 시 한 번만)
function SwipeHint({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 text-xs animate-pulse">
      <ChevronLeft className="w-4 h-4" />
      <span>스와이프</span>
    </div>
  );
}

export default function ExpenseCard({ expense, isSelected, onSelect, onClick }: ExpenseCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 140; // 액션 버튼 영역 너비
  const SWIPE_THRESHOLD = 50; // 스와이프 인식 임계값

  const handlers = useSwipeable({
    onSwiping: (e) => {
      // 힌트 숨기기
      if (showHint) setShowHint(false);

      // 왼쪽 스와이프만 허용
      if (e.dir === 'Left') {
        const newX = Math.max(-ACTION_WIDTH, Math.min(0, -e.deltaX));
        setTranslateX(newX);
      } else if (e.dir === 'Right' && isOpen) {
        const newX = Math.min(0, -ACTION_WIDTH + e.deltaX);
        setTranslateX(newX);
      }
    },
    onSwipedLeft: (e) => {
      if (e.deltaX > SWIPE_THRESHOLD) {
        setIsOpen(true);
        setTranslateX(-ACTION_WIDTH);
      } else {
        setIsOpen(false);
        setTranslateX(0);
      }
    },
    onSwipedRight: () => {
      setIsOpen(false);
      setTranslateX(0);
    },
    onTap: () => {
      if (isOpen) {
        setIsOpen(false);
        setTranslateX(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: false,
    delta: 10,
  });

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/expenses/${expense.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 간편 지출결의서(4.1.4)는 simple 수정 경로로 이동
    if (expense.version === '4.1.4') {
      router.push(`/expenses/simple/${expense.id}/edit`);
    } else {
      router.push(`/expenses/${expense.id}/edit`);
    }
  };

  // 수정 가능 여부 체크
  // 기본: 임시저장, 반려, 회수 상태
  // 추가: 최종승인 + 지급대기 상태
  const basicEditable = ['DRAFT', 'REJECTED', 'WITHDRAWN'].includes(expense.status || '');
  const approvedPending = expense.status === 'APPROVED_FINAL' && expense.paymentStatus === 'PENDING';
  const canEdit = basicEditable || approvedPending;

  return (
    <div className="relative overflow-hidden rounded-lg" ref={cardRef}>
      {/* 스와이프 액션 버튼 (뒤에 숨겨진 영역) */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          onClick={handleViewDetail}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          <Eye className="w-5 h-5" />
          <span className="text-xs font-medium">상세</span>
        </button>
        {canEdit && (
          <button
            onClick={handleEdit}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <Edit className="w-5 h-5" />
            <span className="text-xs font-medium">수정</span>
          </button>
        )}
      </div>

      {/* 카드 본체 (스와이프로 움직이는 부분) */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: translateX === 0 || translateX === -ACTION_WIDTH ? 'transform 0.2s ease-out' : 'none',
        }}
        className={`relative bg-white border p-4 ${
          isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'
        }`}
      >
        {/* 스와이프 힌트 */}
        <SwipeHint show={showHint && !isOpen && translateX === 0} />

        {/* 상단: 체크박스 + 날짜 + 상태 배지 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(expense.id, e.target.checked);
              }}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">
              {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={expense.status} />
            {expense.approvedAt && (
              <span className="text-xs text-gray-500">
                ({format(new Date(expense.approvedAt), 'MM-dd')})
              </span>
            )}
          </div>
        </div>

        {/* 클릭 가능 영역 */}
        <div
          onClick={() => {
            if (!isOpen) {
              onClick(expense.id);
            } else {
              setIsOpen(false);
              setTranslateX(0);
            }
          }}
          className="cursor-pointer"
        >
          {/* 청구인 + 썸네일 + 위원회/사역팀 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{expense.applicantName}</span>
              {expense.attachments && expense.attachments.length > 0 && (
                <Image
                  src={expense.attachments[0].secureUrl}
                  alt="첨부"
                  width={24}
                  height={24}
                  className="object-cover rounded border border-gray-200"
                />
              )}
            </div>
            <div className="text-right text-xs">
              <div className="text-gray-700">{expense.committee}</div>
              <div className="text-gray-500">{expense.department}</div>
            </div>
          </div>

          {/* 예산 정보 (첫 번째 항목 기준) */}
          <div className="text-sm mb-3">
            {/* 항 > 목 > 세목 */}
            <p className="text-xs text-gray-700 truncate">
              <span className="font-medium">{expense.items?.[0]?.budgetCategory || '-'}</span>
              {' > '}
              <span>{expense.items?.[0]?.budgetSubcategory || '-'}</span>
              {' > '}
              <span className="text-gray-600">{expense.items?.[0]?.budgetDetail || '-'}</span>
            </p>
            {/* 적요 */}
            <p className="text-xs text-gray-500 mt-1 truncate">
              {expense.items?.[0]?.description || '-'}
            </p>
          </div>

          {/* 하단: 금액 + 지출상태 */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(expense.requestAmount)}
            </span>
            <PaymentStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}
