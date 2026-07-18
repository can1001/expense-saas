'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { useMeConfig } from '@/lib/contexts/MeConfigContext';

// 테넌트 정보 타입
interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  orgType: string;
  logoUrl: string | null;
}

// 복수 소속 로그인 시 조직 선택 항목 (B2 로그인 응답의 memberships)
interface MembershipChoice {
  tenantId: string;
  tenantName: string;
  orgType: string;
  role: string;
}

// 카카오 JS SDK (전역 로드 시) 최소 타입 — 의존성 추가 없이 window에서 참조한다
interface KakaoSdk {
  Auth?: {
    login?: (options: {
      success: (authObj: { access_token: string }) => void;
      fail: () => void;
    }) => void;
  };
}

// 로그인 백엔드 스위치 (Strangler 커토버, spec §7 · §12)
//   true  → FastAPI (/api/py/auth/login) — 발급 토큰은 Next.js 와 상호검증(PR #13)
//   false → 기존 Next.js (/api/auth/login) [기본]
// ⚠️ 프로덕션에서 true 로 켜려면 FastAPI 가 동일 DB + 동일 시크릿(SECRET_KEY==USER_JWT_SECRET)으로
//    배포돼 있어야 한다. 미충족 시 로그인/세션이 깨진다.
const USE_PY_AUTH = process.env.NEXT_PUBLIC_USE_PY_AUTH === 'true';
const LOGIN_URL = USE_PY_AUTH ? '/api/py/auth/login' : '/api/auth/login';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [rememberUserId, setRememberUserId] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  // 복수 소속: 로그인 후 조직 선택 화면 표시 (ARC-002 §2.2, B5)
  const [pendingMemberships, setPendingMemberships] = useState<MembershipChoice[] | null>(null);
  const [selectingTenantId, setSelectingTenantId] = useState<string | null>(null);
  // 초대 없는 카카오 신규 진입: 테넌트 미소속 안내 화면 (ARC-003 §4.2, C4)
  const [noInvitation, setNoInvitation] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  // 보안: 클라이언트 하이드레이션 완료 여부 (JS 로드 전 폼 제출 시 비밀번호 URL 노출 방지)
  const [isHydrated, setIsHydrated] = useState(false);
  // 로그인/조직 선택 후 서버 주도 설정 재조회 (B5)
  const { refresh: refreshMeConfig } = useMeConfig();

  const from = searchParams.get('from') || '/';
  const registered = searchParams.get('registered');

  // 보안: 클라이언트 하이드레이션 완료 감지
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 테넌트 정보 가져오기
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await fetch('/api/tenant/info');
        const data = await response.json();
        if (data.tenant) {
          setTenant(data.tenant);
        }
      } catch (err) {
        console.error('테넌트 정보 조회 실패:', err);
      } finally {
        setTenantLoading(false);
      }
    };

    fetchTenantInfo();
  }, []);

  useEffect(() => {
    if (registered === 'true') {
      setSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.');
    }
  }, [registered]);

  useEffect(() => {
    const savedUserId = localStorage.getItem('rememberedUserId');
    if (savedUserId) {
      setUserid(savedUserId);
      setRememberUserId(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userid.trim()) {
      setError('아이디를 입력해주세요.');
      return;
    }

    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: userid.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Next.js 는 { error }, FastAPI 는 { detail } 형식
        setError(data.error || data.detail || '로그인에 실패했습니다.');
        return;
      }

      if (rememberUserId) {
        localStorage.setItem('rememberedUserId', userid.trim());
      } else {
        localStorage.removeItem('rememberedUserId');
      }

      // 복수 소속: 조직 선택 화면으로 전환 — 최종 토큰은 switch-tenant(B3)에서 발급
      if (data.requiresTenantSelection && Array.isArray(data.memberships)) {
        setPendingMemberships(data.memberships);
        return;
      }

      // 단일 소속: 기존 흐름 그대로 진입 + 서버 주도 설정 재조회
      void refreshMeConfig();
      router.push(from);
      router.refresh();
    } catch {
      setError('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 조직 선택 → switch-tenant 호출로 최종 토큰 발급 후 진입 (ARC-002 §3.2)
  const handleSelectTenant = async (tenantId: string) => {
    setError('');
    setSelectingTenantId(tenantId);

    try {
      const response = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '조직 선택에 실패했습니다.');
        setSelectingTenantId(null);
        return;
      }

      void refreshMeConfig();
      router.push(from);
      router.refresh();
    } catch {
      setError('조직 선택 처리 중 오류가 발생했습니다.');
      setSelectingTenantId(null);
    }
  };

  // 카카오 로그인 응답 처리 — linked: false면 초대 안내, 복수 소속이면 조직 선택 (C4)
  const submitKakaoLogin = async (kakaoAccessToken: string) => {
    setKakaoLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kakaoAccessToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '카카오 로그인에 실패했습니다.');
        return;
      }

      // 연결된 계정 없음 → "초대를 받아야 사용할 수 있습니다" 안내 (자동 가입 없음)
      if (data.linked === false) {
        setNoInvitation(true);
        return;
      }

      // 복수 소속: 조직 선택 화면으로 전환 — 최종 토큰은 switch-tenant(B3)에서 발급
      if (data.requiresTenantSelection && Array.isArray(data.memberships)) {
        setPendingMemberships(data.memberships);
        return;
      }

      void refreshMeConfig();
      router.push(from);
      router.refresh();
    } catch {
      setError('카카오 로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setKakaoLoading(false);
    }
  };

  // 카카오 인가 — SDK가 로드된 환경에서만 동작 (미설정 시 안내, M3 게이트)
  const handleKakaoLogin = () => {
    const kakao = (window as unknown as { Kakao?: KakaoSdk }).Kakao;

    if (!kakao?.Auth?.login) {
      setError('카카오 로그인이 아직 설정되지 않았습니다. 아이디/비밀번호로 로그인해주세요.');
      return;
    }

    kakao.Auth.login({
      success: (authObj) => {
        // 카카오 토큰은 서버 검증용으로만 전달 — 세션은 자체 JWT (ARC-003 §2)
        void submitKakaoLogin(authObj.access_token);
      },
      fail: () => {
        setError('카카오 인증에 실패했습니다. 다시 시도해주세요.');
      },
    });
  };

  // 초대 없는 카카오 신규 진입 — 테넌트 미소속 안내 화면 (ARC-003 §4.2)
  if (noInvitation) {
    return (
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-900">
            초대가 필요합니다
          </h1>
          <p className="mt-4 text-center text-sm text-gray-600">
            연결된 계정이 없습니다. 이 시스템은 조직의 초대를 받아야 사용할 수
            있습니다.
          </p>
          <p className="mt-2 text-center text-sm text-gray-600">
            소속 조직의 관리자에게 초대 링크를 요청해주세요. 초대 링크에서
            카카오로 시작하면 계정이 연결됩니다.
          </p>
        </div>

        <button
          onClick={() => {
            setNoInvitation(false);
            setError('');
          }}
          className="w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors min-h-[44px]"
        >
          로그인 화면으로 돌아가기
        </button>
      </div>
    );
  }

  // 복수 소속 — 조직 선택 화면 (단일 소속은 이 화면을 거치지 않는다)
  if (pendingMemberships) {
    return (
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-900">
            소속 조직 선택
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            여러 조직에 소속되어 있습니다. 이용할 조직을 선택해주세요.
          </p>
        </div>

        <ul className="space-y-2">
          {pendingMemberships.map((membership) => (
            <li key={membership.tenantId}>
              <button
                onClick={() => handleSelectTenant(membership.tenantId)}
                disabled={!!selectingTenantId}
                className="flex items-center gap-3 w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-gray-50 transition-colors min-h-[44px] disabled:opacity-50"
              >
                <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 font-medium text-gray-900">
                  {membership.tenantName}
                </span>
                {selectingTenantId === membership.tenantId && (
                  <span className="text-xs text-gray-500">입장 중...</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={() => {
            setPendingMemberships(null);
            setSelectingTenantId(null);
            setError('');
          }}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          다른 계정으로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
      <div>
        {/* 테넌트 로고 표시 */}
        {tenant?.logoUrl && (
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tenant.logoUrl}
              alt={`${tenant.name} 로고`}
              className="h-16 w-auto object-contain"
            />
          </div>
        )}

        {/* 테넌트명 또는 기본 타이틀 */}
        {tenantLoading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          </div>
        ) : tenant ? (
          <>
            <h1 className="text-center text-2xl font-bold text-gray-900">
              {tenant.name}
            </h1>
            <p className="mt-1 text-center text-lg text-blue-600 font-medium">
              지출결의서 시스템
            </p>
          </>
        ) : (
          <h1 className="text-center text-3xl font-bold text-gray-900">
            지출결의서 시스템
          </h1>
        )}

        <p className="mt-2 text-center text-sm text-gray-600">
          아이디와 비밀번호를 입력해주세요
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit} method="post" action="#">
        <div className="space-y-4">
          <div>
            <label htmlFor="userid" className="block text-sm font-medium text-gray-700">
              아이디
            </label>
            <input
              id="userid"
              name={isHydrated ? "userid" : undefined}
              type="text"
              autoComplete="username"
              value={userid}
              onChange={(e) => setUserid(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="아이디를 입력하세요"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              비밀번호
            </label>
            <input
              id="password"
              name={isHydrated ? "password" : undefined}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="비밀번호를 입력하세요"
            />
          </div>
          <div className="flex items-center">
            <input
              id="remember-userid"
              name="remember-userid"
              type="checkbox"
              checked={rememberUserId}
              onChange={(e) => setRememberUserId(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="remember-userid" className="ml-2 block text-sm text-gray-700 cursor-pointer">
              아이디 기억하기
            </label>
          </div>
        </div>

        {successMessage && (
          <div className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        {/* 카카오 로그인 — 카카오 디자인 가이드 색상 (#FEE500), C4 */}
        <button
          type="button"
          onClick={handleKakaoLogin}
          disabled={loading || kakaoLoading}
          className="w-full flex justify-center items-center py-3 px-4 rounded-lg text-lg font-medium text-[#191919] bg-[#FEE500] hover:bg-[#F5DC00] transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {kakaoLoading ? '카카오 로그인 중...' : '카카오로 로그인'}
        </button>

        <div className="hidden text-center text-sm text-gray-600">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-blue-600 hover:text-blue-500 font-medium">
            회원가입
          </Link>
        </div>
      </form>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<LoginLoading />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
