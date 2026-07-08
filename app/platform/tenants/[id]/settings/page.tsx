'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Palette,
  Bell,
  Receipt,
  Shield,
  CheckCircle,
  Save,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface TenantSettings {
  theme: {
    primaryColor: string;
    accentColor: string;
    logoPosition: 'left' | 'center';
    darkModeEnabled: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    emailOnNewExpense: boolean;
    emailOnApproval: boolean;
    emailOnRejection: boolean;
    pushEnabled: boolean;
    pushOnNewExpense: boolean;
    pushOnApproval: boolean;
  };
  expense: {
    requireAttachment: boolean;
    requireDescription: boolean;
    allowDraftSave: boolean;
    maxItemsPerExpense: number;
    defaultCurrency: string;
  };
  approval: {
    autoApproveUnderAmount: number;
    requireAllApprovers: boolean;
    allowSelfApproval: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    requirePasswordChange: boolean;
    passwordChangeIntervalDays: number;
    twoFactorEnabled: boolean;
  };
}

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
}

const PRESET_COLORS = [
  '#4f46e5', // Indigo
  '#2563eb', // Blue
  '#0891b2', // Cyan
  '#059669', // Emerald
  '#ca8a04', // Yellow
  '#ea580c', // Orange
  '#dc2626', // Red
  '#9333ea', // Purple
  '#64748b', // Slate
];

