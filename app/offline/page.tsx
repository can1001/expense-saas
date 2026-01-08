'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* 아이콘 */}
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-10 h-10 text-gray-400" />
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            오프라인 상태입니다
          </h1>

          {/* 설명 */}
          <p className="text-gray-600 mb-6">
            인터넷 연결이 끊어졌습니다.<br />
            네트워크 연결을 확인하고 다시 시도해주세요.
          </p>

          {/* 재시도 버튼 */}
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            다시 시도
          </button>

          {/* 추가 안내 */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              일부 기능은 오프라인에서도 사용 가능합니다.<br />
              이전에 열어본 페이지는 캐시에서 확인하실 수 있습니다.
            </p>
          </div>
        </div>

        {/* 앱 정보 */}
        <p className="mt-6 text-sm text-gray-400">
          지출결의서 관리 시스템
        </p>
      </div>
    </div>
  );
}
