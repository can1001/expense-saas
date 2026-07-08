'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, User, AlertCircle, Check } from 'lucide-react';

interface FormData {
  name: string;
  subdomain: string;
  customDomain: string;
  orgType: string;
  description: string;
  plan: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

const ORG_TYPES = [
  { value: 'CHURCH', label: '교회' },
  { value: 'NONPROFIT', label: '비영리 단체' },
  { value: 'SCHOOL', label: '학교' },
  { value: 'COMPANY', label: '기업' },
  { value: 'OTHER', label: '기타' },
];

const PLANS = [
  { value: 'FREE', label: 'Free', description: '10명, 1GB 스토리지' },
  { value: 'BASIC', label: 'Basic', description: '50명, 10GB 스토리지' },
  { value: 'PRO', label: 'Pro', description: '200명, 50GB 스토리지' },
  { value: 'ENTERPRISE', label: 'Enterprise', description: '무제한' },
];

export default function NewTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    subdomain: '',
    customDomain: '',
    orgType: 'CHURCH',
    description: '',
    plan: 'FREE',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  });

  const [subdomainChecked, setSubdomainChecked] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 서브도메인 변경 시 검증 상태 초기화
    if (name === 'subdomain') {
      setSubdomainChecked(null);
    }
  };

  const checkSubdomain = async () => {
    if (!formData.subdomain || formData.subdomain.length < 3) {
      setError('서브도메인은 최소 3자 이상이어야 합니다.');
      return;
    }

    setCheckingSubdomain(true);
    setError('');

    try {
      // 단순히 생성 API를 호출하여 중복 확인 (실제로는 별도 API가 좋음)
      const response = await fetch(`/api/platform/tenants?search=${formData.subdomain}`);
      const data = await response.json();

      const exists = data.tenants?.some(
        (t: { subdomain: string }) => t.subdomain === formData.subdomain
      );

      setSubdomainChecked(!exists);
      if (exists) {
        setError('이미 사용 중인 서브도메인입니다.');
      }
    } catch {
      setError('서브도메인 확인 중 오류가 발생했습니다.');
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 관리자 정보 검증
    const hasAdminInfo = formData.adminEmail || formData.adminName || formData.adminPassword;
    if (hasAdminInfo) {
      if (!formData.adminEmail || !formData.adminName || !formData.adminPassword) {
        setError('관리자 정보를 입력하려면 이메일, 이름, 비밀번호를 모두 입력해야 합니다.');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          subdomain: formData.subdomain,
          customDomain: formData.customDomain || null,
          orgType: formData.orgType,
          description: formData.description || null,
          plan: formData.plan,
          adminEmail: formData.adminEmail || undefined,
          adminName: formData.adminName || undefined,
          adminPassword: formData.adminPassword || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || '테넌트 생성 실패');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/platform/tenants');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-green-900 mb-2">테넌트 생성 완료</h2>
          <p className="text-green-700">테넌트 목록 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href="/platform/tenants"
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">테넌트 생성</h1>
          <p className="text-sm text-gray-500 mt-1">새로운 조직을 등록합니다.</p>
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
                placeholder="예: 청연교회"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 서브도메인 */}
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-1">
                서브도메인 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    id="subdomain"
                    name="subdomain"
                    value={formData.subdomain}
                    onChange={handleChange}
                    required
                    placeholder="chungyeon"
                    pattern="^[a-z0-9]([a-z0-9-]*[a-z0-9])?$"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-32"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    .expense-saas.com
                  </span>
                </div>
                <button
                  type="button"
                  onClick={checkSubdomain}
                  disabled={checkingSubdomain || !formData.subdomain}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {checkingSubdomain ? '확인 중...' : '중복 확인'}
                </button>
              </div>
              {subdomainChecked === true && (
                <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  사용 가능한 서브도메인입니다.
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                영문 소문자, 숫자, 하이픈만 사용 가능합니다.
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
                      <p className="text-xs text-gray-500">{plan.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 설명 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                설명 (선택)
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="조직에 대한 간략한 설명"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* 커스텀 도메인 */}
            <div>
              <label
                htmlFor="customDomain"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                커스텀 도메인 (선택)
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
              <p className="mt-1 text-xs text-gray-500">
                자체 도메인을 사용하려면 DNS 설정이 필요합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 관리자 계정 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">관리자 계정 (선택)</h2>
              <p className="text-sm text-gray-500">
                테넌트 생성 시 초기 관리자 계정을 함께 생성합니다.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* 관리자 이메일 */}
            <div>
              <label
                htmlFor="adminEmail"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                관리자 이메일 (로그인 ID)
              </label>
              <input
                type="email"
                id="adminEmail"
                name="adminEmail"
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="admin@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 관리자 이름 */}
            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
                관리자 이름
              </label>
              <input
                type="text"
                id="adminName"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                placeholder="홍길동"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 관리자 비밀번호 */}
            <div>
              <label
                htmlFor="adminPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                관리자 비밀번호
              </label>
              <input
                type="password"
                id="adminPassword"
                name="adminPassword"
                value={formData.adminPassword}
                onChange={handleChange}
                placeholder="최소 8자 이상"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                비밀번호는 최소 8자 이상이어야 합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          <Link
            href="/platform/tenants"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '생성 중...' : '테넌트 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}
