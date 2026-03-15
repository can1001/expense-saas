'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Send,
  Loader2,
  Users,
  User,
  UserCog,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Undo2,
  Wallet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  History,
} from 'lucide-react';
import Header from '@/components/Header';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  INPUT_BASE,
  TEXTAREA_BASE,
  SELECT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
} from '@/lib/constants/styles';

// 알림 발송 권한이 있는 역할
const NOTIFICATION_ALLOWED_ROLES = ['admin', 'admin_assistant', 'accountant', 'finance_head'];

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;
}

interface Role {
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  username: string;
  userid: string;
}

const TARGET_TYPES = [
  { value: 'ALL', label: '전체 사용자', icon: Users },
  { value: 'ROLE', label: '역할별', icon: UserCog },
  { value: 'USER', label: '특정 사용자', icon: User },
];

const ROLE_OPTIONS: Role[] = [
  { code: 'admin', name: '관리자' },
  { code: 'finance_head', name: '재정팀장' },
  { code: 'accountant', name: '회계' },
  { code: 'team_leader', name: '팀장' },
  { code: 'admin_assistant', name: '행정간사' },
  { code: 'user', name: '사용자' },
];

// 히스토리 관련 타입 및 상수
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
  MANUAL: { label: '수동 발송', icon: Bell, color: 'text-red-600 bg-red-100' },
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

export default function SendNotificationPage() {
  const router = useRouter();

  // 사용자 정보
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 발송 폼 상태
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('ALL');
  const [targetRole, setTargetRole] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [sending, setSending] = useState(false);

  // 알림 메시지
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 히스토리 상태
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  // 사용자 정보 및 권한 확인
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (response.ok && data.user) {
          setUser(data.user);
          // 권한 체크
          if (!NOTIFICATION_ALLOWED_ROLES.includes(data.user.role)) {
            router.push('/mypage');
          }
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setAuthLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  // 히스토리 조회
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', historyPage.toString());
      params.set('limit', '10');

      const response = await fetch(`/api/push/history?${params}`);
      if (response.ok) {
        const data: HistoryResponse = await response.json();
        setLogs(data.data);
        setHistoryTotalPages(data.totalPages);
        setHistoryTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  // 히스토리 로드
  useEffect(() => {
    if (user && NOTIFICATION_ALLOWED_ROLES.includes(user.role)) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

  // 사용자 검색
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserOptions([]);
      return;
    }
    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(query)}&pageSize=10`);
      if (response.ok) {
        const data = await response.json();
        setUserOptions(data.users || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (targetType === 'USER') {
        searchUsers(userSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, targetType, searchUsers]);

  // 알림 발송
  const handleSend = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (!title.trim() || !message.trim()) {
      setErrorMessage('제목과 메시지를 입력해주세요.');
      return;
    }

    if (targetType === 'ROLE' && !targetRole) {
      setErrorMessage('역할을 선택해주세요.');
      return;
    }

    if (targetType === 'USER' && !targetUserId) {
      setErrorMessage('사용자를 선택해주세요.');
      return;
    }

    try {
      setSending(true);
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetType,
          targetValue: targetType === 'ROLE' ? targetRole : targetType === 'USER' ? targetUserId : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(
          `알림 발송 완료: ${data.summary.sentCount}건 성공` +
          (data.summary.failedCount > 0 ? `, ${data.summary.failedCount}건 실패` : '')
        );
        // 폼 초기화
        setTitle('');
        setMessage('');
        setTargetType('ALL');
        setTargetRole('');
        setTargetUserId('');
        setUserSearch('');
        // 히스토리 새로고침
        setHistoryPage(1);
        fetchHistory();
      } else {
        setErrorMessage(data.error || '알림 발송에 실패했습니다.');
      }
    } catch {
      setErrorMessage('알림 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  // 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  // 권한 없음
  if (!user || !NOTIFICATION_ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 뒤로가기 + 제목 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/mypage"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-600" />
            알림 발송
          </h1>
        </div>

        {/* 알림 메시지 */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errorMessage}
          </div>
        )}

        {/* 발송 폼 */}
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>새 알림 발송</h2>

          <div className="space-y-4">
            {/* 제목 */}
            <div>
              <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="알림 제목을 입력하세요"
                className={INPUT_BASE}
                maxLength={100}
              />
            </div>

            {/* 메시지 */}
            <div>
              <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>메시지</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="알림 내용을 입력하세요"
                className={`${TEXTAREA_BASE} h-24`}
                maxLength={500}
              />
            </div>

            {/* 대상 선택 */}
            <div>
              <label className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>발송 대상</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {TARGET_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setTargetType(type.value);
                        setTargetRole('');
                        setTargetUserId('');
                        setUserSearch('');
                      }}
                      className={`p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        targetType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 역할 선택 */}
              {targetType === 'ROLE' && (
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className={SELECT_BASE}
                >
                  <option value="">역할을 선택하세요</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
              )}

              {/* 사용자 검색 */}
              {targetType === 'USER' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="사용자 이름 또는 아이디로 검색"
                    className={INPUT_BASE}
                  />
                  {userOptions.length > 0 && (
                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {userOptions.map((userOption) => (
                        <button
                          key={userOption.id}
                          type="button"
                          onClick={() => {
                            setTargetUserId(userOption.id);
                            setUserSearch(userOption.username);
                            setUserOptions([]);
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between ${
                            targetUserId === userOption.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <span>{userOption.username}</span>
                          <span className="text-gray-500 text-sm">{userOption.userid}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {targetUserId && (
                    <p className="text-sm text-blue-600">
                      선택됨: {userSearch}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 발송 버튼 */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className={BTN_PRIMARY}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    발송 중...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    알림 발송
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 발송 히스토리 */}
        <div className={`${SECTION_CARD} mt-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={SECTION_TITLE}>
              <History className="w-5 h-5 inline mr-2" />
              발송 히스토리
            </h2>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 총 개수 */}
          <div className="text-sm text-gray-500 mb-3">
            총 {historyTotal}개의 알림
          </div>

          {/* 로딩 상태 */}
          {historyLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
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
          {!historyLoading && logs.length === 0 && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">발송된 알림이 없습니다.</p>
            </div>
          )}

          {/* 알림 목록 */}
          {!historyLoading && logs.length > 0 && (
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
                    className="bg-gray-50 rounded-lg p-4"
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
                          <Link
                            href={`/expenses/${log.expense.id}`}
                            className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline block"
                          >
                            {log.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {log.title}
                          </p>
                        )}

                        {/* 본문 */}
                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                          {log.body}
                        </p>

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
                            <Link
                              href={`/expenses/${log.expense.id}`}
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              {log.expense.applicantName} ·{' '}
                              {log.expense.requestAmount.toLocaleString()}원
                            </Link>
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
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                {historyPage} / {historyTotalPages}
              </span>
              <button
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                disabled={historyPage === historyTotalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
