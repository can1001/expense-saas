'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, GripVertical, Check, X } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_SM,
  INPUT_BASE,
  SELECT_BASE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
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
  sortOrder: number;
  isActive: boolean;
  leaderId: string | null;
  leader: User | null;
  _count?: {
    departments: number;
  };
}

export default function CommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLeaderId, setEditLeaderId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLeaderId, setNewLeaderId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCommittees();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users?active=true');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch {
      console.error('사용자 목록을 불러오는데 실패했습니다.');
    }
  };

  const fetchCommittees = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/committees');
      if (!response.ok) throw new Error('위원회 목록을 불러오는데 실패했습니다.');
      const data = await response.json();
      setCommittees(data.committees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch('/api/committees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          leaderId: newLeaderId || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '추가에 실패했습니다.');
      }
      setNewName('');
      setNewLeaderId('');
      setIsAdding(false);
      fetchCommittees();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/committees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          leaderId: editLeaderId || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '수정에 실패했습니다.');
      }
      setEditingId(null);
      setEditLeaderId('');
      fetchCommittees();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/committees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (!response.ok) throw new Error('상태 변경에 실패했습니다.');
      fetchCommittees();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const startEdit = (committee: Committee) => {
    setEditingId(committee.id);
    setEditName(committee.name);
    setEditLeaderId(committee.leaderId || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditLeaderId('');
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">위원회 관리</h1>
          <p className="text-gray-600 mt-1">위원회를 추가, 수정, 비활성화할 수 있습니다.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className={`${BTN_PRIMARY} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            위원회 추가
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className={TABLE_BASE}>
          <thead className={TABLE_HEADER}>
            <tr>
              <th className={`${TABLE_HEADER_CELL} w-12`}></th>
              <th className={TABLE_HEADER_CELL}>위원회명</th>
              <th className={`${TABLE_HEADER_CELL} w-40`}>위원장</th>
              <th className={`${TABLE_HEADER_CELL} w-24 text-center`}>사역팀 수</th>
              <th className={`${TABLE_HEADER_CELL} w-24 text-center`}>상태</th>
              <th className={`${TABLE_HEADER_CELL} w-24 text-center`}>관리</th>
            </tr>
          </thead>
          <tbody className={TABLE_BODY}>
            {/* 추가 행 */}
            {isAdding && (
              <tr className="bg-blue-50">
                <td className={TABLE_CELL}></td>
                <td className={TABLE_CELL}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="위원회명 입력"
                    className={`${INPUT_BASE} max-w-xs`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd();
                      if (e.key === 'Escape') {
                        setIsAdding(false);
                        setNewName('');
                        setNewLeaderId('');
                      }
                    }}
                  />
                </td>
                <td className={TABLE_CELL}>
                  <select
                    value={newLeaderId}
                    onChange={(e) => setNewLeaderId(e.target.value)}
                    className={`${SELECT_BASE} max-w-[150px]`}
                  >
                    <option value="">선택안함</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={TABLE_CELL}></td>
                <td className={TABLE_CELL}></td>
                <td className={`${TABLE_CELL} text-center`}>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={handleAdd}
                      disabled={saving || !newName.trim()}
                      className={`${BTN_SM} text-green-600 hover:bg-green-50 disabled:opacity-50`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewName('');
                        setNewLeaderId('');
                      }}
                      className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {/* 목록 */}
            {committees.map((committee) => (
              <tr
                key={committee.id}
                className={!committee.isActive ? 'bg-gray-50 text-gray-400' : ''}
              >
                <td className={`${TABLE_CELL} text-gray-400`}>
                  <GripVertical className="w-4 h-4" />
                </td>
                <td className={TABLE_CELL}>
                  {editingId === committee.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`${INPUT_BASE} max-w-xs`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(committee.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                  ) : (
                    <span className={!committee.isActive ? 'line-through' : ''}>
                      {committee.name}
                    </span>
                  )}
                </td>
                <td className={TABLE_CELL}>
                  {editingId === committee.id ? (
                    <select
                      value={editLeaderId}
                      onChange={(e) => setEditLeaderId(e.target.value)}
                      className={`${SELECT_BASE} max-w-[150px]`}
                    >
                      <option value="">선택안함</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-sm ${committee.leader ? 'text-gray-900' : 'text-gray-400'}`}>
                      {committee.leader?.username || '-'}
                    </span>
                  )}
                </td>
                <td className={`${TABLE_CELL} text-center`}>
                  {committee._count?.departments || 0}
                </td>
                <td className={`${TABLE_CELL} text-center`}>
                  <button
                    onClick={() => handleToggleActive(committee.id, committee.isActive)}
                    className={`text-xs px-2 py-1 rounded ${
                      committee.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {committee.isActive ? '활성' : '비활성'}
                  </button>
                </td>
                <td className={`${TABLE_CELL} text-center`}>
                  {editingId === committee.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleUpdate(committee.id)}
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
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(committee)}
                      className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {committees.length === 0 && !isAdding && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  등록된 위원회가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
