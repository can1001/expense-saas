'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, PenLine, Bell, History, Send } from 'lucide-react';
import Header from '@/components/Header';
import { SECTION_CARD, PADDING_CARD } from '@/lib/constants/styles';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';

export default function MyPage() {
  const [canSendNotification, setCanSendNotification] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (response.ok && data.user) {
          setCanSendNotification(roleHasPermission(data.user.role, PERMISSIONS.NOTIFICATION_SEND));
        }
      } catch {
        // 무시
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 페이지 제목 */}
        <h1 className="text-2xl font-bold mb-6">마이페이지</h1>

      {/* 메뉴 카드 */}
      <div className="grid gap-4">
        <Link
          href="/mypage/password"
          className={`group ${SECTION_CARD} hover:shadow-lg transition-all hover:-translate-y-0.5`}
        >
          <div className={`${PADDING_CARD} flex items-center gap-4`}>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Key className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                비밀번호 변경
              </h2>
              <p className="text-sm text-gray-600">
                계정 비밀번호를 변경합니다
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>

        <Link
          href="/mypage/signatures"
          className={`group ${SECTION_CARD} hover:shadow-lg transition-all hover:-translate-y-0.5`}
        >
          <div className={`${PADDING_CARD} flex items-center gap-4`}>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <PenLine className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                서명/도장 관리
              </h2>
              <p className="text-sm text-gray-600">
                결재 시 사용할 서명 또는 도장을 등록합니다
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>

        <Link
          href="/mypage/notifications"
          className={`group ${SECTION_CARD} hover:shadow-lg transition-all hover:-translate-y-0.5`}
        >
          <div className={`${PADDING_CARD} flex items-center gap-4`}>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bell className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                알림 설정
              </h2>
              <p className="text-sm text-gray-600">
                푸시 알림을 설정하고 테스트합니다
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>

        <Link
          href="/mypage/notification-history"
          className={`group ${SECTION_CARD} hover:shadow-lg transition-all hover:-translate-y-0.5`}
        >
          <div className={`${PADDING_CARD} flex items-center gap-4`}>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <History className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                알림 히스토리
              </h2>
              <p className="text-sm text-gray-600">
                발송된 알림 내역을 확인합니다
              </p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>

        {/* 알림 발송 (권한 있는 사용자만 표시) */}
        {canSendNotification && (
          <Link
            href="/mypage/send-notification"
            className={`group ${SECTION_CARD} hover:shadow-lg transition-all hover:-translate-y-0.5`}
          >
            <div className={`${PADDING_CARD} flex items-center gap-4`}>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Send className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                  알림 발송
                </h2>
                <p className="text-sm text-gray-600">
                  사용자에게 알림을 발송합니다
                </p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        )}
        </div>
      </div>
    </div>
  );
}
