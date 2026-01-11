'use client';

import Link from 'next/link';
import { ArrowLeft, Key, PenLine } from 'lucide-react';
import { SECTION_CARD, PADDING_CARD } from '@/lib/constants/styles';

export default function MyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">마이페이지</h1>
      </div>

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
      </div>
    </div>
  );
}
