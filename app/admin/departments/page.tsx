'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useOrgTerms } from '@/lib/contexts/TenantContext';
import { apiBase } from '@/lib/api/api-base';
import {
  BTN_SM,
  INPUT_BASE,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface User {
  id: string;
  username: string;
}

interface Committee {
  id: string;
  name: string;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
  committeeId: string;
  committeeName: string;
  sortOrder: number;
  isActive: boolean;
  leaderId: string | null;
  leaderName: string | null;
}

interface GroupedDepartments {
  committee: Committee;
  departments: Department[];
}

export default function DepartmentsPage() {
  const terms = useOrgTerms();
  const currentYear = new Date().getFullYear();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLeaderId, setEditLeaderId] = useState<string>('');
  const [addingToCommittee, setAddingToCommittee] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLeaderId, setNewLeaderId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [expandedCommittees, setExpandedCommittees] = useState<Set<string>>(new Set());

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?isActive=true&pageSize=200');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch {
      console.error('사용자 목록을 불러오는데 실패했습니다.');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [committeeRes, departmentRes] = await Promise.all([
        fetch(`${apiBase('budget-master')}/committees`),
        fetch(`${apiBase('budget-master')}/departments`),
      ]);

      if (!committeeRes.ok || !departmentRes.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const committeeData = await committeeRes.json();
      const departmentData = await departmentRes.json();

      setCommittees(committeeData.committees || []);
      setDepartments(departmentData.departments || []);

      // 모든 위원회 펼치기
      setExpandedCommittees(new Set(committeeData.committees?.map((c: Committee) => c.id) || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, []);

  const toggleExpand = (committeeId: string) => {
    setExpandedCommittees((prev) => {
      const next = new Set(prev);
      if (next.has(committeeId)) {
        next.delete(committeeId);
      } else {
        next.add(committeeId);
      }
      return next;
    });
  };

  const handleAdd = async (committeeId: string) => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      // 1. 부서 추가 (leaderId 없이)
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          committeeId,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '추가에 실패했습니다.');
      }

      // 2. 팀장 지정 시 UserYearRole에 등록
      if (newLeaderId) {
        await fetch('/api/users/year-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: newLeaderId,
            year: currentYear,
            role: 'team_leader',
            department: newName.trim(),
          }),
        });
      }

      setNewName('');
      setNewLeaderId('');
      setAddingToCommittee(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (dept: Department) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      // 1. 부서명 수정 (leaderId 제외)
      const response = await fetch(`/api/departments/${dept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '수정에 실패했습니다.');
      }

      // 2. 팀장 변경 시 UserYearRole 업데이트
      if (editLeaderId !== (dept.leaderId || '')) {
        // 기존 팀장 제거 (새 팀장 지정 전에)
        if (dept.leaderId) {
          await fetch('/api/users/year-roles', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: dept.leaderId,
              year: currentYear,
              departmentId: dept.id,
            }),
          });
        }

        // 새 팀장 지정
        if (editLeaderId) {
          await fetch('/api/users/year-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: editLeaderId,
              year: currentYear,
              role: 'team_leader',
              departmentId: dept.id,
            }),
          });
        }
      }

      setEditingId(null);
      setEditLeaderId('');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (!response.ok) throw new Error('상태 변경에 실패했습니다.');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const startEdit = (department: Department) => {
    setEditingId(department.id);
    setEditName(department.name);
    setEditLeaderId(department.leaderId || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditLeaderId('');
  };

  // 위원회별로 그룹화
  const groupedData: GroupedDepartments[] = committees
    .filter((c) => c.isActive)
    .map((committee) => ({
      committee,
      departments: departments.filter((d) => d.committeeId === committee.id),
    }));

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} py-20`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{terms.departmentFull} 관리</h1>
        <p className="text-gray-600 mt-1">{`${terms.committee}별 ${terms.department}을 추가, 수정, 비활성화할 수 있습니다.`}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>
      )}

      {/* 위원회별 그룹 */}
      <div className="space-y-4">
        {groupedData.map(({ committee, departments: depts }) => (
          <div key={committee.id} className="bg-white rounded-lg shadow overflow-hidden">
            {/* 위원회 헤더 */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100"
              onClick={() => toggleExpand(committee.id)}
            >
              <div className="flex items-center gap-2">
                {expandedCommittees.has(committee.id) ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                <span className="font-semibold text-gray-900">{committee.name}</span>
                <span className="text-sm text-gray-500">({depts.length}개)</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingToCommittee(committee.id);
                  setExpandedCommittees((prev) => new Set([...prev, committee.id]));
                }}
                className={`${BTN_SM} text-blue-600 hover:bg-blue-50 flex items-center gap-1`}
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>

            {/* 사역팀 목록 */}
            {expandedCommittees.has(committee.id) && (
              <div className="divide-y">
                {/* 추가 행 */}
                {addingToCommittee === committee.id && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={`${terms.department}명 입력`}
                      className={`${INPUT_BASE} flex-1 max-w-[200px]`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd(committee.id);
                        if (e.key === 'Escape') {
                          setAddingToCommittee(null);
                          setNewName('');
                          setNewLeaderId('');
                        }
                      }}
                    />
                    <select
                      value={newLeaderId}
                      onChange={(e) => setNewLeaderId(e.target.value)}
                      className={`${SELECT_BASE} max-w-[140px]`}
                    >
                      <option value="">팀장 선택</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAdd(committee.id)}
                      disabled={saving || !newName.trim()}
                      className={`${BTN_SM} text-green-600 hover:bg-green-50 disabled:opacity-50`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setAddingToCommittee(null);
                        setNewName('');
                        setNewLeaderId('');
                      }}
                      className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* 사역팀 행 */}
                {depts.map((dept) => (
                  <div
                    key={dept.id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      !dept.isActive ? 'bg-gray-50 text-gray-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-4"></div>
                      {editingId === dept.id ? (
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`${INPUT_BASE} max-w-[200px]`}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdate(dept);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                          />
                          <select
                            value={editLeaderId}
                            onChange={(e) => setEditLeaderId(e.target.value)}
                            className={`${SELECT_BASE} max-w-[140px]`}
                          >
                            <option value="">팀장 선택</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.username}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <span className={!dept.isActive ? 'line-through' : ''}>
                            {dept.name}
                          </span>
                          <span className={`text-sm ${dept.leaderName ? 'text-blue-600' : 'text-gray-400'}`}>
                            ({dept.leaderName || '팀장 미지정'})
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(dept.id, dept.isActive)}
                        className={`text-xs px-2 py-1 rounded ${
                          dept.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {dept.isActive ? '활성' : '비활성'}
                      </button>

                      {editingId === dept.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(dept)}
                            disabled={saving}
                            className={`${BTN_SM} text-green-600 hover:bg-green-50`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(dept)}
                          className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {depts.length === 0 && addingToCommittee !== committee.id && (
                  <div className="text-center py-6 text-gray-500">
                    {`등록된 ${terms.department}이 없습니다.`}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {groupedData.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            {`활성화된 ${terms.committee}가 없습니다. 먼저 ${terms.committee}를 추가해주세요.`}
          </div>
        )}
      </div>
    </div>
  );
}
