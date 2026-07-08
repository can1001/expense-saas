'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Users, HardDrive, TrendingUp, ArrowRight, AlertCircle } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  isActive: boolean;
  currentUsers: number;
  maxUsers: number;
  createdAt: string;
}

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalStorage: number;
}

export default function PlatformDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalStorage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/platform/tenants');
        if (!response.ok) throw new Error('데이터 조회 실패');

        const data = await response.json();
        setTenants(data.tenants || []);

        // 통계 계산
        const activeTenants = data.tenants.filter((t: Tenant) => t.isActive);
        setStats({
          totalTenants: data.tenants.length,
          activeTenants: activeTenants.length,
          totalUsers: data.tenants.reduce((sum: number, t: Tenant) => sum + t.currentUsers, 0),
          totalStorage: 0, // TODO: 실제 스토리지 사용량 계산
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 조회 중 오류 발생');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          <div className="h-64 bg-gray-200 rounded-xl" />
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체 테넌트</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTenants}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">활성 테넌트</p>
              <p className="text-3xl font-bold text-green-600">{stats.activeTenants}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체 사용자</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">스토리지 사용</p>
              <p className="text-3xl font-bold text-gray-900">-</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <HardDrive className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 최근 테넌트 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">테넌트 목록</h2>
          <Link
            href="/platform/tenants"
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            전체 보기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {tenants.length === 0 ? (
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
                    서브도메인
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요금제
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.slice(0, 5).map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/platform/tenants/${tenant.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600"
                      >
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tenant.subdomain}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPlanBadgeColor(
                          tenant.plan
                        )}`}
                      >
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tenant.currentUsers} / {tenant.maxUsers}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          tenant.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {tenant.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
