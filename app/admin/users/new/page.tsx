'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_LG,
  INPUT_BASE,
  SELECT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
  ERROR_MESSAGE,
  ALERT_ERROR,
  SPINNER,
} from '@/lib/constants/styles';

const ROLE_OPTIONS = [
  { value: 'user', label: '사용자' },
  { value: 'team_leader', label: '팀장' },
  { value: 'admin_assistant', label: '행정간사' },
  { value: 'accountant', label: '회계' },
  { value: 'finance_head', label: '재정팀장' },
  { value: 'admin', label: '관리자' },
];

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    userid: '',
    username: '',
    password: '',
    role: 'user',
    department: '',
    phoneNumber: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.userid.trim()) {
      newErrors.userid = '아이디를 입력해주세요.';
    }
    if (!formData.username.trim()) {
      newErrors.username = '이름을 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid: formData.userid.trim(),
          username: formData.username.trim(),
          password: formData.password || undefined,
          role: formData.role,
          department: formData.department.trim() || undefined,
          phoneNumber: formData.phoneNumber.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setErrors({ userid: '이미 존재하는 아이디입니다.' });
        } else {
          setError(data.error || '사용자 생성에 실패했습니다.');
        }
        return;
      }

      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">사용자 추가</h1>
        <Link href="/admin/users" className={BTN_OUTLINE}>
          목록으로
        </Link>
      </div>

      {/* 에러 메시지 */}
      {error && <div className={`${ALERT_ERROR} mb-6`}>{error}</div>}

      {/* 폼 */}
      <form onSubmit={handleSubmit}>
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>기본 정보</h2>

          <div className="space-y-4">
            {/* 아이디 */}
            <div>
              <label htmlFor="userid" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
                아이디
              </label>
              <input
                type="text"
                id="userid"
                name="userid"
                value={formData.userid}
                onChange={handleChange}
                placeholder="예: 청연정동진"
                className={`${INPUT_BASE} ${errors.userid ? 'border-red-500' : ''}`}
              />
              {errors.userid && <p className={ERROR_MESSAGE}>{errors.userid}</p>}
              <p className="mt-1 text-xs text-gray-500">로그인 시 사용할 아이디입니다.</p>
            </div>

            {/* 이름 */}
            <div>
              <label htmlFor="username" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
                이름
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="예: 정동진"
                className={`${INPUT_BASE} ${errors.username ? 'border-red-500' : ''}`}
              />
              {errors.username && <p className={ERROR_MESSAGE}>{errors.username}</p>}
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className={LABEL_BASE}>
                비밀번호
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="비밀번호 입력 (미입력 시 기본값: chc2026)"
                className={INPUT_BASE}
              />
              <p className="mt-1 text-xs text-gray-500">
                비워두면 기본 비밀번호(chc2026)가 설정됩니다.
              </p>
            </div>

            {/* 역할 */}
            <div>
              <label htmlFor="role" className={LABEL_BASE}>
                역할
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={SELECT_BASE}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 부서 */}
            <div>
              <label htmlFor="department" className={LABEL_BASE}>
                부서
              </label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="예: 재정팀"
                className={INPUT_BASE}
              />
            </div>

            {/* 연락처 */}
            <div>
              <label htmlFor="phoneNumber" className={LABEL_BASE}>
                연락처
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="예: 010-1234-5678"
                className={INPUT_BASE}
              />
              <p className="mt-1 text-xs text-gray-500">
                알림 발송에 사용됩니다. (선택)
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-6">
          <Link href="/admin/users" className={`${BTN_OUTLINE} ${BTN_LG}`}>
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className={`${BTN_PRIMARY} ${BTN_LG} disabled:opacity-50`}
          >
            {loading && <div className={SPINNER}></div>}
            {loading ? '생성 중...' : '사용자 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}
