'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import Header from '@/components/Header';
import { SECTION_CARD, PADDING_CARD } from '@/lib/constants/styles';

// 카카오 JS SDK (전역 로드 시) 최소 타입 — 의존성 추가 없이 window에서 참조한다
interface KakaoSdk {
  Auth?: {
    login?: (options: {
      success: (authObj: { access_token: string }) => void;
      fail: () => void;
    }) => void;
  };
}

// 카카오 계정 연결 관리 (ARC-003 §4.2, C4)
// 로그인 세션이 본인 증명 — 카카오 인가 후 POST /api/auth/link-kakao로 연결한다.
// 해제는 DELETE — 마지막 로그인 수단이면 서버가 거부한다.
export default function KakaoLinkPage() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 연결 상태 조회
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/link-kakao');
      const data = await response.json();
      if (response.ok) {
        setLinked(data.linked);
        setConfigured(data.configured);
      }
    } catch {
      // 무시 — 상태 미확인 시 버튼만 비활성
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 연결 API 호출 — 카카오 토큰은 서버 검증용으로만 전달 (ARC-003 §2)
  const submitLink = async (kakaoAccessToken: string) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/link-kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kakaoAccessToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '카카오 계정 연결에 실패했습니다.');
        return;
      }

      setMessage(data.message || '카카오 계정이 연결되었습니다.');
      setLinked(true);
    } catch {
      setError('카카오 계정 연결 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카카오 인가 — SDK가 로드된 환경에서만 동작 (미설정 시 안내, M3 게이트)
  const handleLink = () => {
    const kakao = (window as unknown as { Kakao?: KakaoSdk }).Kakao;

    if (!kakao?.Auth?.login) {
      setError('카카오 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }

    kakao.Auth.login({
      success: (authObj) => {
        void submitLink(authObj.access_token);
      },
      fail: () => {
        setError('카카오 인증에 실패했습니다. 다시 시도해주세요.');
      },
    });
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/link-kakao', { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        // 마지막 로그인 수단 거부 등 — 서버의 한국어 안내 그대로 표시
        setError(data.error || '카카오 계정 연결 해제에 실패했습니다.');
        return;
      }

      setMessage(data.message || '카카오 계정 연결이 해제되었습니다.');
      setLinked(false);
    } catch {
      setError('카카오 계정 연결 해제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">카카오 계정 연결</h1>

        <div className={SECTION_CARD}>
          <div className={PADDING_CARD}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#FEE500] rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#191919]" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">카카오 로그인</h2>
                <p className="text-sm text-gray-600">
                  {linked === null
                    ? '연결 상태를 확인하는 중...'
                    : linked
                      ? '카카오 계정이 연결되어 있습니다. 카카오로 로그인할 수 있습니다.'
                      : '카카오 계정을 연결하면 카카오로 간편하게 로그인할 수 있습니다.'}
                </p>
              </div>
            </div>

            {!configured && (
              <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg mb-4">
                카카오 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하세요.
              </div>
            )}

            {message && (
              <div className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg mb-4">
                {message}
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            {linked === false && (
              /* 카카오 디자인 가이드 색상 (#FEE500) */
              <button
                type="button"
                onClick={handleLink}
                disabled={loading || !configured}
                className="w-full flex justify-center items-center py-3 px-4 rounded-lg text-lg font-medium text-[#191919] bg-[#FEE500] hover:bg-[#F5DC00] transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '연결 중...' : '카카오 계정 연결하기'}
              </button>
            )}

            {linked === true && (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-red-300 rounded-lg text-lg font-medium text-red-600 hover:bg-red-50 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '해제 중...' : '카카오 계정 연결 해제'}
              </button>
            )}

            <p className="mt-4 text-xs text-gray-500">
              연결 해제는 다른 로그인 수단(비밀번호 등)이 있을 때만 가능합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
