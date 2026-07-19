'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GlobalShell from '@/components/layout/GlobalShell';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_LG,
  INPUT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
  ERROR_MESSAGE,
  ALERT_ERROR,
  SPINNER,
} from '@/lib/constants/styles';

const ALERT_SUCCESS = 'bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setError(null);
    setSuccess(null);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = '현재 비밀번호를 입력해주세요.';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = '새 비밀번호를 입력해주세요.';
    } else if (formData.newPassword.length < 4) {
      newErrors.newPassword = '새 비밀번호는 4자 이상이어야 합니다.';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '새 비밀번호 확인을 입력해주세요.';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = '새 비밀번호가 일치하지 않습니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '비밀번호 변경에 실패했습니다.');
        return;
      }

      setSuccess('비밀번호가 변경되었습니다.');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // 3초 후 홈으로 이동
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch {
      setError('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlobalShell title="비밀번호 변경">
      <div className="max-w-md mx-auto">
      {/* 에러 메시지 */}
      {error && <div className={`${ALERT_ERROR} mb-6`}>{error}</div>}

      {/* 성공 메시지 */}
      {success && (
        <div className={`${ALERT_SUCCESS} mb-6`}>
          {success}
          <p className="text-sm mt-1">잠시 후 메인 페이지로 이동합니다.</p>
        </div>
      )}

      {/* 폼 */}
      <form onSubmit={handleSubmit}>
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>비밀번호 변경</h2>

          <div className="space-y-4">
            {/* 현재 비밀번호 */}
            <div>
              <label htmlFor="currentPassword" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
                현재 비밀번호
              </label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                autoComplete="current-password"
                className={`${INPUT_BASE} ${errors.currentPassword ? 'border-red-500' : ''}`}
              />
              {errors.currentPassword && (
                <p className={ERROR_MESSAGE}>{errors.currentPassword}</p>
              )}
            </div>

            {/* 새 비밀번호 */}
            <div>
              <label htmlFor="newPassword" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
                새 비밀번호
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                autoComplete="new-password"
                className={`${INPUT_BASE} ${errors.newPassword ? 'border-red-500' : ''}`}
              />
              {errors.newPassword && (
                <p className={ERROR_MESSAGE}>{errors.newPassword}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">4자 이상 입력해주세요.</p>
            </div>

            {/* 새 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
                새 비밀번호 확인
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                className={`${INPUT_BASE} ${errors.confirmPassword ? 'border-red-500' : ''}`}
              />
              {errors.confirmPassword && (
                <p className={ERROR_MESSAGE}>{errors.confirmPassword}</p>
              )}
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 mt-6">
          <Link href="/" className={`${BTN_OUTLINE} ${BTN_LG}`}>
            취소
          </Link>
          <button
            type="submit"
            disabled={saving || !!success}
            className={`${BTN_PRIMARY} ${BTN_LG} disabled:opacity-50`}
          >
            {saving && <div className={SPINNER}></div>}
            {saving ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
        </form>
      </div>
    </GlobalShell>
  );
}
