'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  badge?: ReactNode;
}

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  className,
  badge,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border border-gray-200 rounded-lg bg-white overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 text-left bg-white hover:bg-gray-50 transition-colors min-h-[56px]"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{title}</span>
          {badge}
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}

// 간단한 정보 표시용 컴포넌트
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-gray-900 font-medium">{value || '-'}</dd>
    </div>
  );
}

// 모바일 아이템 카드 (테이블 대신 사용)
export function MobileItemCard({
  order,
  budgetDetail,
  description,
  unitPrice,
  quantity,
  amount,
}: {
  order?: number;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-start justify-between mb-2">
        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
          {order ?? '-'}
        </span>
        <span className="text-lg font-bold text-gray-900">
          {amount.toLocaleString('ko-KR')}원
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-gray-900 font-medium">{budgetDetail}</p>
        <p className="text-gray-600">{description}</p>
        <p className="text-gray-500">
          {unitPrice.toLocaleString('ko-KR')}원 x {quantity}
        </p>
      </div>
    </div>
  );
}
