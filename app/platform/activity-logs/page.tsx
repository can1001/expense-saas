'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Activity,
  Search,
  Filter,
  Calendar,
  Building2,
  User,
  Settings,
  Trash2,
  Plus,
  Edit,
  Play,
  Pause,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  superAdminId: string;
  superAdminEmail: string;
  tenantId: string | null;
  tenantName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  byAction: Record<string, number>;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_TENANT: '테넌트 생성',
  UPDATE_TENANT: '테넌트 수정',
  DELETE_TENANT: '테넌트 삭제',
  SUSPEND_TENANT: '테넌트 일시중지',
  ACTIVATE_TENANT: '테넌트 활성화',
  UPDATE_TENANT_SETTINGS: '테넌트 설정 변경',
  CREATE_USER: '사용자 생성',
  UPDATE_USER: '사용자 수정',
  DELETE_USER: '사용자 삭제',
  ACTIVATE_USER: '사용자 활성화',
  DEACTIVATE_USER: '사용자 비활성화',
  VIEW_TENANT: '테넌트 조회',
  VIEW_STATS: '통계 조회',
  EXPORT_DATA: '데이터 내보내기',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE_TENANT: <Plus className="w-4 h-4" />,
  UPDATE_TENANT: <Edit className="w-4 h-4" />,
  DELETE_TENANT: <Trash2 className="w-4 h-4" />,
  SUSPEND_TENANT: <Pause className="w-4 h-4" />,
  ACTIVATE_TENANT: <Play className="w-4 h-4" />,
  UPDATE_TENANT_SETTINGS: <Settings className="w-4 h-4" />,
  CREATE_USER: <Plus className="w-4 h-4" />,
  UPDATE_USER: <Edit className="w-4 h-4" />,
  DELETE_USER: <Trash2 className="w-4 h-4" />,
  ACTIVATE_USER: <Play className="w-4 h-4" />,
  DEACTIVATE_USER: <Pause className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE_TENANT: 'bg-green-100 text-green-700',
  UPDATE_TENANT: 'bg-blue-100 text-blue-700',
  DELETE_TENANT: 'bg-red-100 text-red-700',
  SUSPEND_TENANT: 'bg-yellow-100 text-yellow-700',
  ACTIVATE_TENANT: 'bg-emerald-100 text-emerald-700',
  UPDATE_TENANT_SETTINGS: 'bg-purple-100 text-purple-700',
  CREATE_USER: 'bg-green-100 text-green-700',
  UPDATE_USER: 'bg-blue-100 text-blue-700',
  DELETE_USER: 'bg-red-100 text-red-700',
  ACTIVATE_USER: 'bg-emerald-100 text-emerald-700',
  DEACTIVATE_USER: 'bg-orange-100 text-orange-700',
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 필터 상태
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // 상세 보기 모달
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/platform/activity-logs?${params}`);
      if (!response.ok) throw new Error('활동 로그 조회 실패');

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, entityTypeFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
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
    return formatDate(dateString);
  };

  const resetFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityTypeFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/platform/dashboard"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">활동 로그</h1>
            <p className="text-sm text-gray-500">플랫폼 관리자 활동 기록</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.byAction)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([action, count]) => (
              <div
                key={action}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${ACTION_COLORS[action] || 'bg-gray-100 text-gray-700'}`}>
                    {ACTION_ICONS[action] || <Activity className="w-4 h-4" />}
                  </div>
                  <span className="text-sm text-gray-600">
                    {ACTION_LABELS[action] || action}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            ))}
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="이메일, 테넌트명, ID 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* 필터 토글 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            필터
            {(actionFilter || entityTypeFilter || startDate || endDate) && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            )}
          </button>
        </div>

        {/* 필터 확장 영역 */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 액션 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                액션
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 엔티티 타입 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                대상 유형
              </label>
              <select
                value={entityTypeFilter}
                onChange={(e) => {
                  setEntityTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                <option value="tenant">테넌트</option>
                <option value="user">사용자</option>
                <option value="settings">설정</option>
              </select>
            </div>

            {/* 시작일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 종료일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 필터 초기화 */}
            <div className="md:col-span-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                필터 초기화
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 로그 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            로딩 중...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>활동 로그가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start gap-4">
                  {/* 액션 아이콘 */}
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 ${
                      ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ACTION_ICONS[log.action] || <Activity className="w-5 h-5" />}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.tenantName && (
                        <>
                          <span className="text-gray-400">-</span>
                          <Link
                            href={`/platform/tenants/${log.tenantId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            {log.tenantName}
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {log.superAdminEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatRelativeTime(log.createdAt)}
                      </span>
                      {log.ipAddress && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5" />
                          {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 시간 */}
                  <div className="text-sm text-gray-400 flex-shrink-0">
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              전체 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}건
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 상세 보기 모달 */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    ACTION_COLORS[selectedLog.action] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ACTION_ICONS[selectedLog.action] || <Activity className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                  </h2>
                  <p className="text-sm text-gray-500">{formatDate(selectedLog.createdAt)}</p>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">수행자</label>
                  <p className="font-medium">{selectedLog.superAdminEmail}</p>
                </div>
                {selectedLog.tenantName && (
                  <div>
                    <label className="text-sm text-gray-500">대상 테넌트</label>
                    <p className="font-medium">{selectedLog.tenantName}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-500">엔티티 유형</label>
                  <p className="font-medium">{selectedLog.entityType}</p>
                </div>
                {selectedLog.entityId && (
                  <div>
                    <label className="text-sm text-gray-500">엔티티 ID</label>
                    <p className="font-medium text-sm font-mono">{selectedLog.entityId}</p>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <label className="text-sm text-gray-500">IP 주소</label>
                    <p className="font-medium">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <label className="text-sm text-gray-500 block mb-2">상세 정보</label>
                  <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm text-gray-500 block mb-1">User Agent</label>
                  <p className="text-sm text-gray-600 break-all">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