export default function TenantSettingsPage() {
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [defaults, setDefaults] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'theme' | 'notifications' | 'expense' | 'approval' | 'security'>('theme');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/platform/tenants/${tenantId}/settings`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('테넌트를 찾을 수 없습니다.');
          }
          throw new Error('설정 조회 실패');
        }
        const data = await response.json();
        setTenant(data.tenant);
        setSettings(data.settings);
        setDefaults(data.defaults);
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 조회 중 오류 발생');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [tenantId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '설정 저장 실패');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (defaults && confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
      setSettings(defaults);
    }
  };

  const updateSettings = <K extends keyof TenantSettings>(
    category: K,
    key: keyof TenantSettings[K],
    value: TenantSettings[K][keyof TenantSettings[K]]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href={`/platform/tenants/${tenantId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          테넌트 상세로
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-red-900">오류 발생</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  const tabs = [
    { id: 'theme', label: '테마', icon: Palette },
    { id: 'notifications', label: '알림', icon: Bell },
    { id: 'expense', label: '지출결의', icon: Receipt },
    { id: 'approval', label: '결재', icon: CheckCircle },
    { id: 'security', label: '보안', icon: Shield },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/platform/tenants/${tenantId}`}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">테넌트 설정</h1>
            <p className="text-sm text-gray-500 mt-1">{tenant?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 성공/에러 메시지 */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">설정이 저장되었습니다.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* 테마 설정 */}
          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">메인 컬러</h3>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSettings('theme', 'primaryColor', color)}
                      className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                        settings.theme.primaryColor === color
                          ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-900'
                          : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={settings.theme.primaryColor}
                    onChange={(e) => updateSettings('theme', 'primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-full cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">로고 위치</h3>
                <div className="flex gap-3">
                  {(['left', 'center'] as const).map((position) => (
                    <button
                      key={position}
                      onClick={() => updateSettings('theme', 'logoPosition', position)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        settings.theme.logoPosition === position
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {position === 'left' ? '왼쪽' : '가운데'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">다크 모드 지원</h3>
                  <p className="text-xs text-gray-500 mt-1">사용자가 다크 모드를 선택할 수 있습니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.theme.darkModeEnabled}
                    onChange={(e) => updateSettings('theme', 'darkModeEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>
          )}

          {/* 알림 설정 */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">이메일 알림</h3>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">이메일 알림 활성화</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailEnabled}
                      onChange={(e) => updateSettings('notifications', 'emailEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>

                {settings.notifications.emailEnabled && (
                  <div className="ml-4 space-y-3 border-l-2 border-gray-100 pl-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailOnNewExpense}
                        onChange={(e) => updateSettings('notifications', 'emailOnNewExpense', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">새 지출결의서 등록 시</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailOnApproval}
                        onChange={(e) => updateSettings('notifications', 'emailOnApproval', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">결재 승인 시</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailOnRejection}
                        onChange={(e) => updateSettings('notifications', 'emailOnRejection', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">결재 반려 시</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">푸시 알림</h3>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">푸시 알림 활성화</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.pushEnabled}
                      onChange={(e) => updateSettings('notifications', 'pushEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>

                {settings.notifications.pushEnabled && (
                  <div className="ml-4 space-y-3 border-l-2 border-gray-100 pl-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.notifications.pushOnNewExpense}
                        onChange={(e) => updateSettings('notifications', 'pushOnNewExpense', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">새 지출결의서 등록 시</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.notifications.pushOnApproval}
                        onChange={(e) => updateSettings('notifications', 'pushOnApproval', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600">결재 완료 시</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 지출결의 설정 */}
          {activeTab === 'expense' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">첨부파일 필수</h3>
                  <p className="text-xs text-gray-500 mt-1">지출결의서 작성 시 첨부파일을 필수로 요구합니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.expense.requireAttachment}
                    onChange={(e) => updateSettings('expense', 'requireAttachment', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">적요 필수</h3>
                  <p className="text-xs text-gray-500 mt-1">각 항목에 적요 입력을 필수로 요구합니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.expense.requireDescription}
                    onChange={(e) => updateSettings('expense', 'requireDescription', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">임시저장 허용</h3>
                  <p className="text-xs text-gray-500 mt-1">작성 중인 지출결의서를 임시저장할 수 있습니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.expense.allowDraftSave}
                    onChange={(e) => updateSettings('expense', 'allowDraftSave', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">최대 항목 수</h3>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.expense.maxItemsPerExpense}
                  onChange={(e) => updateSettings('expense', 'maxItemsPerExpense', parseInt(e.target.value) || 20)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-500">개</span>
              </div>
            </div>
          )}

          {/* 결재 설정 */}
          {activeTab === 'approval' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">자동 승인 금액</h3>
                <p className="text-xs text-gray-500 mb-3">이 금액 이하의 지출결의서는 결재 없이 자동 승인됩니다 (0 = 비활성)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={settings.approval.autoApproveUnderAmount}
                    onChange={(e) => updateSettings('approval', 'autoApproveUnderAmount', parseInt(e.target.value) || 0)}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-500">원</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">모든 결재자 필수</h3>
                  <p className="text-xs text-gray-500 mt-1">결재선의 모든 결재자가 승인해야 최종 승인됩니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.approval.requireAllApprovers}
                    onChange={(e) => updateSettings('approval', 'requireAllApprovers', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">본인 결재 허용</h3>
                  <p className="text-xs text-gray-500 mt-1">작성자가 결재선에 포함된 경우 본인 결재를 허용합니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.approval.allowSelfApproval}
                    onChange={(e) => updateSettings('approval', 'allowSelfApproval', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>
          )}

          {/* 보안 설정 */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">세션 타임아웃</h3>
                <p className="text-xs text-gray-500 mb-3">사용자 비활동 시 자동 로그아웃되는 시간</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={settings.security.sessionTimeoutMinutes}
                    onChange={(e) => updateSettings('security', 'sessionTimeoutMinutes', parseInt(e.target.value) || 60)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-500">분</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">주기적 비밀번호 변경</h3>
                  <p className="text-xs text-gray-500 mt-1">사용자에게 주기적으로 비밀번호 변경을 요구합니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.security.requirePasswordChange}
                    onChange={(e) => updateSettings('security', 'requirePasswordChange', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              {settings.security.requirePasswordChange && (
                <div className="ml-4 border-l-2 border-gray-100 pl-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">변경 주기</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={settings.security.passwordChangeIntervalDays}
                      onChange={(e) => updateSettings('security', 'passwordChangeIntervalDays', parseInt(e.target.value) || 90)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-500">일</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">2단계 인증 (준비 중)</h3>
                  <p className="text-xs text-gray-500 mt-1">로그인 시 추가 인증을 요구합니다</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={settings.security.twoFactorEnabled}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
