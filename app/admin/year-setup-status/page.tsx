'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, Wallet, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import {
  BTN_OUTLINE,
  BTN_DANGER,
  INPUT_BASE,
  SECTION_CARD,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface RoleBreakdown {
  role: string;
  count: number;
}

interface SetupStatus {
  year: number;
  summary: {
    roleSetup: {
      total: number;
      completed: number;
      rate: number;
      breakdown: RoleBreakdown[];
    };
    managerAssignment: {
      total: number;
      completed: number;
      rate: number;
    };
    budgetInput: {
      total: number;
      completed: number;
      rate: number;
      totalAmount: number;
    };
  };
  missing: {
    roles: { id: string; username: string; userid: string }[];
    managers: {
      id: string;
      name: string;
      committee: string;
      department: string;
      category: string;
      subcategory: string;
    }[];
    budgets: {
      id: string;
      name: string;
      committee: string;
      department: string;
      category: string;
      subcategory: string;
    }[];
  };
}

const ROLE_LABELS: Record<string, string> = {
  committee_chair: '위원장',
  department_head: '팀장',
  budget_manager: '담당자',
  finance_head: '재정팀장',
  senior_pastor: '담임목사',
};

export default function YearSetupStatusPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<'all' | 'roles' | 'budgets'>('all');
  const [resetting, setResetting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/year-setup-status?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [year]);

  const handleReset = async () => {
    if (!confirm(`정말로 ${year}년 ${resetTarget === 'all' ? '전체' : resetTarget === 'roles' ? '역할' : '예산'} 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(`/api/admin/year-config/${year}?target=${resetTarget}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const data = await res.json();
        alert(`삭제 완료:\n${data.result.yearRolesDeleted !== undefined ? `- 역할: ${data.result.yearRolesDeleted}건\n` : ''}${data.result.budgetDetailYearsDeleted !== undefined ? `- 예산: ${data.result.budgetDetailYearsDeleted}건` : ''}`);
        setShowResetModal(false);
        fetchStatus();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Reset failed:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setResetting(false);
    }
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-500';
    if (rate >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusIcon = (rate: number) => {
    if (rate >= 90) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <AlertCircle className="w-5 h-5 text-orange-500" />;
  };

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} py-20`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-20 text-gray-500">
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">연도별 설정 현황</h1>
          <p className="text-gray-600 mt-1">역할, 담당자, 예산 설정 완료율을 확인합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={`${INPUT_BASE} w-28`}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <button onClick={fetchStatus} className={`${BTN_OUTLINE} flex items-center gap-2`}>
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <button
            onClick={() => setShowResetModal(true)}
            className={`${BTN_OUTLINE} flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50`}
          >
            <Trash2 className="w-4 h-4" />
            데이터 초기화
          </button>
        </div>
      </div>

      {/* 초기화 모달 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {year}년 데이터 초기화
            </h3>
            <p className="text-gray-600 mb-4">
              삭제할 데이터 유형을 선택하세요. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="resetTarget"
                  value="all"
                  checked={resetTarget === 'all'}
                  onChange={(e) => setResetTarget(e.target.value as 'all')}
                  className="w-4 h-4 text-red-600"
                />
                <div>
                  <div className="font-medium">전체 삭제</div>
                  <div className="text-sm text-gray-500">역할 + 예산 모두 삭제</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="resetTarget"
                  value="roles"
                  checked={resetTarget === 'roles'}
                  onChange={(e) => setResetTarget(e.target.value as 'roles')}
                  className="w-4 h-4 text-red-600"
                />
                <div>
                  <div className="font-medium">역할만 삭제</div>
                  <div className="text-sm text-gray-500">사용자 연도별 역할 삭제</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="resetTarget"
                  value="budgets"
                  checked={resetTarget === 'budgets'}
                  onChange={(e) => setResetTarget(e.target.value as 'budgets')}
                  className="w-4 h-4 text-red-600"
                />
                <div>
                  <div className="font-medium">예산만 삭제</div>
                  <div className="text-sm text-gray-500">담당자/예산금액 삭제</div>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className={BTN_OUTLINE}
                disabled={resetting}
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className={`${BTN_DANGER} flex items-center gap-2`}
              >
                {resetting ? '삭제 중...' : '삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* 역할 설정 */}
        <div className={SECTION_CARD}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold">역할 설정</h3>
            </div>
            {getStatusIcon(status.summary.roleSetup.rate)}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>{status.summary.roleSetup.completed} / {status.summary.roleSetup.total}명</span>
                <span className="font-semibold">{status.summary.roleSetup.rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getProgressColor(status.summary.roleSetup.rate)}`}
                  style={{ width: `${status.summary.roleSetup.rate}%` }}
                ></div>
              </div>
            </div>
            {status.summary.roleSetup.breakdown.length > 0 && (
              <div className="pt-2 border-t text-sm text-gray-600">
                {status.summary.roleSetup.breakdown.map((r) => (
                  <div key={r.role} className="flex justify-between">
                    <span>{ROLE_LABELS[r.role] || r.role}</span>
                    <span>{r.count}명</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 담당자 지정 */}
        <div className={SECTION_CARD}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold">담당자 지정</h3>
            </div>
            {getStatusIcon(status.summary.managerAssignment.rate)}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>{status.summary.managerAssignment.completed} / {status.summary.managerAssignment.total}개</span>
                <span className="font-semibold">{status.summary.managerAssignment.rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getProgressColor(status.summary.managerAssignment.rate)}`}
                  style={{ width: `${status.summary.managerAssignment.rate}%` }}
                ></div>
              </div>
            </div>
            <p className="text-xs text-gray-500 pt-2 border-t">
              세목별 담당자(1차 결재자) 지정 현황
            </p>
          </div>
        </div>

        {/* 예산 입력 */}
        <div className={SECTION_CARD}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold">예산 입력</h3>
            </div>
            {getStatusIcon(status.summary.budgetInput.rate)}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>{status.summary.budgetInput.completed} / {status.summary.budgetInput.total}개</span>
                <span className="font-semibold">{status.summary.budgetInput.rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getProgressColor(status.summary.budgetInput.rate)}`}
                  style={{ width: `${status.summary.budgetInput.rate}%` }}
                ></div>
              </div>
            </div>
            <div className="pt-2 border-t text-sm text-gray-600">
              <div className="flex justify-between">
                <span>총 예산액</span>
                <span className="font-semibold">{formatAmount(status.summary.budgetInput.totalAmount)}원</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 미완료 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 역할 미지정 사용자 */}
        {status.missing.roles.length > 0 && (
          <div className={SECTION_CARD}>
            <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              역할 미지정 사용자
            </h3>
            <ul className="space-y-2 text-sm">
              {status.missing.roles.map((user) => (
                <li key={user.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                  <span>{user.username}</span>
                  <span className="text-gray-400 text-xs">{user.userid}</span>
                </li>
              ))}
            </ul>
            {status.missing.roles.length >= 10 && (
              <p className="text-xs text-gray-500 mt-2">* 상위 10명만 표시</p>
            )}
            <a
              href="/admin/year-roles"
              className="block mt-3 text-center text-sm text-blue-600 hover:underline"
            >
              역할 관리로 이동 →
            </a>
          </div>
        )}

        {/* 담당자 미지정 세목 */}
        {status.missing.managers.length > 0 && (
          <div className={SECTION_CARD}>
            <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              담당자 미지정 세목
            </h3>
            <ul className="space-y-2 text-sm">
              {status.missing.managers.map((item) => (
                <li key={item.id} className="p-2 bg-orange-50 rounded">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">
                    {item.committee} &gt; {item.department}
                  </div>
                </li>
              ))}
            </ul>
            {status.missing.managers.length >= 10 && (
              <p className="text-xs text-gray-500 mt-2">* 상위 10개만 표시</p>
            )}
            <a
              href="/admin/budget-managers"
              className="block mt-3 text-center text-sm text-blue-600 hover:underline"
            >
              담당자 관리로 이동 →
            </a>
          </div>
        )}

        {/* 예산 미입력 세목 */}
        {status.missing.budgets.length > 0 && (
          <div className={SECTION_CARD}>
            <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              예산 미입력 세목
            </h3>
            <ul className="space-y-2 text-sm">
              {status.missing.budgets.map((item) => (
                <li key={item.id} className="p-2 bg-orange-50 rounded">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">
                    {item.committee} &gt; {item.department}
                  </div>
                </li>
              ))}
            </ul>
            {status.missing.budgets.length >= 10 && (
              <p className="text-xs text-gray-500 mt-2">* 상위 10개만 표시</p>
            )}
            <a
              href="/admin/budget-managers"
              className="block mt-3 text-center text-sm text-blue-600 hover:underline"
            >
              예산 관리로 이동 →
            </a>
          </div>
        )}

        {/* 모든 설정 완료 */}
        {status.missing.roles.length === 0 &&
          status.missing.managers.length === 0 &&
          status.missing.budgets.length === 0 && (
            <div className={`${SECTION_CARD} col-span-full`}>
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-green-700">모든 설정이 완료되었습니다!</h3>
                <p className="text-gray-500 mt-1">{year}년 역할, 담당자, 예산 설정이 모두 완료되었습니다.</p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
