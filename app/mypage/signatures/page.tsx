'use client';

import Header from '@/components/Header';
import { SignatureManager } from '@/components/signature';
import { SECTION_CARD } from '@/lib/constants/styles';

export default function SignaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-2xl font-bold mb-6">내 서명/도장 관리</h1>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            결재 승인 시 사용할 서명 또는 도장을 등록하세요. 기본으로 설정된 서명/도장이 자동으로 선택됩니다.
          </p>
        </div>

        {/* 서명/도장 관리 */}
        <div className={SECTION_CARD}>
          <SignatureManager />
        </div>
      </div>
    </div>
  );
}
