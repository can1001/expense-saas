'use client';

import { Bell, BellOff, Send, AlertCircle, CheckCircle, Info } from 'lucide-react';
import GlobalShell from '@/components/layout/GlobalShell';
import { SECTION_CARD, PADDING_CARD } from '@/lib/constants/styles';
import { usePushNotification } from '@/lib/hooks/usePushNotification';

export default function NotificationsPage() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushNotification();

  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleSendTest = async () => {
    const success = await sendTest();
    if (success) {
      alert('테스트 알림이 발송되었습니다.');
    }
  };

  return (
    <GlobalShell title="알림 설정">
      <div className="max-w-2xl mx-auto">
        {/* 알림 상태 카드 */}
        <div className={`${SECTION_CARD} mb-4`}>
          <div className={PADDING_CARD}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isSubscribed ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {isSubscribed ? (
                  <Bell className="w-6 h-6 text-green-600" />
                ) : (
                  <BellOff className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  푸시 알림
                </h2>
                <p className="text-sm text-gray-600">
                  {isSubscribed ? '알림이 활성화되어 있습니다' : '알림이 비활성화되어 있습니다'}
                </p>
              </div>
            </div>

            {/* 지원 여부 체크 */}
            {!isSupported && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      이 브라우저는 푸시 알림을 지원하지 않습니다
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      iOS의 경우 Safari에서 &quot;홈 화면에 추가&quot;한 후 앱에서 사용해주세요.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 권한 거부 상태 */}
            {isSupported && permission === 'denied' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      알림 권한이 차단되어 있습니다
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      브라우저 설정에서 알림 권한을 허용해주세요.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* 알림 토글 버튼 */}
            {isSupported && permission !== 'denied' && (
              <button
                onClick={handleToggleSubscription}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isSubscribed
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : isSubscribed ? (
                  <>
                    <BellOff className="w-5 h-5" />
                    알림 끄기
                  </>
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    알림 허용
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 테스트 알림 카드 */}
        {isSubscribed && (
          <div className={`${SECTION_CARD} mb-4`}>
            <div className={PADDING_CARD}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Send className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    테스트 알림
                  </h2>
                  <p className="text-sm text-gray-600">
                    알림이 정상적으로 도착하는지 확인합니다
                  </p>
                </div>
              </div>
              <button
                onClick={handleSendTest}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    테스트 알림 보내기
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 알림 안내 */}
        <div className={SECTION_CARD}>
          <div className={PADDING_CARD}>
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">알림 안내</h3>
            </div>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>결재 요청이 도착하면 알림을 받습니다</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>제출한 지출결의서가 승인/반려되면 알림을 받습니다</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>지급 완료 시 알림을 받습니다</span>
              </li>
            </ul>

            {/* iOS 안내 */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                <strong>iOS 사용자:</strong> Safari에서 &quot;공유&quot; → &quot;홈 화면에 추가&quot;로
                앱을 설치한 후 알림을 설정할 수 있습니다. (iOS 16.4 이상)
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlobalShell>
  );
}
