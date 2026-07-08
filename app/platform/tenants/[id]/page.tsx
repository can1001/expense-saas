'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Users,
  HardDrive,
  Calendar,
  ExternalLink,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  Pencil,
} from 'lucide-react';

interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  orgType: string;
  description: string | null;
  logoUrl: string | null;
  plan: string;
  planStartAt: string | null;
  planEndAt: string | null;
  maxUsers: number;
  maxStorageMB: number;
  currentUsers: number;
  currentStorage: number;
  isActive: boolean;
  suspendedAt: string | null;
  suspendReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenantStats {
  totalExpenses: number;
  totalUsers: number;
  activeUsers: number;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        // 테넌트 정보 조회
        const response = await fetch(`/api/platform/tenants/${tenantId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('테넌트를 찾을 수 없습니다.');
          }
          throw new Error('테넌트 조회 실패');
        }
        const data = await response.json();
        setTenant(data.tenant);

        // 통계 조회
        const statsResponse = await fetch(`/api/platform/tenants/${tenantId}/stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 조회 중 오류 발생');
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantId]);

  const handleToggleStatus = async () => {
    if (!tenant) return;
    if (!confirm(`정말로 이 테넌트를 ${tenant.isActive ? '비활성화' : '활성화'}하시겠습니까?`)) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !tenant.isActive,
          suspendReason: tenant.isActive ? '관리자에 의한 일시 중지' : null,
        }),
      });

      if (!response.ok) throw new Error('상태 변경 실패');

      const data = await response.json();
      setTenant(data.tenant);
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    if (!confirm(`정말로 "${tenant.name}" 테넌트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('삭제 실패');

      router.push('/platform/tenants');
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setActionLoading(false);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'ENTERPRISE':
        return 'bg-purple-100 text-purple-700';
      case 'PRO':
        return 'bg-blue-100 text-blue-700';
      case 'BASIC':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getOrgTypeName = (orgType: string) => {
    switch (orgType) {
      case 'CHURCH':
        return '교회';
      case 'NONPROFIT':
        return '비영리';
      case 'SCHOOL':
        return '학교';
      case 'COMPANY':
        return '기업';
      default:
        return '기타';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="h-48 bg-gray-200 rounded-xl mb-6" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="space-y-6">
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/platform/tenants"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500">{tenant.subdomain}.expense-saas.com</span>
              <a
                href={`https://${tenant.subdomain}.expense-saas.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/platform/tenants/${tenantId}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            수정
          </Link>
          <button
            onClick={handleToggleStatus}
            disabled={actionLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              tenant.isActive
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } ${actionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {tenant.isActive ? (
              <>
                <Pause className="w-4 h-4" />
                일시 중지
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                활성화
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors ${
              actionLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      </div>

      {/* 상태 알림 */}
      {!tenant.isActive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">이 테넌트는 현재 비활성화 상태입니다</p>
            {tenant.suspendReason && (
              <p className="text-sm text-yellow-700">사유: {tenant.suspendReason}</p>
            )}
          </div>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-gray-500">조직 유형</label>
            <p className="mt-1 font-medium text-gray-900">{getOrgTypeName(tenant.orgType)}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">요금제</label>
            <p className="mt-1">
              <span
                className={`px-2.5 py-1 text-sm font-medium rounded-full ${getPlanBadgeColor(
                  tenant.plan
                )}`}
              >
                {tenant.plan}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">상태</label>
            <p className="mt-1">
              <span
                className={`px-2.5 py-1 text-sm font-medium rounded-full ${
                  tenant.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {tenant.isActive ? '활성' : '비활성'}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">생성일</label>
            <p className="mt-1 font-medium text-gray-900">
              {new Date(tenant.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          {tenant.description && (
            <div className="md:col-span-2">
              <label className="text-sm text-gray-500">설명</label>
              <p className="mt-1 text-gray-900">{tenant.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* 사용량 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900">사용자</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {tenant.currentUsers}
            <span className="text-lg text-gray-400"> / {tenant.maxUsers}</span>
          </p>
          <div className="w-full h-2 bg-gray-200 rounded-full mt-3">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{
                width: `${Math.min((tenant.currentUsers / tenant.maxUsers) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <HardDrive className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-medium text-gray-900">스토리지</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {(tenant.currentStorage / 1024).toFixed(1)}
            <span className="text-lg text-gray-400"> / {(tenant.maxStorageMB / 1024).toFixed(0)} GB</span>
          </p>
          <div className="w-full h-2 bg-gray-200 rounded-full mt-3">
            <div
              className="h-full bg-orange-500 rounded-full"
              style={{
                width: `${Math.min((tenant.currentStorage / tenant.maxStorageMB) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-medium text-gray-900">지출결의서</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats?.totalExpenses ?? '-'}
          </p>
          <p className="text-sm text-gray-500 mt-2">총 등록 건수</p>
        </div>
      </div>

      {/* 요금제 정보 */}
      {(tenant.planStartAt || tenant.planEndAt) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">요금제 기간</h2>
          </div>
          <div className="flex gap-8">
            {tenant.planStartAt && (
              <div>
                <label className="text-sm text-gray-500">시작일</label>
                <p className="mt-1 font-medium text-gray-900">
                  {new Date(tenant.planStartAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            )}
            {tenant.planEndAt && (
              <div>
                <label className="text-sm text-gray-500">종료일</label>
                <p className="mt-1 font-medium text-gray-900">
                  {new Date(tenant.planEndAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 사용자 목록 링크 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">사용자 관리</h2>
          </div>
          <Link
            href={`/platform/tenants/${tenantId}/users`}
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            사용자 목록 보기 →
          </Link>
        </div>
        <p className="text-gray-500 mt-2">
          이 테넌트에 등록된 사용자 {tenant.currentUsers}명을 관리합니다.
        </p>
      </div>
    </div>
  );
}
