'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// 카카오 JS SDK (전역 로드 시) 최소 타입 — 의존성 추가 없이 window에서 참조한다
interface KakaoSdk {
  Auth?: {
    login?: (options: {
      success: (authObj: { access_token: string }) => void;
      fail: () => void;
    }) => void;
  };
}

// 초대 수락 페이지 (ARC-003 §4.2, C3)
// 초대 토큰이 본인 증명 — 카카오로 시작하거나 아이디/비밀번호로 가입해
// POST /api/auth/accept-invitation으로 수락한다.
export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const inviteToken = params.token;

  const [formData, setFormData] = useState({
    userid: '',
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setError('');
  };

  // 수락 API 호출 — 성공 시 자체 JWT 쿠키가 설정되므로 바로 홈으로 이동
  const submitAccept = async (body: Record<string, unknown>) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken, ...body }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '초대 수락에 실패했습니다.');
        return;
      }

      router.push('/');
    } catch {
      setError('초대 수락 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카카오로 시작 — SDK가 로드된 환경에서만 동작 (미설정 시 안내, M3 게이트)
  const handleKakao = () => {
    const kakao = (window as unknown as { Kakao?: KakaoSdk }).Kakao;

    if (!kakao?.Auth?.login) {
      setError('카카오 로그인이 아직 설정되지 않았습니다. 아래 가입 폼을 이용해주세요.');
      return;
    }

    kakao.Auth.login({
      success: (authObj) => {
        // 카카오 토큰은 서버 검증용으로만 전달 — 세션은 자체 JWT (ARC-003 §2)
        submitAccept({
          kakaoAccessToken: authObj.access_token,
          username: formData.username.trim() || undefined,
        });
      },
      fail: () => {
        setError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      },
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.userid.trim()) {
      newErrors.userid = '아이디를 입력해주세요.';
    }
    if (!formData.username.trim()) {
      newErrors.username = '이름을 입력해주세요.';
    }
    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 4) {
      newErrors.password = '비밀번호는 4자 이상이어야 합니다.';
    }
    if (!formData.passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호 확인을 입력해주세요.';
    } else if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await submitAccept({
      userid: formData.userid.trim(),
      username: formData.username.trim(),
      password: formData.password,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            지출결의서 시스템
          </h1>
          <p className="mt-2 text-center text-xl text-gray-700">초대 수락</p>
          <p className="mt-2 text-center text-sm text-gray-500">
            초대받은 조직에 합류하려면 카카오로 시작하거나 계정을 만들어주세요.
          </p>
        </div>

        {/* 카카오로 시작 — 카카오 디자인 가이드 색상 (#FEE500) */}
        <button
          type="button"
          onClick={handleKakao}
          disabled={loading}
          className="w-full flex justify-center items-center py-3 px-4 rounded-lg text-lg font-medium text-[#191919] bg-[#FEE500] hover:bg-[#F5DC00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          카카오로 시작하기
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">또는 계정 만들기</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* 아이디 */}
          <div>
            <label htmlFor="userid" className="block text-sm font-medium text-gray-700">
              아이디 <span className="text-red-500">*</span>
            </label>
            <input
              id="userid"
              name="userid"
              type="text"
              autoComplete="username"
              value={formData.userid}
              onChange={handleChange}
              className={`mt-1 appearance-none relative block w-full px-3 py-3 border ${
                errors.userid ? 'border-red-500' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              placeholder="예: 청연정혜종"
            />
            {errors.userid && (
              <p className="mt-1 text-sm text-red-600">{errors.userid}</p>
            )}
          </div>

          {/* 이름 */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="name"
              value={formData.username}
              onChange={handleChange}
              className={`mt-1 appearance-none relative block w-full px-3 py-3 border ${
                errors.username ? 'border-red-500' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              placeholder="예: 정혜종"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              className={`mt-1 appearance-none relative block w-full px-3 py-3 border ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              placeholder="4자 이상"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label
              htmlFor="passwordConfirm"
              className="block text-sm font-medium text-gray-700"
            >
              비밀번호 확인 <span className="text-red-500">*</span>
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={formData.passwordConfirm}
              onChange={handleChange}
              className={`mt-1 appearance-none relative block w-full px-3 py-3 border ${
                errors.passwordConfirm ? 'border-red-500' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              placeholder="비밀번호 재입력"
            />
            {errors.passwordConfirm && (
              <p className="mt-1 text-sm text-red-600">{errors.passwordConfirm}</p>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 수락 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {loading ? '처리 중...' : '가입하고 초대 수락'}
          </button>

          {/* 로그인 링크 */}
          <div className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
              로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
