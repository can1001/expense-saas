'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const from = searchParams.get('from') || '/';
  const registered = searchParams.get('registered');

  useEffect(() => {
    if (registered === 'true') {
      setSuccessMessage('회원가입이 완료되었습니다. 로그인해주세요.');
    }
  }, [registered]);

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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: userid.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
      <div>
        <h1 className="text-center text-3xl font-bold text-gray-900">
          지출결의서 시스템
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          아이디와 비밀번호를 입력해주세요
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="userid" className="block text-sm font-medium text-gray-700">
              아이디
            </label>
            <input
              id="userid"
              name="userid"
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
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="비밀번호를 입력하세요"
            />
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
