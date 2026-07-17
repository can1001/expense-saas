'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_OUTLINE,
  BTN_SUCCESS,
  BTN_SM,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  SELECT_BASE,
  SPINNER_LG,
  SPINNER,
  FLEX_CENTER,
  ALERT_ERROR,
} from '@/lib/constants/styles';
import { useRoles } from '@/hooks/useRoles';
import { useOrgTerms } from '@/lib/contexts/TenantContext';
import { apiBase } from '@/lib/api/api-base';

interface User {
  id: string;
  userid: string;
  username: string;
}

interface YearRole {
  id: string;
  userId: string;
  year: number;
  role: string;
  department: string | null;
  user?: User;
}

interface BudgetItem {
  committee: string;
  department: string;
}

interface DepartmentRoles {
  committee: string;
  department: string;
  teamLeader?: { user: User; yearRole: YearRole };
  accountant?: { user: User; yearRole: YearRole };
  financeHead?: { user: User; yearRole: YearRole };
  adminAssistant?: { user: User; yearRole: YearRole };
}

// 변경 사항 추적용 타입
interface RoleChange {
  department: string;
  role: 'team_leader' | 'accountant' | 'finance_head' | 'admin_assistant';
  userId: string;
}

export default function YearRolesSummaryPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Role 테이블에서 역할 정보 가져오기
  const { getRoleColor } = useRoles();
  const terms = useOrgTerms();

  const [departmentRoles, setDepartmentRoles] = useState<DepartmentRoles[]>([]);
  const [committees, setCommittees] = useState<string[]>([]);
  const [selectedCommittee, setSelectedCommittee] = useState<string>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // 글로벌 역할 (부서 무관)
  const [globalRoles, setGlobalRoles] = useState<{
    accountant?: { user: User; yearRole: YearRole };
    financeHead?: { user: User; yearRole: YearRole };
    adminAssistant?: { user: User; yearRole: YearRole };
  }>({});

  // 변경 사항 추적
  const [changes, setChanges] = useState<RoleChange[]>([]);

  // 통계
  const [stats, setStats] = useState({
    totalTeamLeaders: 0,
    totalAccountants: 0,
    totalFinanceHeads: 0,
    totalAdminAssistants: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setChanges([]);

    try {
      // 연도별 역할, 예산 데이터, 사용자 목록 조회
      const [yearRolesRes, budgetRes, usersRes] = await Promise.all([
        fetch(`/api/users/year-roles?year=${selectedYear}`),
        fetch(`${apiBase('budget')}/budget`),
        fetch('/api/users?pageSize=1000&isActive=true'),
      ]);

      if (!yearRolesRes.ok || !budgetRes.ok || !usersRes.ok) {
        throw new Error('데이터 조회 실패');
      }

      const yearRolesData = await yearRolesRes.json();
      const budgetData = await budgetRes.json();
      const usersData = await usersRes.json();

      const yearRoles: YearRole[] = yearRolesData.yearRoles || [];
      const budgetItems: BudgetItem[] = budgetData.items || [];
      const users: User[] = usersData.users?.filter((u: User & { role: string }) => u.role !== 'admin') || [];

      setAllUsers(users);

      // 위원회 목록
      const uniqueCommittees = Array.from(new Set(budgetItems.map((item) => item.committee)));
      setCommittees(uniqueCommittees);

      // 위원회/부서별 고유 목록 생성
      const deptMap = new Map<string, DepartmentRoles>();
      budgetItems.forEach((item) => {
        const key = `${item.committee}|${item.department}`;
        if (!deptMap.has(key)) {
          deptMap.set(key, {
            committee: item.committee,
            department: item.department,
          });
        }
      });

      // 연도별 역할을 부서별로 매핑
      yearRoles.forEach((yr) => {
        if (!yr.department || !yr.user) return;

        // 부서와 매칭되는 항목 찾기
        deptMap.forEach((deptRole) => {
          if (deptRole.department === yr.department) {
            const user = yr.user!;
            const roleData = { user, yearRole: yr };

            switch (yr.role) {
              case 'team_leader':
                deptRole.teamLeader = roleData;
                break;
              case 'accountant':
                deptRole.accountant = roleData;
                break;
              case 'finance_head':
                deptRole.financeHead = roleData;
                break;
              case 'admin_assistant':
                deptRole.adminAssistant = roleData;
                break;
            }
          }
        });
      });

      const deptRolesArray = Array.from(deptMap.values());
      setDepartmentRoles(deptRolesArray);

      // 글로벌 역할 추출 (accountant, finance_head, admin_assistant는 모든 부서에 표시)
      const globalRoleData: {
        accountant?: { user: User; yearRole: YearRole };
        financeHead?: { user: User; yearRole: YearRole };
        adminAssistant?: { user: User; yearRole: YearRole };
      } = {};
      yearRoles.forEach((yr) => {
        if (!yr.user) return;
        // 글로벌 역할 (부서 상관없이 추출)
        const roleData = { user: yr.user!, yearRole: yr };
        switch (yr.role) {
          case 'accountant':
            if (!globalRoleData.accountant) globalRoleData.accountant = roleData;
            break;
          case 'finance_head':
            if (!globalRoleData.financeHead) globalRoleData.financeHead = roleData;
            break;
          case 'admin_assistant':
            if (!globalRoleData.adminAssistant) globalRoleData.adminAssistant = roleData;
            break;
        }
      });
      setGlobalRoles(globalRoleData);

      // 통계 계산
      let teamLeaders = 0;
      let accountants = 0;
      let financeHeads = 0;
      let adminAssistants = 0;

      yearRoles.forEach((yr) => {
        switch (yr.role) {
          case 'team_leader':
            teamLeaders++;
            break;
          case 'accountant':
            accountants++;
            break;
          case 'finance_head':
            financeHeads++;
            break;
          case 'admin_assistant':
            adminAssistants++;
            break;
        }
      });

      setStats({
        totalTeamLeaders: teamLeaders,
        totalAccountants: accountants,
        totalFinanceHeads: financeHeads,
        totalAdminAssistants: adminAssistants,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 역할 변경 핸들러
  const handleRoleChange = (
    department: string,
    role: 'team_leader' | 'accountant' | 'finance_head' | 'admin_assistant',
    userId: string
  ) => {
    // 기존 변경사항에서 같은 department/role 조합 제거 후 추가
    setChanges((prev) => {
      const filtered = prev.filter((c) => !(c.department === department && c.role === role));
      if (userId) {
        return [...filtered, { department, role, userId }];
      }
      return filtered;
    });
  };

  // 현재 선택된 값 가져오기 (변경사항 우선)
  const getCurrentValue = (
    dept: DepartmentRoles,
    role: 'team_leader' | 'accountant' | 'finance_head' | 'admin_assistant'
  ): string => {
    const change = changes.find((c) => c.department === dept.department && c.role === role);
    if (change) return change.userId;

    // 부서별 역할 확인, 없으면 글로벌 역할 fallback
    switch (role) {
      case 'team_leader':
        return dept.teamLeader?.user.id || '';
      case 'accountant':
        return dept.accountant?.user.id || globalRoles.accountant?.user.id || '';
      case 'finance_head':
        return dept.financeHead?.user.id || globalRoles.financeHead?.user.id || '';
      case 'admin_assistant':
        return dept.adminAssistant?.user.id || globalRoles.adminAssistant?.user.id || '';
    }
  };

  // 저장
  const handleSave = async () => {
    if (changes.length === 0) {
      setError('변경된 내용이 없습니다.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const change of changes) {
        try {
          const response = await fetch('/api/users/year-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: change.userId,
              year: selectedYear,
              role: change.role,
              department: change.department,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (errorCount > 0) {
        setError(`${errorCount}건 저장 실패`);
      }
      if (successCount > 0) {
        setSuccess(`${successCount}건 저장 완료`);
        fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // 필터링된 데이터
  const filteredDeptRoles = selectedCommittee
    ? departmentRoles.filter((dr) => dr.committee === selectedCommittee)
    : departmentRoles;

  // 위원회별 그룹화
  const groupedByCommittee = filteredDeptRoles.reduce(
    (acc, dr) => {
      if (!acc[dr.committee]) {
        acc[dr.committee] = [];
      }
      acc[dr.committee].push(dr);
      return acc;
    },
    {} as Record<string, DepartmentRoles[]>
  );

  const hasChanges = changes.length > 0;

  // 드롭다운 컴포넌트
  const RoleSelect = ({
    dept,
    role,
    colorClass,
  }: {
    dept: DepartmentRoles;
    role: 'team_leader' | 'accountant' | 'finance_head' | 'admin_assistant';
    colorClass: string;
  }) => {
    const currentUserId = getCurrentValue(dept, role);
    const isChanged = changes.some((c) => c.department === dept.department && c.role === role);

    // 글로벌 역할 사용 여부 확인 (부서별 역할이 없고 글로벌 역할로 채워진 경우)
    const getDeptRoleUserId = () => {
      switch (role) {
        case 'team_leader': return dept.teamLeader?.user.id;
        case 'accountant': return dept.accountant?.user.id;
        case 'finance_head': return dept.financeHead?.user.id;
        case 'admin_assistant': return dept.adminAssistant?.user.id;
      }
    };
    const isGlobalRole = role !== 'team_leader' && !getDeptRoleUserId() && currentUserId && !isChanged;

    return (
      <div className="relative inline-block">
        <select
          value={currentUserId}
          onChange={(e) => handleRoleChange(dept.department, role, e.target.value)}
          className={`${SELECT_BASE} ${BTN_SM} w-28 text-xs ${isChanged ? 'ring-2 ring-yellow-400' : ''} ${
            currentUserId ? colorClass : 'bg-gray-50'
          }`}
        >
          <option value="">선택</option>
          {allUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
        {isGlobalRole && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" title="글로벌 역할" />
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">연도별 팀장 현황</h1>
        <div className="flex gap-2">
          <Link href="/admin/year-roles" className={BTN_OUTLINE}>
            역할 관리
          </Link>
          <Link href="/admin" className={BTN_OUTLINE}>
            관리 홈
          </Link>
        </div>
      </div>

      {/* 필터 및 저장 */}
      <div className={`${SECTION_CARD} mb-6`}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={`${SELECT_BASE} w-32`}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{terms.committee}</label>
            <select
              value={selectedCommittee}
              onChange={(e) => setSelectedCommittee(e.target.value)}
              className={`${SELECT_BASE} w-40`}
            >
              <option value="">전체</option>
              {committees.map((committee) => (
                <option key={committee} value={committee}>
                  {committee}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`${BTN_SUCCESS} disabled:opacity-50`}
          >
            {saving && <div className={SPINNER}></div>}
            {saving ? '저장 중...' : `변경사항 저장 (${changes.length}건)`}
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${SECTION_CARD} text-center`}>
          <div className="text-3xl font-bold text-green-600">{stats.totalTeamLeaders}</div>
          <div className="text-sm text-gray-600 mt-1">팀장 (1차 결재)</div>
        </div>
        <div className={`${SECTION_CARD} text-center`}>
          <div className="text-3xl font-bold text-blue-600">{stats.totalAccountants}</div>
          <div className="text-sm text-gray-600 mt-1">회계 (2차 결재)</div>
        </div>
        <div className={`${SECTION_CARD} text-center`}>
          <div className="text-3xl font-bold text-purple-600">{stats.totalFinanceHeads}</div>
          <div className="text-sm text-gray-600 mt-1">재정팀장 (3차 결재)</div>
        </div>
        <div className={`${SECTION_CARD} text-center`}>
          <div className="text-3xl font-bold text-yellow-600">{stats.totalAdminAssistants}</div>
          <div className="text-sm text-gray-600 mt-1">행정간사</div>
        </div>
      </div>

      {/* 알림 메시지 */}
      {error && <div className={`${ALERT_ERROR} mb-4`}>{error}</div>}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm">
        <p>각 셀의 드롭다운에서 담당자를 선택하고 &quot;변경사항 저장&quot; 버튼을 클릭하세요. 노란색 테두리는 변경된 항목입니다.</p>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className={`${FLEX_CENTER} py-20`}>
          <div className={SPINNER_LG}></div>
        </div>
      ) : (
        <>
          {/* 위원회별 테이블 */}
          {Object.entries(groupedByCommittee).map(([committee, depts]) => (
            <div key={committee} className={`${SECTION_CARD} mb-6`}>
              <h2 className={SECTION_TITLE}>{committee}</h2>

              <div className="overflow-x-auto">
                <table className={TABLE_BASE}>
                  <thead className={TABLE_HEADER}>
                    <tr>
                      <th className={TABLE_HEADER_CELL}>{terms.departmentFull}</th>
                      <th className={`${TABLE_HEADER_CELL} text-center`}>
                        <span className={`px-2 py-1 text-xs rounded ${getRoleColor('team_leader').bg} ${getRoleColor('team_leader').text}`}>팀장 (1차)</span>
                      </th>
                      <th className={`${TABLE_HEADER_CELL} text-center`}>
                        <span className={`px-2 py-1 text-xs rounded ${getRoleColor('accountant').bg} ${getRoleColor('accountant').text}`}>회계 (2차)</span>
                      </th>
                      <th className={`${TABLE_HEADER_CELL} text-center`}>
                        <span className={`px-2 py-1 text-xs rounded ${getRoleColor('finance_head').bg} ${getRoleColor('finance_head').text}`}>재정팀장 (3차)</span>
                      </th>
                      <th className={`${TABLE_HEADER_CELL} text-center`}>
                        <span className={`px-2 py-1 text-xs rounded ${getRoleColor('admin_assistant').bg} ${getRoleColor('admin_assistant').text}`}>행정간사</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {depts.map((dept) => (
                      <tr key={`${dept.committee}-${dept.department}`}>
                        <td className={`${TABLE_CELL} font-medium`}>{dept.department}</td>
                        <td className={`${TABLE_CELL} text-center`}>
                          <RoleSelect dept={dept} role="team_leader" colorClass={`${getRoleColor('team_leader').bg} ${getRoleColor('team_leader').text}`} />
                        </td>
                        <td className={`${TABLE_CELL} text-center`}>
                          <RoleSelect dept={dept} role="accountant" colorClass={`${getRoleColor('accountant').bg} ${getRoleColor('accountant').text}`} />
                        </td>
                        <td className={`${TABLE_CELL} text-center`}>
                          <RoleSelect dept={dept} role="finance_head" colorClass={`${getRoleColor('finance_head').bg} ${getRoleColor('finance_head').text}`} />
                        </td>
                        <td className={`${TABLE_CELL} text-center`}>
                          <RoleSelect dept={dept} role="admin_assistant" colorClass={`${getRoleColor('admin_assistant').bg} ${getRoleColor('admin_assistant').text}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* 하단 저장 버튼 */}
          {departmentRoles.length > 5 && (
            <div className="flex justify-end mb-6">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`${BTN_SUCCESS} disabled:opacity-50`}
              >
                {saving && <div className={SPINNER}></div>}
                {saving ? '저장 중...' : `변경사항 저장 (${changes.length}건)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
