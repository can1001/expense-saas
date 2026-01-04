'use client';

import { useState, useEffect, use } from 'react';
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
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface User {
  id: string;
  userid: string;
  username: string;
  role: string;
  department: string | null;
  isActive: boolean;
}

const ROLE_OPTIONS = [
  { value: 'user', label: '사용자' },
  { value: 'team_leader', label: '팀장' },
  { value: 'admin_assistant', label: '행정간사' },
  { value: 'accountant', label: '회계' },
  { value: 'finance_head', label: '재정팀장' },
  { value: 'admin', label: '관리자' },
];

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user',
    department: '',
    isActive: true,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/users/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('사용자를 찾을 수 없습니다.');
          } else {
            throw new Error('Failed to fetch user');
          }
          return;
        }

        const data = await response.json();
        setUser(data);
        setFormData({
          username: data.username,
          password: '',
          role: data.role,
          department: data.department ?? '',
          isActive: data.isActive,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '사용자 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = '이름을 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        username: formData.username.trim(),
        role: formData.role,
        department: formData.department.trim() || null,
        isActive: formData.isActive,
      };

      // 비밀번호가 입력된 경우에만 포함
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '사용자 수정에 실패했습니다.');
        return;
      }

      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} min-h-screen`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className={ALERT_ERROR}>
          {error || '사용자를 찾을 수 없습니다.'}
        </div>
        <div className="mt-4">
          <Link href="/admin/users" className={BTN_OUTLINE}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">사용자 수정</h1>
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
            {/* 아이디 (읽기 전용) */}
            <div>
              <label className={LABEL_BASE}>아이디</label>
              <input
                type="text"
                value={user.userid}
                disabled
                className={`${INPUT_BASE} bg-gray-100 cursor-not-allowed`}
              />
              <p className="mt-1 text-xs text-gray-500">아이디는 변경할 수 없습니다.</p>
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
                className={`${INPUT_BASE} ${errors.username ? 'border-red-500' : ''}`}
              />
              {errors.username && <p className={ERROR_MESSAGE}>{errors.username}</p>}
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className={LABEL_BASE}>
                새 비밀번호
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="변경 시에만 입력"
                className={INPUT_BASE}
              />
              <p className="mt-1 text-xs text-gray-500">
                비워두면 기존 비밀번호가 유지됩니다.
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

            {/* 활성 상태 */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">활성 상태</span>
              </label>
              <p className="mt-1 text-xs text-gray-500 ml-6">
                비활성화된 사용자는 로그인할 수 없습니다.
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
            disabled={saving}
            className={`${BTN_PRIMARY} ${BTN_LG} disabled:opacity-50`}
          >
            {saving && <div className={SPINNER}></div>}
            {saving ? '저장 중...' : '변경 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
