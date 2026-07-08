'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Globe,
  Shield,
  Sliders,
  AlertTriangle,
  Mail,
  Save,
  RotateCcw,
  Check,
  Loader2,
} from 'lucide-react';

interface PlatformSettings {
  general?: {
    platformName?: string;
    platformDomain?: string;
    supportEmail?: string;
    logoUrl?: string;
    faviconUrl?: string;
    footerText?: string;
  };
  security?: {
    defaultSessionTimeoutMinutes?: number;
    defaultPasswordMinLength?: number;
    requirePasswordUppercase?: boolean;
    requirePasswordNumber?: boolean;
    requirePasswordSpecial?: boolean;
    maxLoginAttempts?: number;
    lockoutDurationMinutes?: number;
  };
  defaults?: {
    defaultPlan?: string;
    defaultOrgType?: string;
    trialDays?: number;
    autoCreateAdminRole?: boolean;
  };
  maintenance?: {
    enabled?: boolean;
    message?: string;
    allowedIPs?: string[];
    scheduledStart?: string;
    scheduledEnd?: string;
  };
  email?: {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpFromEmail?: string;
    smtpFromName?: string;
  };
}

type TabId = 'general' | 'security' | 'defaults' | 'maintenance' | 'email';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: '일반', icon: <Globe className="w-4 h-4" /> },
  { id: 'security', label: '보안', icon: <Shield className="w-4 h-4" /> },
  { id: 'defaults', label: '기본값', icon: <Sliders className="w-4 h-4" /> },
  { id: 'maintenance', label: '점검', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'email', label: '이메일', icon: <Mail className="w-4 h-4" /> },
];

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [defaults, setDefaults] = useState<PlatformSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/platform/settings');
      if (!response.ok) throw new Error('설정을 불러올 수 없습니다.');

      const data = await response.json();
      setSettings(data.settings);
      setDefaults(data.defaults);
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/platform/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '저장에 실패했습니다.');
      }

      const data = await response.json();
      setSettings(data.settings);
      setSuccess('설정이 저장되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
      setSettings(defaults);
    }
  };

  const updateSetting = <T extends keyof PlatformSettings>(
    section: T,
    key: keyof NonNullable<PlatformSettings[T]>,
    value: unknown
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/platform/dashboard"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">플랫폼 설정</h1>
            <p className="text-sm text-gray-500">
              전역 플랫폼 설정을 관리합니다
              {updatedAt && (
                <span className="ml-2">
                  · 마지막 수정: {new Date(updatedAt).toLocaleString('ko-KR')}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            기본값
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            저장
          </button>
        </div>
      </div>

      {/* 알림 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 flex items-center gap-2">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* 일반 설정 */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  플랫폼 이름
                </label>
                <input
                  type="text"
                  value={settings.general?.platformName || ''}
                  onChange={(e) => updateSetting('general', 'platformName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Expense SaaS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  플랫폼 도메인
                </label>
                <input
                  type="text"
                  value={settings.general?.platformDomain || ''}
                  onChange={(e) => updateSetting('general', 'platformDomain', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="expense-saas.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  고객지원 이메일
                </label>
                <input
                  type="email"
                  value={settings.general?.supportEmail || ''}
                  onChange={(e) => updateSetting('general', 'supportEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="support@expense-saas.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  로고 URL
                </label>
                <input
                  type="url"
                  value={settings.general?.logoUrl || ''}
                  onChange={(e) => updateSetting('general', 'logoUrl', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  푸터 텍스트
                </label>
                <textarea
                  value={settings.general?.footerText || ''}
                  onChange={(e) => updateSetting('general', 'footerText', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="© 2024 Expense SaaS. All rights reserved."
                />
              </div>
            </div>
          )}

          {/* 보안 설정 */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기본 세션 타임아웃 (분)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={settings.security?.defaultSessionTimeoutMinutes || 60}
                    onChange={(e) =>
                      updateSetting('security', 'defaultSessionTimeoutMinutes', parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최소 비밀번호 길이
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={32}
                    value={settings.security?.defaultPasswordMinLength || 8}
                    onChange={(e) =>
                      updateSetting('security', 'defaultPasswordMinLength', parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최대 로그인 시도 횟수
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={settings.security?.maxLoginAttempts || 5}
                    onChange={(e) =>
                      updateSetting('security', 'maxLoginAttempts', parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    계정 잠금 시간 (분)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.security?.lockoutDurationMinutes || 15}
                    onChange={(e) =>
                      updateSetting('security', 'lockoutDurationMinutes', parseInt(e.target.value))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">비밀번호 요구사항</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.requirePasswordUppercase ?? true}
                      onChange={(e) =>
                        updateSetting('security', 'requirePasswordUppercase', e.target.checked)
                      }
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">대문자 포함 필수</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.requirePasswordNumber ?? true}
                      onChange={(e) =>
                        updateSetting('security', 'requirePasswordNumber', e.target.checked)
                      }
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">숫자 포함 필수</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.requirePasswordSpecial ?? false}
                      onChange={(e) =>
                        updateSetting('security', 'requirePasswordSpecial', e.target.checked)
                      }
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">특수문자 포함 필수</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 기본값 설정 */}
          {activeTab === 'defaults' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기본 요금제
                  </label>
                  <select
                    value={settings.defaults?.defaultPlan || 'FREE'}
                    onChange={(e) => updateSetting('defaults', 'defaultPlan', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="FREE">FREE</option>
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기본 조직 유형
                  </label>
                  <select
                    value={settings.defaults?.defaultOrgType || 'CHURCH'}
                    onChange={(e) => updateSetting('defaults', 'defaultOrgType', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="CHURCH">교회</option>
                    <option value="NONPROFIT">비영리</option>
                    <option value="SCHOOL">학교</option>
                    <option value="COMPANY">기업</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    체험 기간 (일)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={settings.defaults?.trialDays || 14}
                    onChange={(e) => updateSetting('defaults', 'trialDays', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.defaults?.autoCreateAdminRole ?? true}
                    onChange={(e) =>
                      updateSetting('defaults', 'autoCreateAdminRole', e.target.checked)
                    }
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    새 테넌트 생성 시 기본 역할 자동 생성
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* 점검 모드 설정 */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div>
                  <h3 className="font-medium text-yellow-800">점검 모드</h3>
                  <p className="text-sm text-yellow-700">
                    활성화 시 플랫폼 관리자를 제외한 모든 사용자의 접근이 차단됩니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintenance?.enabled ?? false}
                    onChange={(e) => updateSetting('maintenance', 'enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  점검 메시지
                </label>
                <textarea
                  value={settings.maintenance?.message || ''}
                  onChange={(e) => updateSetting('maintenance', 'message', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="시스템 점검 중입니다. 잠시 후 다시 시도해 주세요."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    예정 시작 시간
                  </label>
                  <input
                    type="datetime-local"
                    value={settings.maintenance?.scheduledStart || ''}
                    onChange={(e) => updateSetting('maintenance', 'scheduledStart', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    예정 종료 시간
                  </label>
                  <input
                    type="datetime-local"
                    value={settings.maintenance?.scheduledEnd || ''}
                    onChange={(e) => updateSetting('maintenance', 'scheduledEnd', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  허용 IP 주소 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={settings.maintenance?.allowedIPs?.join(', ') || ''}
                  onChange={(e) =>
                    updateSetting(
                      'maintenance',
                      'allowedIPs',
                      e.target.value.split(',').map((ip) => ip.trim()).filter(Boolean)
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="192.168.1.1, 10.0.0.1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  점검 모드에서도 접근을 허용할 IP 주소를 입력하세요.
                </p>
              </div>
            </div>
          )}

          {/* 이메일 설정 */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700">
                  이메일 설정은 시스템 알림 및 비밀번호 재설정 메일 발송에 사용됩니다.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP 호스트
                  </label>
                  <input
                    type="text"
                    value={settings.email?.smtpHost || ''}
                    onChange={(e) => updateSetting('email', 'smtpHost', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP 포트
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={settings.email?.smtpPort || 587}
                    onChange={(e) => updateSetting('email', 'smtpPort', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP 사용자
                  </label>
                  <input
                    type="text"
                    value={settings.email?.smtpUser || ''}
                    onChange={(e) => updateSetting('email', 'smtpUser', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    발신자 이메일
                  </label>
                  <input
                    type="email"
                    value={settings.email?.smtpFromEmail || ''}
                    onChange={(e) => updateSetting('email', 'smtpFromEmail', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="noreply@expense-saas.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    발신자 이름
                  </label>
                  <input
                    type="text"
                    value={settings.email?.smtpFromName || ''}
                    onChange={(e) => updateSetting('email', 'smtpFromName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Expense SaaS"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
