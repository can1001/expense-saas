'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Settings, AlertCircle, Check, Save } from 'lucide-react';

interface TenantData {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  orgType: string;
  description: string | null;
  logoUrl: string | null;
  plan: string;
  maxUsers: number;
  maxStorageMB: number;
  currentUsers: number;
  isActive: boolean;
}

const ORG_TYPES = [
  { value: 'CHURCH', label: '교회' },
  { value: 'NONPROFIT', label: '비영리 단체' },
  { value: 'SCHOOL', label: '학교' },
  { value: 'COMPANY', label: '기업' },
  { value: 'OTHER', label: '기타' },
];

const PLANS = [
  { value: 'FREE', label: 'Free', users: 10, storage: 1 },
  { value: 'BASIC', label: 'Basic', users: 50, storage: 10 },
  { value: 'PRO', label: 'Pro', users: 200, storage: 50 },
  { value: 'ENTERPRISE', label: 'Enterprise', users: 999999, storage: 999999 },
];

export default function EditTenantPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tenant, setTenant] = useState<TenantData | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    customDomain: '',
    orgType: 'CHURCH',
    description: '',
    logoUrl: '',
    plan: 'FREE',
    maxUsers: 10,
    maxStorageMB: 1024,
  });

  const [useCustomLimits, setUseCustomLimits] = useState(false);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const response = await fetch(`/api/platform/tenants/${tenantId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('테넌트를 찾을 수 없습니다.');
          }
          throw new Error('테넌트 조회 실패');
        }
        const data = await response.json();
        setTenant(data);

        // 폼 데이터 초기화
        setFormData({
          name: data.name || '',
          customDomain: data.customDomain || '',
          orgType: data.orgType || 'CHURCH',
          description: data.description || '',
          logoUrl: data.logoUrl || '',
          plan: data.plan || 'FREE',
          maxUsers: data.maxUsers || 10,
          maxStorageMB: data.maxStorageMB || 1024,
        });

        // 기본 제한과 다르면 커스텀 제한 사용 중
        const planDefaults = PLANS.find((p) => p.value === data.plan);
        if (
          planDefaults &&
          (data.maxUsers !== planDefaults.users ||
            data.maxStorageMB !== planDefaults.storage * 1024)
        ) {
          setUseCustomLimits(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 조회 중 오류 발생');
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 요금제 변경 시 기본 제한으로 업데이트 (커스텀 제한 미사용 시)
    if (name === 'plan' && !useCustomLimits) {
      const planDefaults = PLANS.find((p) => p.value === value);
      if (planDefaults) {
        setFormData((prev) => ({
          ...prev,
          plan: value,
          maxUsers: planDefaults.users,
          maxStorageMB: planDefaults.storage * 1024,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          customDomain: formData.customDomain || null,
          orgType: formData.orgType,
          description: formData.description || null,
          logoUrl: formData.logoUrl || null,
          plan: formData.plan,
          maxUsers: useCustomLimits ? formData.maxUsers : undefined,
          maxStorageMB: useCustomLimits ? formData.maxStorageMB : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || '수정 실패');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/platform/tenants/${tenantId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/platform/tenants"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          테넌트 목록으로
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

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-green-900 mb-2">수정 완료</h2>
          <p className="text-green-700">테넌트 상세 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href={`/platform/tenants/${tenantId}`}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">테넌트 수정</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tenant?.subdomain}.expense-saas.com
          </p>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
          </div>

          <div className="space-y-4">
            {/* 조직명 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                조직명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 서브도메인 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                서브도메인
              </label>
              <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600">
                {tenant?.subdomain}.expense-saas.com
              </div>
              <p className="mt-1 text-xs text-gray-500">
                서브도메인은 변경할 수 없습니다.
              </p>
            </div>

            {/* 조직 유형 */}
            <div>
              <label htmlFor="orgType" className="block text-sm font-medium text-gray-700 mb-1">
                조직 유형
              </label>
              <select
                id="orgType"
                name="orgType"
                value={formData.orgType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {ORG_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 설명 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* 커스텀 도메인 */}
            <div>
              <label
                htmlFor="customDomain"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                커스텀 도메인
              </label>
              <input
                type="text"
                id="customDomain"
                name="customDomain"
                value={formData.customDomain}
                onChange={handleChange}
                placeholder="expense.example.org"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 로고 URL */}
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                로고 URL
              </label>
              <input
                type="url"
                id="logoUrl"
                name="logoUrl"
                value={formData.logoUrl}
                onChange={handleChange}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 요금제 및 제한 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">요금제 및 제한</h2>
          </div>

          <div className="space-y-4">
            {/* 요금제 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">요금제</label>
              <div className="grid grid-cols-2 gap-3">
                {PLANS.map((plan) => (
                  <label
                    key={plan.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.plan === plan.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={plan.value}
                      checked={formData.plan === plan.value}
                      onChange={handleChange}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{plan.label}</p>
                      <p className="text-xs text-gray-500">
                        {plan.users === 999999
                          ? '무제한'
                          : `${plan.users}명, ${plan.storage}GB`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 커스텀 제한 토글 */}
            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomLimits}
                  onChange={(e) => setUseCustomLimits(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  사용자 정의 제한 사용
                </span>
              </label>
            </div>

            {/* 커스텀 제한 입력 */}
            {useCustomLimits && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="maxUsers"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    최대 사용자 수
                  </label>
                  <input
                    type="number"
                    id="maxUsers"
                    name="maxUsers"
                    value={formData.maxUsers}
                    onChange={handleChange}
                    min={tenant?.currentUsers || 1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    현재 {tenant?.currentUsers || 0}명 사용 중
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="maxStorageMB"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    최대 스토리지 (MB)
                  </label>
                  <input
                    type="number"
                    id="maxStorageMB"
                    name="maxStorageMB"
                    value={formData.maxStorageMB}
                    onChange={handleChange}
                    min={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {(formData.maxStorageMB / 1024).toFixed(1)} GB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          <Link
            href={`/platform/tenants/${tenantId}`}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
