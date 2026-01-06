'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    userid: '',
    username: '',
    password: '',
    passwordConfirm: '',
    department: '',
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
    setError('');

    if (!validate()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid: formData.userid.trim(),
          username: formData.username.trim(),
          password: formData.password,
          department: formData.department.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ userid: data.error || '이미 존재하는 아이디입니다.' });
        } else {
          setError(data.error || '회원가입에 실패했습니다.');
        }
        return;
      }

      // 회원가입 성공 - 로그인 페이지로 이동
      router.push('/login?registered=true');
    } catch {
      setError('회원가입 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            지출결의서 시스템
          </h1>
          <p className="mt-2 text-center text-xl text-gray-700">
            회원가입
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
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
            <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700">
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

          {/* 부서 */}
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              부서 <span className="text-gray-400">(선택)</span>
            </label>
            <input
              id="department"
              name="department"
              type="text"
              value={formData.department}
              onChange={handleChange}
              className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="예: 재정팀"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 회원가입 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {loading ? '가입 중...' : '회원가입'}
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
