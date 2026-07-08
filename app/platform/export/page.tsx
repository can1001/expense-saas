'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Building2,
  Users,
  Receipt,
  Activity,
  UserCog,
  FileSpreadsheet,
  FileJson,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
}

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  supportsTenantFilter: boolean;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'tenants',
    label: '테넌트 목록',
    description: '모든 테넌트의 기본 정보, 요금제, 사용량 등',
    icon: <Building2 className="w-6 h-6" />,
    supportsTenantFilter: false,
  },
  {
    id: 'users',
    label: '사용자 목록',
    description: '사용자 계정 정보, 역할, 부서, 활성 상태 등',
    icon: <Users className="w-6 h-6" />,
    supportsTenantFilter: true,
  },
  {
    id: 'expenses',
    label: '지출결의서',
    description: '지출결의서 기본 정보, 금액, 상태 등 (최대 10,000건)',
    icon: <Receipt className="w-6 h-6" />,
    supportsTenantFilter: true,
  },
  {
    id: 'activity-logs',
    label: '활동 로그',
    description: '플랫폼 관리자 활동 기록 (최대 10,000건)',
    icon: <Activity className="w-6 h-6" />,
    supportsTenantFilter: false,
  },
  {
    id: 'admins',
    label: '관리자 목록',
    description: '플랫폼 관리자 계정 정보',
    icon: <UserCog className="w-6 h-6" />,
    supportsTenantFilter: false,
  },
];

export default function ExportPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // 선택 상태
  const [selectedType, setSelectedType] = useState('tenants');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv');
  const [selectedTenantId, setSelectedTenantId] = useState('');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/platform/tenants?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch {
      // 테넌트 목록 로드 실패는 무시
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(selectedType);
    setError('');
    setSuccess('');

    try {
      const params = new URLSearchParams();
      params.set('type', selectedType);
      params.set('format', selectedFormat);
      if (selectedTenantId) {
        params.set('tenantId', selectedTenantId);
      }

      const response = await fetch(`/api/platform/export?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '내보내기에 실패했습니다.');
      }

      if (selectedFormat === 'json') {
        // JSON은 새 탭에서 표시
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // CSV 다운로드
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccess('파일이 다운로드되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setExporting(null);
    }
  };

  const currentOption = EXPORT_OPTIONS.find(o => o.id === selectedType);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href="/platform/dashboard"
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">데이터 내보내기</h1>
          <p className="text-sm text-gray-500">플랫폼 데이터를 CSV 또는 JSON 형식으로 내보냅니다</p>
        </div>
      </div>

      {/* 알림 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 text-green-700">
          <Check className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 내보내기 옵션 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">내보낼 데이터 선택</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EXPORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setSelectedType(option.id);
                  if (!option.supportsTenantFilter) {
                    setSelectedTenantId('');
                  }
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedType === option.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      selectedType === option.id
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{option.label}</h3>
                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 옵션 패널 */}
        <div className="space-y-6">
          {/* 포맷 선택 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">파일 형식</h3>
            <div className="space-y-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedFormat === 'csv'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={selectedFormat === 'csv'}
                  onChange={() => setSelectedFormat('csv')}
                  className="w-4 h-4 text-indigo-600"
                />
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">CSV</p>
                  <p className="text-xs text-gray-500">Excel 호환</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedFormat === 'json'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={selectedFormat === 'json'}
                  onChange={() => setSelectedFormat('json')}
                  className="w-4 h-4 text-indigo-600"
                />
                <FileJson className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-gray-900">JSON</p>
                  <p className="text-xs text-gray-500">개발자용</p>
                </div>
              </label>
            </div>
          </div>

          {/* 테넌트 필터 */}
          {currentOption?.supportsTenantFilter && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">테넌트 필터 (선택)</h3>
              {loading ? (
                <div className="text-center text-gray-500 py-4">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : (
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">전체 테넌트</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.subdomain})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 내보내기 버튼 */}
          <button
            onClick={handleExport}
            disabled={!!exporting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {exporting === selectedType ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                내보내는 중...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                내보내기
              </>
            )}
          </button>

          {/* 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-700">
              <strong>참고:</strong> CSV 파일은 Excel에서 바로 열 수 있습니다.
              한글이 깨지는 경우 UTF-8 인코딩으로 열어주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
