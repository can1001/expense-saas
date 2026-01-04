'use client';

import { useState, useEffect, useCallback } from 'react';
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

const YEAR_ROLE_OPTIONS = [
  { value: '', label: '(선택 안함)' },
  { value: 'team_leader', label: '팀장 (1차 결재)' },
  { value: 'accountant', label: '회계 (2차 결재)' },
  { value: 'finance_head', label: '재정팀장 (3차 결재)' },
  { value: 'admin_assistant', label: '행정간사' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

export default function YearRolesPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [users, setUsers] = useState<UserWithYearRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, { role: string; department: string }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setChanges({});

    try {
      // 사용자 목록과 연도별 역할 동시 조회
      const [usersRes, yearRolesRes] = await Promise.all([
        fetch('/api/users?pageSize=1000&isActive=true'),
        fetch(`/api/users/year-roles?year=${selectedYear}`),
      ]);

      if (!usersRes.ok || !yearRolesRes.ok) {
        throw new Error('데이터 조회 실패');
      }

      const usersData = await usersRes.json();
      const yearRolesData = await yearRolesRes.json();

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
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

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

      for (const [userId, { role, department }] of changedEntries) {
        if (!role) continue; // 역할이 없으면 건너뜀

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
        fetchData(); // 데이터 새로고침
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
                  <th className={TABLE_HEADER_CELL}>아이디</th>
                  <th className={TABLE_HEADER_CELL}>이름</th>
                  <th className={TABLE_HEADER_CELL}>기본 역할</th>
                  <th className={TABLE_HEADER_CELL}>{selectedYear}년 역할</th>
                  <th className={TABLE_HEADER_CELL}>부서 (선택)</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${TABLE_CELL} text-center text-gray-500 py-10`}>
                      활성 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isChanged = user.id in changes;
                    return (
                      <tr key={user.id} className={isChanged ? 'bg-yellow-50' : ''}>
                        <td className={TABLE_CELL}>{user.userid}</td>
                        <td className={TABLE_CELL}>{user.username}</td>
                        <td className={TABLE_CELL}>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        </td>
                        <td className={TABLE_CELL}>
                          <select
                            value={getRoleValue(user)}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`${SELECT_BASE} ${BTN_SM} w-48`}
                          >
                            {YEAR_ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={TABLE_CELL}>
                          <input
                            type="text"
                            value={getDepartmentValue(user)}
                            onChange={(e) => handleDepartmentChange(user.id, e.target.value)}
                            placeholder="부서명"
                            className={`${SELECT_BASE} ${BTN_SM} w-32`}
                          />
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
