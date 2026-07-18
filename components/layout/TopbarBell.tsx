'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

/**
 * 탑바 알림 벨 (docs/SPEC_APPROVALS_HEADER_PHASE3_2026-07-19.md, 태스크 H3)
 *
 * `/mypage/notification-history` 링크. 미확인 카운트 dot은 신규 API 없이는 표시하지 않는다 —
 * 기존 코드베이스에 사용자별 미확인 알림 카운트 훅/API가 없음을 확인함
 * (`app/api/admin/notifications`는 관리자 발송 이력 조회용, `NotificationLog`에 읽음 여부 필드 없음).
 */
export default function TopbarBell() {
  return (
    <Link
      href="/mypage/notification-history"
      aria-label="알림 히스토리"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      <Bell className="h-5 w-5" />
    </Link>
  );
}
