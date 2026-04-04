'use client';

import { useEffect, useState } from 'react';
import { GitBranch, ArrowRight, Info, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { SECTION_CARD, BTN_OUTLINE, BTN_SM, SELECT_BASE } from '@/lib/constants/styles';

interface Role {
  id: string;
  code: string;
  name: string;
  stepNumber: number | null;
  canApprove: boolean;
}

interface YearRole {
  id: string;
  userId: string;
  year: number;
  role: string;
  department: string | null;
  user: {
    id: string;
    username: string;
  };
}

export default function ApprovalRulesPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [roles, setRoles] = useState<Role[]>([]);
  const [yearRoles, setYearRoles] = useState<YearRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 역할 목록 조회
      const rolesRes = await fetch('/api/admin/roles?includeInactive=false');
      if (!rolesRes.ok) throw new Error('역할 데이터 조회 실패');
      const rolesData = await rolesRes.json();
      setRoles(rolesData.roles || []);

      // 연도별 역할 조회
      const yearRolesRes = await fetch(`/api/users/year-roles?year=${year}&includeUser=true`);
      if (!yearRolesRes.ok) throw new Error('연도별 역할 데이터 조회 실패');
      const yearRolesData = await yearRolesRes.json();
      setYearRoles(yearRolesData.yearRoles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  // 결재 단계별 역할 정리
  const step1Role = roles.find((r) => r.stepNumber === 1);
  const step2Role = roles.find((r) => r.stepNumber === 2);
  const step3Role = roles.find((r) => r.stepNumber === 3);

  // 연도별 회계/재정팀장 찾기
  const accountant = yearRoles.find((yr) => yr.role === 'accountant');
  const financeHead = yearRoles.find((yr) => yr.role === 'finance_head');

  // 팀장 목록
  const teamLeaders = yearRoles.filter((yr) => yr.role === 'team_leader');

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">결재라인 규칙</h1>
          <p className="text-gray-600 mt-1">결재 단계 및 규칙 현황 조회</p>
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

      {!loading && !error && (
        <>
          {/* 기본 결재 구조 */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <GitBranch className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">기본 결재 구조</h2>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 py-6">
              {/* 1차 결재 */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center min-w-[160px]">
                <div className="text-sm text-blue-600 font-medium mb-1">1차 결재</div>
                <div className="text-lg font-bold text-gray-900">{step1Role?.name || '담당자'}</div>
                <div className="text-xs text-gray-500 mt-2">세목별 지정</div>
              </div>

              <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />

              {/* 2차 결재 */}
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-6 text-center min-w-[160px]">
                <div className="text-sm text-indigo-600 font-medium mb-1">2차 결재</div>
                <div className="text-lg font-bold text-gray-900">{step2Role?.name || '회계'}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {accountant ? accountant.user.username : '미지정'}
                </div>
              </div>

              <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />

              {/* 3차 결재 */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 text-center min-w-[160px]">
                <div className="text-sm text-purple-600 font-medium mb-1">3차 결재</div>
                <div className="text-lg font-bold text-gray-900">{step3Role?.name || '재정팀장'}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {financeHead ? financeHead.user.username : '미지정'}
                </div>
              </div>
            </div>
          </div>

          {/* 역할별 결재 권한 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">역할별 결재 권한</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">역할</th>
                    <th className="pb-3 font-medium text-center">결재 단계</th>
                    <th className="pb-3 font-medium text-center">결재 권한</th>
                    <th className="pb-3 font-medium">{year}년 담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {roles
                    .sort((a, b) => (a.stepNumber || 99) - (b.stepNumber || 99))
                    .map((role) => {
                      const assignedUsers = yearRoles.filter((yr) => yr.role === role.code);
                      return (
                        <tr key={role.id} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            <span className="font-medium text-gray-900">{role.name}</span>
                            <span className="text-gray-400 text-xs ml-2">({role.code})</span>
                          </td>
                          <td className="py-3 text-center">
                            {role.stepNumber ? (
                              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {role.stepNumber}차
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            {role.canApprove ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3">
                            {assignedUsers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {assignedUsers.slice(0, 5).map((au) => (
                                  <span
                                    key={au.id}
                                    className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                  >
                                    {au.user.username}
                                    {au.department && (
                                      <span className="text-gray-400 ml-1">({au.department})</span>
                                    )}
                                  </span>
                                ))}
                                {assignedUsers.length > 5 && (
                                  <span className="text-xs text-gray-400">
                                    외 {assignedUsers.length - 5}명
                                  </span>
                                )}
                              </div>
                            ) : role.code === 'team_leader' ? (
                              <span className="text-gray-400 text-xs">각 세목별 담당자로 지정</span>
                            ) : (
                              <span className="text-gray-400 text-xs">미지정</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 전결 규칙 */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">전결(자동승인) 규칙</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">담당자 = 재정팀장인 경우</p>
                  <p className="text-sm text-gray-600 mt-1">
                    세목의 담당자가 재정팀장과 동일한 경우, 1차 결재가 자동 승인됩니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-lg">
                <div className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">신청자 = 담당자인 경우 (팀장 전결)</p>
                  <p className="text-sm text-gray-600 mt-1">
                    지출결의서 신청자가 해당 세목의 담당자인 경우, 1차 결재가 자동 승인됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 팀장 현황 요약 */}
          {teamLeaders.length > 0 && (
            <div className={SECTION_CARD}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {year}년 팀장 현황 ({teamLeaders.length}명)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamLeaders.map((tl) => (
                  <div key={tl.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                      {tl.user.username.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tl.user.username}</p>
                      <p className="text-xs text-gray-500">{tl.department || '부서 미지정'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">결재라인 규칙 안내</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>1차 결재자는 각 세목별로 지정된 담당자입니다.</li>
                  <li>담당자는 [예산 편성 → 세목별 담당자] 메뉴에서 관리합니다.</li>
                  <li>회계 및 재정팀장은 [사용자/역할 → 연도별 역할 설정]에서 지정합니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
