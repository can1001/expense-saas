'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Send,
  ThumbsUp,
  ThumbsDown,
  Undo2,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface NotificationLog {
  id: string;
  eventType: string;
  title: string;
  body: string;
  url: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  expense: {
    id: string;
    applicantName: string;
    requestAmount: number;
    status: string;
  } | null;
}

interface HistoryResponse {
  data: NotificationLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  SUBMIT: { label: '결재 요청', icon: Send, color: 'text-blue-600 bg-blue-100' },
  APPROVE: { label: '승인', icon: ThumbsUp, color: 'text-green-600 bg-green-100' },
  REJECT: { label: '반려', icon: ThumbsDown, color: 'text-red-600 bg-red-100' },
  WITHDRAW: { label: '회수', icon: Undo2, color: 'text-orange-600 bg-orange-100' },
  PAYMENT_COMPLETE: { label: '지급 완료', icon: Wallet, color: 'text-purple-600 bg-purple-100' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  PENDING: { label: '대기', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  SENT: { label: '발송 완료', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  FAILED: { label: '발송 실패', icon: XCircle, color: 'text-red-600 bg-red-100' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationHistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 필터 상태
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (eventTypeFilter) params.set('eventType', eventTypeFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/push/history?${params}`);

      if (!response.ok) {
        throw new Error('알림 히스토리를 불러오는데 실패했습니다.');
      }

      const data: HistoryResponse = await response.json();
      setLogs(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, eventTypeFilter, statusFilter]);

  const handleExpenseClick = (expenseId: string) => {
    router.push(`/expenses/${expenseId}`);
  };

  const clearFilters = () => {
    setEventTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = eventTypeFilter || statusFilter;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex-1">알림 히스토리</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              hasActiveFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
          <button
            onClick={fetchHistory}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <div className="border-t bg-gray-50 px-4 py-3">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">이벤트 유형</label>
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => {
                      setEventTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="">전체</option>
                    <option value="SUBMIT">결재 요청</option>
                    <option value="APPROVE">승인</option>
                    <option value="REJECT">반려</option>
                    <option value="WITHDRAW">회수</option>
                    <option value="PAYMENT_COMPLETE">지급 완료</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">발송 상태</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="">전체</option>
                    <option value="SENT">발송 완료</option>
                    <option value="FAILED">발송 실패</option>
                    <option value="PENDING">대기</option>
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:underline"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* 총 개수 */}
        <div className="text-sm text-gray-500 mb-3">
          총 {total}개의 알림
        </div>

        {/* 에러 상태 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && logs.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">알림 기록이 없습니다.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}

        {/* 알림 목록 */}
        {!loading && logs.length > 0 && (
          <div className="space-y-2">
            {logs.map((log) => {
              const eventConfig = EVENT_TYPE_CONFIG[log.eventType] || {
                label: log.eventType,
                icon: Bell,
                color: 'text-gray-600 bg-gray-100',
              };
              const statusConfig = STATUS_CONFIG[log.status] || {
                label: log.status,
                icon: Clock,
                color: 'text-gray-600 bg-gray-100',
              };
              const EventIcon = eventConfig.icon;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* 이벤트 아이콘 */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${eventConfig.color}`}
                    >
                      <EventIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 이벤트 타입 & 상태 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{eventConfig.label}</span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusConfig.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* 제목 */}
                      {log.expense ? (
                        <button
                          onClick={() => handleExpenseClick(log.expense!.id)}
                          className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline text-left"
                        >
                          {log.title}
                        </button>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.title}
                        </p>
                      )}

                      {/* 본문 */}
                      {log.expense ? (
                        <button
                          onClick={() => handleExpenseClick(log.expense!.id)}
                          className="text-sm text-gray-600 line-clamp-2 mt-0.5 hover:text-blue-600 hover:underline text-left"
                        >
                          {log.body}
                        </button>
                      ) : (
                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                          {log.body}
                        </p>
                      )}

                      {/* 에러 메시지 */}
                      {log.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">
                          {log.errorMessage}
                        </p>
                      )}

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{formatRelativeTime(log.createdAt)}</span>
                        {log.expense && (
                          <button
                            onClick={() => handleExpenseClick(log.expense!.id)}
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            {log.expense.applicantName} ·{' '}
                            {log.expense.requestAmount.toLocaleString()}원
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
