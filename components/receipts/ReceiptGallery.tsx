'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { MODAL_OVERLAY } from '@/lib/constants/styles';
import ExpenseStatusPill from './ExpenseStatusPill';

export interface ReceiptItem {
  id: string;
  url: string;
  secureUrl: string;
  fileName: string;
  format: string;
  expenseId: string;
  department: string;
  committee: string;
  requestAmount: number;
  status: string;
  applicantName: string;
  requestDate: string;
}

interface ReceiptGalleryProps {
  receipts: ReceiptItem[];
}

export default function ReceiptGallery({ receipts }: ReceiptGalleryProps) {
  const [selected, setSelected] = useState<ReceiptItem | null>(null);

  if (receipts.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">해당 조건의 영수증이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {receipts.map((receipt) => (
          <button
            key={receipt.id}
            type="button"
            onClick={() => setSelected(receipt)}
            className="text-left border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative w-full h-32 bg-gray-100">
              <Image
                src={receipt.url}
                alt={receipt.fileName}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </div>
            <div className="p-2 space-y-1">
              <p className="text-xs font-medium text-gray-900 truncate">{receipt.department}</p>
              <p className="text-xs text-gray-600">{formatCurrency(receipt.requestAmount)}</p>
              <p className="text-xs text-gray-400 truncate" title={receipt.expenseId}>
                결의번호 {receipt.expenseId.slice(0, 8)}
              </p>
              <ExpenseStatusPill status={receipt.status} />
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className={MODAL_OVERLAY} onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-medium text-gray-900">{selected.department}</p>
                <p className="text-sm text-gray-500">
                  {selected.applicantName} · {formatDateShort(selected.requestDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative flex-1 min-h-0 bg-gray-100 overflow-y-auto">
              <div className="relative w-full h-[60vh]">
                <Image
                  src={selected.url}
                  alt={selected.fileName}
                  fill
                  className="object-contain"
                  sizes="100vw"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <span className="text-sm text-gray-600">{formatCurrency(selected.requestAmount)}</span>
              <a
                href={selected.secureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                원본 열기
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
