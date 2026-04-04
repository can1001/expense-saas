'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Download, ArrowRight, Info } from 'lucide-react';
import { SECTION_CARD, BTN_OUTLINE, BTN_SM, SELECT_BASE } from '@/lib/constants/styles';

interface User {
  id: string;
  username: string;
  userid: string;
}

interface ExceptionData {
  year: number;
  summary: {
    totalDetails: number;
    exceptionCount: number;
    exceptionRate: number;
  };
  exceptions: Array<{
    budgetDetailId: string;
    budgetDetailYearId: string;
    committee: string;
    department: string;
    category: string;
    subcategory: string;
    detail: string;
    teamLeader: { id: string; name: string } | null;
    manager: { id: string; name: string };
  }>;
}

export default function ManagerExceptionsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<ExceptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCommittee, setFilterCommittee] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [exceptionsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/manager-exceptions?year=${year}`),
        fetch('/api/users?isActive=true&pageSize=200'),
      ]);
      if (!exceptionsRes.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const result = await exceptionsRes.json();
      setData(result);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeamLeader = async (department: string, userId: string) => {
    if (!userId) return;

    setAssigning(department);
    try {
      const response = await fetch('/api/users/year-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          year,
          role: 'team_leader',
          department,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '팀장 지정에 실패했습니다.');
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '팀장 지정 중 오류가 발생했습니다.');
    } finally {
      setAssigning(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  // 위원회 목록 추출
  const committees = data
    ? Array.from(new Set(data.exceptions.map((e) => e.committee))).sort()
    : [];

  // 필터링된 예외 목록
  const filteredExceptions = data
    ? filterCommittee
      ? data.exceptions.filter((e) => e.committee === filterCommittee)
      : data.exceptions
    : [];

  const handleExport = () => {
    if (!data) return;

    const headers = ['위원회', '사역팀', '예산(항)', '예산(목)', '세목', '팀장', '담당자'];
    const rows = data.exceptions.map((e) => [
      e.committee,
      e.department,
      e.category,
      e.subcategory,
      e.detail,
      e.teamLeader?.name || '미지정',
      e.manager.name,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `담당자예외현황_${year}년.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">담당자 예외 현황</h1>
          <p className="text-gray-600 mt-1">세목별 담당자가 해당 사역팀장과 다른 케이스 목록</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className={`${SELECT_BASE} w-28`}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <button onClick={fetchData} className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-2`}>
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <button
            onClick={handleExport}
            disabled={!data || data.exceptions.length === 0}
            className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-2`}
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* 요약 */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  전체 {data.summary.totalDetails}개 세목 중{' '}
                  <span className="text-amber-600">{data.summary.exceptionCount}개</span> 예외
                </p>
                <p className="text-sm text-gray-500">예외 비율: {data.summary.exceptionRate}%</p>
              </div>
            </div>
          </div>

          {data.exceptions.length === 0 ? (
            <div className="text-center py-12 bg-green-50 rounded-lg">
              <p className="text-green-600 font-medium">모든 세목의 담당자가 팀장과 일치합니다.</p>
            </div>
          ) : (
            <>
              {/* 필터 */}
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">위원회 필터:</label>
                <select
                  value={filterCommittee}
                  onChange={(e) => setFilterCommittee(e.target.value)}
                  className={`${SELECT_BASE} w-40`}
                >
                  <option value="">전체</option>
                  {committees.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {filterCommittee && (
                  <span className="text-sm text-gray-500">
                    {filteredExceptions.length}건
                  </span>
                )}
              </div>

              {/* 예외 목록 테이블 */}
              <div className={SECTION_CARD}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">예외 케이스 목록</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 font-medium">위원회</th>
                        <th className="pb-3 font-medium">사역팀</th>
                        <th className="pb-3 font-medium">세목</th>
                        <th className="pb-3 font-medium">팀장</th>
                        <th className="pb-3 font-medium"></th>
                        <th className="pb-3 font-medium">담당자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExceptions.map((exception) => (
                        <tr
                          key={`${exception.budgetDetailYearId}-${exception.department}`}
                          className="border-b hover:bg-amber-50"
                        >
                          <td className="py-3 text-gray-600">{exception.committee}</td>
                          <td className="py-3 text-gray-600">{exception.department}</td>
                          <td className="py-3">
                            <div>
                              <p className="font-medium text-gray-900">{exception.detail}</p>
                              <p className="text-xs text-gray-400">
                                {exception.category} &gt; {exception.subcategory}
                              </p>
                            </div>
                          </td>
                          <td className="py-3">
                            {exception.teamLeader ? (
                              <span className="text-gray-600">{exception.teamLeader.name}</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  className={`${SELECT_BASE} text-xs py-1 px-2 min-w-[120px]`}
                                  defaultValue=""
                                  disabled={assigning === exception.department}
                                  onChange={(e) =>
                                    handleAssignTeamLeader(exception.department, e.target.value)
                                  }
                                >
                                  <option value="" disabled>
                                    팀장 선택
                                  </option>
                                  {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.username}
                                    </option>
                                  ))}
                                </select>
                                {assigning === exception.department && (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3">
                            <ArrowRight className="w-4 h-4 text-amber-500" />
                          </td>
                          <td className="py-3">
                            <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded font-medium">
                              {exception.manager.name}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">담당자 예외 안내</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>예외 케이스는 세목의 담당자가 해당 사역팀의 팀장과 다른 경우입니다.</li>
                  <li>예: 공간사역팀 인건비의 담당자가 재정팀장인 경우</li>
                  <li>
                    <strong>팀장 미지정</strong> 시 드롭다운에서 팀장을 직접 지정할 수 있습니다.
                  </li>
                  <li>담당자 변경은 [예산 편성 → 세목별 담당자] 메뉴에서 가능합니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
