'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingIndicatorProps {
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// 기본 로딩 인디케이터
export function LoadingIndicator({
  text = '로딩 중...',
  className,
  size = 'md'
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center justify-center gap-2 py-4', className)}>
      <Loader2 className={cn('animate-spin text-blue-500', sizeClasses[size])} />
      <span className="text-gray-500">{text}</span>
    </div>
  );
}

// 더 불러오기 인디케이터 (무한 스크롤용)
export function LoadMoreIndicator({
  isLoading,
  hasMore,
  loadMoreRef,
}: {
  isLoading: boolean;
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!hasMore) {
    return (
      <div className="py-6 text-center text-gray-400 text-sm">
        모든 항목을 불러왔습니다
      </div>
    );
  }

  return (
    <div ref={loadMoreRef} className="py-6">
      {isLoading ? (
        <LoadingIndicator text="더 불러오는 중..." size="sm" />
      ) : (
        <div className="text-center text-gray-400 text-sm">
          스크롤하여 더 보기
        </div>
      )}
    </div>
  );
}

// 전체 페이지 로딩
export function PageLoading({ text = '페이지 로딩 중...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">{text}</p>
      </div>
    </div>
  );
}

// 섹션 로딩
export function SectionLoading({ text = '로딩 중...' }: { text?: string }) {
  return (
    <div className="py-12 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
      <p className="text-gray-500 text-sm">{text}</p>
    </div>
  );
}

// 버튼 로딩 상태
export function ButtonLoading({ text = '처리 중...' }: { text?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{text}</span>
    </span>
  );
}

// 풀 투 리프레시 인디케이터 (모바일용)
export function PullToRefreshIndicator({
  isRefreshing,
  pullProgress = 0,
}: {
  isRefreshing: boolean;
  pullProgress?: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center py-4 transition-opacity',
        pullProgress > 0 || isRefreshing ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 border-3 border-blue-500 rounded-full',
          isRefreshing ? 'animate-spin border-t-transparent' : ''
        )}
        style={{
          transform: isRefreshing ? 'none' : `rotate(${pullProgress * 360}deg)`,
        }}
      />
    </div>
  );
}

// 에러 상태
export function ErrorIndicator({
  message = '오류가 발생했습니다',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-gray-600 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

// 빈 상태
export function EmptyIndicator({
  title = '데이터가 없습니다',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-gray-500 text-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
