'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  HardDrive,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertCircle,
  Receipt,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface PlatformStats {
  overview: {
    tenants: {
      total: number;
      active: number;
      inactive: number;
    };
    users: {
      total: number;
      active: number;
    };
    storage: {
      totalMB: number;
      totalGB: number;
    };
    expenses: {
      total: { count: number; amount: number };
      thisMonth: { count: number; amount: number };
      thisYear: { count: number; amount: number };
      growth: number;
    };
  };
  distribution: {
    byPlan: Record<string, number>;
    byOrgType: Record<string, number>;
  };
  monthlyTrend: Array<{
    month: string;
    expenses: { count: number; amount: number };
    newTenants: number;
    newUsers: number;
  }>;
  recentTenants: Array<{
    id: string;
    name: string;
    subdomain: string;
    plan: string;
    orgType: string;
    isActive: boolean;
    currentUsers: number;
    createdAt: string;
  }>;
  alerts: {
    tenantsNearUserLimit: Array<{
      id: string;
      name: string;
      subdomain: string;
      currentUsers: number;
      maxUsers: number;
      usagePercent: number;
    }>;
  };
}

const ORG_TYPE_LABELS: Record<string, string> = {
  CHURCH: '교회',
  NONPROFIT: '비영리',
  SCHOOL: '학교',
  COMPANY: '기업',
  OTHER: '기타',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  BASIC: 'bg-green-100 text-green-700',
  PRO: 'bg-blue-100 text-blue-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
};

export default function PlatformDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/platform/stats');
        if (!response.ok) throw new Error('데이터 조회 실패');

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 조회 중 오류 발생');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gray-200 rounded-xl" />
            <div className="h-80 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-4">
        <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-900">오류 발생</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* 알림 배너 */}
      {stats.alerts.tenantsNearUserLimit.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">
              {stats.alerts.tenantsNearUserLimit.length}개 테넌트가 사용자 제한에 근접했습니다
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              {stats.alerts.tenantsNearUserLimit
                .slice(0, 3)
                .map((t) => `${t.name} (${t.usagePercent}%)`)
                .join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* 메인 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 테넌트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체 테넌트</p>
              <p className="text-3xl font-bold text-gray-900">{stats.overview.tenants.total}</p>
              <p className="text-xs text-green-600 mt-1">
                활성 {stats.overview.tenants.active}
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* 사용자 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체 사용자</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.overview.users.total)}</p>
              <p className="text-xs text-gray-500 mt-1">
                활성 {formatNumber(stats.overview.users.active)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* 이번 달 지출 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">이번 달 지출</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(stats.overview.expenses.thisMonth.amount)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {stats.overview.expenses.growth >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span
                  className={`text-xs ${
                    stats.overview.expenses.growth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  전월 대비 {stats.overview.expenses.growth > 0 ? '+' : ''}{stats.overview.expenses.growth}%
                </span>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Receipt className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* 스토리지 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">스토리지 사용</p>
              <p className="text-3xl font-bold text-gray-900">{stats.overview.storage.totalGB} GB</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.overview.expenses.total.count}건 지출결의서
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <HardDrive className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 중간 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 월별 추이 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">월별 지출 추이</h2>
          <div className="space-y-3">
            {stats.monthlyTrend.map((month) => {
              const maxAmount = Math.max(...stats.monthlyTrend.map((m) => m.expenses.amount));
              const percentage = maxAmount > 0 ? (month.expenses.amount / maxAmount) * 100 : 0;

              return (
                <div key={month.month} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-gray-600 flex-shrink-0">
                    {month.month.slice(5)}월
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-28 text-right text-sm font-medium text-gray-900">
                    {formatAmount(month.expenses.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 요금제 분포 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">요금제 분포</h2>
          <div className="space-y-4">
            {['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].map((plan) => {
              const count = stats.distribution.byPlan[plan] || 0;
              const total = stats.overview.tenants.total;
              const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={plan} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${PLAN_COLORS[plan]}`}>
                      {plan}
                    </span>
                    <span className="text-sm text-gray-600">{count}개</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-10 text-right">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 조직 유형 분포 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">조직 유형별</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.distribution.byOrgType).map(([type, count]) => (
                <span
                  key={type}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {ORG_TYPE_LABELS[type] || type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 최근 테넌트 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">최근 등록 테넌트</h2>
          </div>
          <Link
            href="/platform/tenants"
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            전체 보기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {stats.recentTenants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>등록된 테넌트가 없습니다</p>
            <Link
              href="/platform/tenants/new"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              테넌트 생성
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    조직
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요금제
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/platform/tenants/${tenant.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-gray-500">{tenant.subdomain}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ORG_TYPE_LABELS[tenant.orgType] || tenant.orgType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${PLAN_COLORS[tenant.plan]}`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tenant.currentUsers}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tenant.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 연간 요약 */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-lg font-semibold mb-4">올해 요약</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-indigo-100 text-sm">총 지출결의서</p>
            <p className="text-3xl font-bold">{formatNumber(stats.overview.expenses.thisYear.count)}건</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">총 지출 금액</p>
            <p className="text-3xl font-bold">{formatAmount(stats.overview.expenses.thisYear.amount)}</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">월 평균 지출</p>
            <p className="text-3xl font-bold">
              {formatAmount(Math.round(stats.overview.expenses.thisYear.amount / (new Date().getMonth() + 1)))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
