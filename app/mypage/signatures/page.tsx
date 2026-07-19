'use client';

import GlobalShell from '@/components/layout/GlobalShell';
import { SignatureManager } from '@/components/signature';
import { SECTION_CARD } from '@/lib/constants/styles';

export default function SignaturesPage() {
  return (
    <GlobalShell title="내 서명/도장 관리">
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
    </GlobalShell>
  );
}
