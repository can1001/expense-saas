'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

interface QuickUserRegisterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: { userid: string; username: string }) => void;
}

export default function QuickUserRegister({
  isOpen,
  onClose,
  onSuccess,
}: QuickUserRegisterProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    userid: string;
    username: string;
    password: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/users/quick-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '사용자 등록에 실패했습니다.');
        return;
      }

      // 성공 정보 표시
      setSuccessInfo({
        userid: data.user.userid,
        username: data.user.username,
        password: 'chc2026',
      });

      onSuccess?.(data.user);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError(null);
    setSuccessInfo(null);
    onClose();
  };

  const handleRegisterAnother = () => {
    setName('');
    setError(null);
    setSuccessInfo(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="사용자 등록" size="sm">
      {successInfo ? (
        // 등록 성공 화면
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-medium text-green-800">등록 완료</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">이름:</span>
                <span className="font-medium">{successInfo.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">아이디:</span>
                <span className="font-medium">{successInfo.userid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">비밀번호:</span>
                <span className="font-medium text-blue-600">{successInfo.password}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRegisterAnother}
              className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              추가 등록
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              완료
            </button>
          </div>
        </div>
      ) : (
        // 등록 폼
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              이름
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              아이디는 &apos;청연&apos; + 이름으로 자동 생성됩니다.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
