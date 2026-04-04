'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
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
import { useRoles, getYearRoleOptions } from '@/hooks/useRoles';

interface User {
  id: string;
  userid: string;
  username: string;
  role: string;
  department: string | null;
  isActive: boolean;
}

interface YearRole {
  id: string;
  userId: string;
  year: number;
  role: string;
  department: string | null;
  user?: User;
}

interface UserWithYearRole extends User {
  yearRole?: string;
  yearDepartment?: string;
}

interface BudgetItem {
  committee: string;
  department: string;
}

export default function YearRolesPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [users, setUsers] = useState<UserWithYearRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, { role: string; department: string }>>({});

  // Role 테이블에서 역할 정보 가져오기
  const { roles, getRoleName } = useRoles();

  // 연도별 역할 옵션 (admin, user 제외)
  const yearRoleOptions = useMemo(() => {
    const options = getYearRoleOptions(roles);
    return [{ value: '', label: '(선택 안함)' }, ...options];
  }, [roles]);

  // 일괄 역할 옵션 (선택 안함 제외)
  const bulkRoleOptions = useMemo(() => {
    return getYearRoleOptions(roles);
  }, [roles]);

  // 체크박스 선택 상태
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState('team_leader');
  const [bulkCommittee, setBulkCommittee] = useState('');
  const [bulkDepartment, setBulkDepartment] = useState('');

  // 위원회/부서 목록
  const [committees, setCommittees] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);

  // 개별 행 위원회/부서 선택 상태
  const [rowCommittees, setRowCommittees] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setChanges({});
    setSelectedUsers(new Set());
    setRowCommittees({});

    try {
      // 사용자 목록, 연도별 역할, 예산 데이터 동시 조회
      const [usersRes, yearRolesRes, budgetRes] = await Promise.all([
        fetch('/api/users?pageSize=1000&isActive=true'),
        fetch(`/api/users/year-roles?year=${selectedYear}`),
        fetch('/api/budget'),
      ]);

      if (!usersRes.ok || !yearRolesRes.ok || !budgetRes.ok) {
        throw new Error('데이터 조회 실패');
      }

      const usersData = await usersRes.json();
      const yearRolesData = await yearRolesRes.json();
      const budgetData = await budgetRes.json();

      // 예산 데이터에서 위원회/부서 목록 추출
      const items: BudgetItem[] = budgetData.items || [];
      setBudgetItems(items);
      setCommittees(budgetData.hierarchy?.committees || []);

      // 연도별 역할을 userId로 매핑
      const yearRoleMap = new Map<string, YearRole>();
      yearRolesData.yearRoles?.forEach((yr: YearRole) => {
        yearRoleMap.set(yr.userId, yr);
      });

      // 사용자에 연도별 역할 정보 추가
      const usersWithRoles: UserWithYearRole[] = usersData.users
        .filter((u: User) => u.role !== 'admin') // admin은 제외 (영구 역할)
        .map((user: User) => {
          const yearRole = yearRoleMap.get(user.id);
          return {
            ...user,
            yearRole: yearRole?.role ?? '',
            yearDepartment: yearRole?.department ?? '',
          };
        });

      setUsers(usersWithRoles);

      // 기존 부서 데이터로 rowCommittees 초기화
      const initialRowCommittees: Record<string, string> = {};
      usersWithRoles.forEach((user) => {
        if (user.yearDepartment) {
          // 부서에서 위원회 찾기
          const matchingItem = items.find((item) => item.department === user.yearDepartment);
          if (matchingItem) {
            initialRowCommittees[user.id] = matchingItem.committee;
          }
        }
      });
      setRowCommittees(initialRowCommittees);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  // 일괄 적용 위원회 변경 시 부서 목록 업데이트
  useEffect(() => {
    if (bulkCommittee) {
      const filteredDepts = Array.from(
        new Set(
          budgetItems
            .filter((item) => item.committee === bulkCommittee)
            .map((item) => item.department)
        )
      );
      setDepartments(filteredDepts);
      setBulkDepartment('');
    } else {
      setDepartments([]);
      setBulkDepartment('');
    }
  }, [bulkCommittee, budgetItems]);

  // 특정 위원회에 대한 부서 목록 가져오기
  const getDepartmentsForCommittee = (committee: string): string[] => {
    return Array.from(
      new Set(
        budgetItems
          .filter((item) => item.committee === committee)
          .map((item) => item.department)
      )
    );
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = (userId: string, role: string) => {
    setChanges((prev) => ({
      ...prev,
      [userId]: {
        role,
        department: prev[userId]?.department ?? users.find((u) => u.id === userId)?.yearDepartment ?? '',
      },
    }));
  };

  const handleDepartmentChange = (userId: string, department: string) => {
    setChanges((prev) => ({
      ...prev,
      [userId]: {
        role: prev[userId]?.role ?? users.find((u) => u.id === userId)?.yearRole ?? '',
        department,
      },
    }));
  };

  const handleRowCommitteeChange = (userId: string, committee: string) => {
    setRowCommittees((prev) => ({
      ...prev,
      [userId]: committee,
    }));
    // 위원회 변경 시 부서 초기화
    handleDepartmentChange(userId, '');
  };

  // 체크박스 핸들러
  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  // 선택된 사용자들에게 일괄 역할 적용
  const handleApplyBulkRole = () => {
    if (selectedUsers.size === 0) {
      setError('선택된 사용자가 없습니다.');
      return;
    }

    const newChanges = { ...changes };
    const newRowCommittees = { ...rowCommittees };

    selectedUsers.forEach((userId) => {
      const user = users.find((u) => u.id === userId);
      newChanges[userId] = {
        role: bulkRole,
        department: bulkDepartment || user?.yearDepartment || '',
      };
      if (bulkCommittee) {
        newRowCommittees[userId] = bulkCommittee;
      }
    });

    setChanges(newChanges);
    setRowCommittees(newRowCommittees);

    const deptInfo = bulkDepartment ? ` / ${bulkDepartment}` : '';
    setSuccess(`${selectedUsers.size}명에게 ${getRoleName(bulkRole)}${deptInfo} 역할이 적용되었습니다. "변경사항 저장"을 클릭하세요.`);
  };

  const handleSaveAll = async () => {
    const changedEntries = Object.entries(changes);
    if (changedEntries.length === 0) {
      setError('변경된 내용이 없습니다.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const [userId, { role, department }] of changedEntries) {
        if (!role) {
          skippedCount++; // 역할이 없으면 건너뜀
          continue;
        }

        try {
          const response = await fetch('/api/users/year-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              year: selectedYear,
              role,
              department: department || undefined,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            const errorData = await response.json().catch(() => ({}));
            console.error(`Failed to save year role for ${userId}:`, errorData);
          }
        } catch (err) {
          errorCount++;
          console.error(`Error saving year role for ${userId}:`, err);
        }
      }

      if (errorCount > 0) {
        setError(`${errorCount}건 저장 실패 (콘솔에서 상세 오류 확인)`);
      }
      if (successCount > 0) {
        const skippedMsg = skippedCount > 0 ? ` (역할 미선택 ${skippedCount}건 건너뜀)` : '';
        setSuccess(`${successCount}건 저장 완료${skippedMsg}`);
        fetchData(); // 데이터 새로고침
      } else if (skippedCount > 0 && errorCount === 0) {
        setError(`역할이 선택되지 않아 ${skippedCount}건 모두 건너뛰었습니다. 역할을 먼저 선택해주세요.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromPreviousYear = async () => {
    if (!confirm(`${selectedYear - 1}년 역할을 ${selectedYear}년으로 복사하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 이전 연도 역할 조회
      const prevYearRes = await fetch(`/api/users/year-roles?year=${selectedYear - 1}`);
      if (!prevYearRes.ok) throw new Error('이전 연도 데이터 조회 실패');

      const prevYearData = await prevYearRes.json();
      const prevYearRoles: YearRole[] = prevYearData.yearRoles ?? [];

      if (prevYearRoles.length === 0) {
        setError(`${selectedYear - 1}년 역할 데이터가 없습니다.`);
        setLoading(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const yr of prevYearRoles) {
        try {
          const response = await fetch('/api/users/year-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: yr.userId,
              year: selectedYear,
              role: yr.role,
              department: yr.department,
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
        setError(`${errorCount}건 복사 실패`);
      }
      setSuccess(`${successCount}건 복사 완료`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '복사 실패');
    } finally {
      setLoading(false);
    }
  };

  const getRoleValue = (user: UserWithYearRole) => {
    return changes[user.id]?.role ?? user.yearRole ?? '';
  };

  const getDepartmentValue = (user: UserWithYearRole) => {
    return changes[user.id]?.department ?? user.yearDepartment ?? '';
  };

  const hasChanges = Object.keys(changes).length > 0;
  const isAllSelected = users.length > 0 && selectedUsers.size === users.length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">연도별 역할 관리</h1>
        <Link href="/admin" className={BTN_OUTLINE}>
          관리 홈
        </Link>
      </div>

      {/* 연도 선택 및 액션 */}
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

          <button
            onClick={handleCopyFromPreviousYear}
            disabled={loading}
            className={BTN_OUTLINE}
          >
            {selectedYear - 1}년에서 복사
          </button>

          <div className="flex-1" />

          <button
            onClick={handleSaveAll}
            disabled={saving || !hasChanges}
            className={`${BTN_SUCCESS} disabled:opacity-50`}
          >
            {saving && <div className={SPINNER}></div>}
            {saving ? '저장 중...' : `변경사항 저장 (${Object.keys(changes).length}건)`}
          </button>
        </div>
      </div>

      {/* 일괄 역할 적용 */}
      <div className={`${SECTION_CARD} mb-6 bg-orange-50 border-orange-200`}>
        <h3 className="text-lg font-semibold text-orange-800 mb-3">일괄 역할 적용</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">역할 선택</label>
            <select
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              className={`${SELECT_BASE} w-48`}
            >
              {bulkRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">위원회</label>
            <select
              value={bulkCommittee}
              onChange={(e) => setBulkCommittee(e.target.value)}
              className={`${SELECT_BASE} w-40`}
            >
              <option value="">선택</option>
              {committees.map((committee) => (
                <option key={committee} value={committee}>
                  {committee}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사역팀(부)</label>
            <select
              value={bulkDepartment}
              onChange={(e) => setBulkDepartment(e.target.value)}
              disabled={!bulkCommittee}
              className={`${SELECT_BASE} w-40 disabled:bg-gray-100`}
            >
              <option value="">선택</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleApplyBulkRole}
            disabled={selectedUsers.size === 0}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            선택한 {selectedUsers.size}명에게 적용
          </button>

          <div className="text-sm text-orange-700">
            아래 목록에서 체크박스로 사용자를 선택한 후 &quot;적용&quot; 버튼을 클릭하세요.
          </div>
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
        <p><strong>연도별 역할 설정 안내:</strong></p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>관리자(admin)는 영구 역할이므로 목록에 표시되지 않습니다.</li>
          <li>역할: 팀장(1차 결재) → 회계(2차 결재) → 재정팀장(3차 결재)</li>
          <li>행정간사는 결재 권한 없이 지출관리/엑셀 다운로드 권한을 가집니다.</li>
          <li>변경 후 &quot;변경사항 저장&quot; 버튼을 클릭해야 저장됩니다.</li>
        </ul>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className={`${FLEX_CENTER} py-20`}>
          <div className={SPINNER_LG}></div>
        </div>
      ) : (
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>{selectedYear}년 역할 설정</h2>

          <div className="overflow-x-auto">
            <table className={TABLE_BASE}>
              <thead className={TABLE_HEADER}>
                <tr>
                  <th className={`${TABLE_HEADER_CELL} w-12`}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className={TABLE_HEADER_CELL}>아이디</th>
                  <th className={TABLE_HEADER_CELL}>이름</th>
                  <th className={TABLE_HEADER_CELL}>기본 역할</th>
                  <th className={TABLE_HEADER_CELL}>{selectedYear}년 역할</th>
                  <th className={TABLE_HEADER_CELL}>위원회</th>
                  <th className={TABLE_HEADER_CELL}>사역팀(부)</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${TABLE_CELL} text-center text-gray-500 py-10`}>
                      활성 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isChanged = user.id in changes;
                    const isSelected = selectedUsers.has(user.id);
                    const userCommittee = rowCommittees[user.id] || '';
                    const userDepts = userCommittee ? getDepartmentsForCommittee(userCommittee) : [];
                    return (
                      <tr
                        key={user.id}
                        className={`${isChanged ? 'bg-yellow-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className={TABLE_CELL}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                            className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className={TABLE_CELL}>{user.userid}</td>
                        <td className={TABLE_CELL}>{user.username}</td>
                        <td className={TABLE_CELL}>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            {getRoleName(user.role)}
                          </span>
                        </td>
                        <td className={TABLE_CELL}>
                          <select
                            value={getRoleValue(user)}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`${SELECT_BASE} ${BTN_SM} w-44`}
                          >
                            {yearRoleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={TABLE_CELL}>
                          <select
                            value={userCommittee}
                            onChange={(e) => handleRowCommitteeChange(user.id, e.target.value)}
                            className={`${SELECT_BASE} ${BTN_SM} w-28`}
                          >
                            <option value="">선택</option>
                            {committees.map((committee) => (
                              <option key={committee} value={committee}>
                                {committee}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={TABLE_CELL}>
                          <select
                            value={getDepartmentValue(user)}
                            onChange={(e) => handleDepartmentChange(user.id, e.target.value)}
                            disabled={!userCommittee}
                            className={`${SELECT_BASE} ${BTN_SM} w-32 disabled:bg-gray-100`}
                          >
                            <option value="">선택</option>
                            {userDepts.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 하단 저장 버튼 */}
          {users.length > 10 && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveAll}
                disabled={saving || !hasChanges}
                className={`${BTN_SUCCESS} disabled:opacity-50`}
              >
                {saving && <div className={SPINNER}></div>}
                {saving ? '저장 중...' : `변경사항 저장 (${Object.keys(changes).length}건)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
