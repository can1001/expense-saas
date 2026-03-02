'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number';
  defaultValue: unknown;
}

const SETTINGS_CONFIG: SettingItem[] = [
  {
    key: 'paymentSignatureRequired',
    label: '출납 서명 필수',
    description: '지급 완료 처리 시 출납 서명을 필수로 요구합니다.',
    type: 'boolean',
    defaultValue: false,
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const keys = SETTINGS_CONFIG.map(s => s.key).join(',');
      const response = await fetch(`/api/settings?keys=${keys}`);

      if (!response.ok) {
        throw new Error('설정을 불러올 수 없습니다.');
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError(err instanceof Error ? err.message : '설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: unknown) => {
    try {
      setIsSaving(key);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '설정 저장에 실패했습니다.');
      }

      // 로컬 상태 업데이트
      setSettings(prev => ({ ...prev, [key]: value }));
      setSuccessMessage('설정이 저장되었습니다.');

      // 3초 후 성공 메시지 제거
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update setting:', err);
      setError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(null);
    }
  };

  const handleToggle = (key: string) => {
    const currentValue = settings[key] ?? false;
    updateSetting(key, !currentValue);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gray-500 p-3 rounded-lg text-white">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">시스템 설정</h1>
            <p className="text-gray-600 mt-1">시스템 전체에 적용되는 설정을 관리합니다.</p>
          </div>
        </div>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
          <Save className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* 설정 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="divide-y divide-gray-200">
          {SETTINGS_CONFIG.map((config) => {
            const value = settings[config.key] ?? config.defaultValue;
            const isSavingThis = isSaving === config.key;

            return (
              <div
                key={config.key}
                className="p-6 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="text-base font-medium text-gray-900">
                    {config.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {config.description}
                  </p>
                </div>

                {config.type === 'boolean' && (
                  <button
                    type="button"
                    onClick={() => handleToggle(config.key)}
                    disabled={isSavingThis}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      value === true ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={value === true}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        value === true ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    >
                      {isSavingThis && (
                        <Loader2 className="w-3 h-3 absolute top-1 left-1 animate-spin text-gray-400" />
                      )}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 안내 */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">설정 안내</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 변경된 설정은 즉시 적용됩니다.</li>
          <li>• 출납 서명 필수 설정을 활성화하면, 지급 완료 처리 시 반드시 서명을 선택해야 합니다.</li>
        </ul>
      </div>
    </div>
  );
}
