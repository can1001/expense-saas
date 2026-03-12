'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Send, Loader2, Users, User, UserCog, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  INPUT_BASE,
  TEXTAREA_BASE,
  SELECT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
} from '@/lib/constants/styles';

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  targetType: string;
  targetValue: string | null;
  sentCount: number;
  failedCount: number;
  status: string;
  createdBy: string;
  createdAt: string;
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

export default function AdminNotificationsPage() {
  // 발송 폼 상태
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('ALL');
  const [targetRole, setTargetRole] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [sending, setSending] = useState(false);

  // 발송 이력 상태
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 알림 메시지
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 발송 이력 조회
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/notifications?page=${page}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
        // 이력 새로고침
        fetchNotifications();
      } else {
        setErrorMessage(data.error || '알림 발송에 실패했습니다.');
      }
    } catch (error) {
      setErrorMessage('알림 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  // 대상 타입 라벨 변환
  const getTargetLabel = (notification: AdminNotification) => {
    if (notification.targetType === 'ALL') {
      return '전체 사용자';
    } else if (notification.targetType === 'ROLE') {
      const role = ROLE_OPTIONS.find((r) => r.code === notification.targetValue);
      return `역할: ${role?.name || notification.targetValue}`;
    } else if (notification.targetType === 'USER') {
      return `사용자: ${notification.targetValue}`;
    }
    return notification.targetType;
  };

  // 상태 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
            <CheckCircle className="w-3 h-3" />
            성공
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
            <AlertCircle className="w-3 h-3" />
            부분성공
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
            <XCircle className="w-3 h-3" />
            실패
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          알림 발송
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          사용자에게 웹 푸시 알림을 발송합니다.
        </p>
      </div>

      {/* 알림 메시지 */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
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
                    {userOptions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setTargetUserId(user.id);
                          setUserSearch(user.username);
                          setUserOptions([]);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between ${
                          targetUserId === user.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{user.username}</span>
                        <span className="text-gray-500 text-sm">{user.userid}</span>
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

      {/* 발송 이력 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>발송 이력</h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            발송 이력이 없습니다.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={TABLE_BASE}>
                <thead className={TABLE_HEADER}>
                  <tr>
                    <th className={TABLE_HEADER_CELL}>제목</th>
                    <th className={TABLE_HEADER_CELL}>대상</th>
                    <th className={TABLE_HEADER_CELL}>결과</th>
                    <th className={TABLE_HEADER_CELL}>발송일시</th>
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {notifications.map((notification) => (
                    <tr key={notification.id} className="hover:bg-gray-50">
                      <td className={TABLE_CELL}>
                        <div>
                          <p className="font-medium text-gray-900">{notification.title}</p>
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {notification.message}
                          </p>
                        </div>
                      </td>
                      <td className={TABLE_CELL}>
                        {getTargetLabel(notification)}
                      </td>
                      <td className={TABLE_CELL}>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(notification.status)}
                          <span className="text-xs text-gray-500">
                            성공 {notification.sentCount}건 / 실패 {notification.failedCount}건
                          </span>
                        </div>
                      </td>
                      <td className={TABLE_CELL}>
                        {new Date(notification.createdAt).toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={BTN_OUTLINE}
                >
                  이전
                </button>
                <span className="flex items-center px-4 text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={BTN_OUTLINE}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
