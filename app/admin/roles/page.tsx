'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Check, X, Edit2, Trash2, Plus, Save, XCircle } from 'lucide-react';
import {
  SECTION_CARD,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DANGER,
  BTN_SM,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  INPUT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';
import { ROLE_COLORS } from '@/hooks/useRoles';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stepNumber: number | null;
  sortOrder: number;
  isActive: boolean;
  canApprove: boolean;
  canManageExpense: boolean;
  canAccessAdmin: boolean;
  canExportData: boolean;
  _count?: {
    users: number;
    userYearRoles: number;
  };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    stepNumber: '',
    sortOrder: '0',
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
  });

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/roles?includeInactive=true');
      if (!response.ok) throw new Error('Failed to fetch roles');

      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '역할 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      stepNumber: '',
      sortOrder: '0',
      canApprove: false,
      canManageExpense: false,
      canAccessAdmin: false,
      canExportData: false,
    });
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      alert('역할 코드와 이름은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          stepNumber: formData.stepNumber ? parseInt(formData.stepNumber) : null,
          sortOrder: parseInt(formData.sortOrder),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create role');
      }

      await fetchRoles();
      setIsCreating(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : '역할 생성 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingRole) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          stepNumber: formData.stepNumber ? parseInt(formData.stepNumber) : null,
          sortOrder: parseInt(formData.sortOrder),
          canApprove: formData.canApprove,
          canManageExpense: formData.canManageExpense,
          canAccessAdmin: formData.canAccessAdmin,
          canExportData: formData.canExportData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      await fetchRoles();
      setEditingRole(null);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : '역할 수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (['admin', 'user'].includes(role.code)) {
      alert('기본 역할은 삭제할 수 없습니다.');
      return;
    }

    const usageCount = (role._count?.users || 0) + (role._count?.userYearRoles || 0);
    if (usageCount > 0) {
      alert(`이 역할은 ${usageCount}개의 사용자/연도별 역할에서 사용 중입니다.\n먼저 해당 사용자들의 역할을 변경해주세요.`);
      return;
    }

    if (!confirm(`'${role.name}' 역할을 비활성화하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete role');
      }

      await fetchRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '역할 삭제 실패');
    }
  };

  const startEdit = (role: Role) => {
    setEditingRole(role);
    setIsCreating(false);
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || '',
      stepNumber: role.stepNumber?.toString() || '',
      sortOrder: role.sortOrder.toString(),
      canApprove: role.canApprove,
      canManageExpense: role.canManageExpense,
      canAccessAdmin: role.canAccessAdmin,
      canExportData: role.canExportData,
    });
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingRole(null);
    resetForm();
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setIsCreating(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} min-h-[400px]`}>
        <div className={SPINNER_LG} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">역할 관리</h1>
            <p className="text-sm text-gray-600">시스템 역할 및 권한을 관리합니다.</p>
          </div>
        </div>
        <button onClick={startCreate} className={`${BTN_PRIMARY} flex items-center gap-2`}>
          <Plus className="w-4 h-4" />
          새 역할 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 역할 생성/수정 폼 */}
      {(isCreating || editingRole) && (
        <div className={SECTION_CARD}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {isCreating ? (
              <>
                <Plus className="w-5 h-5" />
                새 역할 추가
              </>
            ) : (
              <>
                <Edit2 className="w-5 h-5" />
                &apos;{editingRole?.name}&apos; 수정
              </>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                역할 코드 *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className={INPUT_BASE}
                placeholder="예: reviewer"
                disabled={!!editingRole}
              />
              {editingRole && (
                <p className="text-xs text-gray-500 mt-1">역할 코드는 수정할 수 없습니다.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                역할 이름 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={INPUT_BASE}
                placeholder="예: 검토자"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={INPUT_BASE}
                placeholder="역할에 대한 설명"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                결재 단계
              </label>
              <input
                type="number"
                value={formData.stepNumber}
                onChange={(e) => setFormData({ ...formData, stepNumber: e.target.value })}
                className={INPUT_BASE}
                placeholder="비워두면 결재 권한 없음"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">결재 순서 (1차, 2차, 3차...)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                정렬 순서
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                className={INPUT_BASE}
                min="0"
              />
            </div>
          </div>

          {/* 권한 체크박스 */}
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">권한 설정</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.canApprove}
                  onChange={(e) => setFormData({ ...formData, canApprove: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">결재 권한</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.canManageExpense}
                  onChange={(e) => setFormData({ ...formData, canManageExpense: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">지출 관리</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.canAccessAdmin}
                  onChange={(e) => setFormData({ ...formData, canAccessAdmin: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">관리자 메뉴</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.canExportData}
                  onChange={(e) => setFormData({ ...formData, canExportData: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">데이터 내보내기</span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={isCreating ? handleCreate : handleUpdate}
              className={`${BTN_PRIMARY} flex items-center gap-2`}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : isCreating ? '추가' : '저장'}
            </button>
            <button onClick={cancelEdit} className={`${BTN_OUTLINE} flex items-center gap-2`}>
              <XCircle className="w-4 h-4" />
              취소
            </button>
          </div>
        </div>
      )}

      {/* 역할 카드 목록 */}
      <div className="grid gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className={`bg-white rounded-lg shadow overflow-hidden ${!role.isActive ? 'opacity-60' : ''}`}
          >
            {/* 역할 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${ROLE_COLORS[role.code]?.bg?.replace('bg-', 'bg-').replace('-100', '-500') || 'bg-gray-500'} rounded-lg flex items-center justify-center`}>
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {role.name}
                    <code className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {role.code}
                    </code>
                    {role.stepNumber && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {role.stepNumber}차 결재
                      </span>
                    )}
                    {!role.isActive && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        비활성
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600">{role.description || '설명 없음'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm text-gray-500">
                  <div>사용자: {role._count?.users || 0}명</div>
                  <div>연도별 역할: {role._count?.userYearRoles || 0}개</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(role)}
                    className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-1`}
                  >
                    <Edit2 className="w-3 h-3" />
                    수정
                  </button>
                  {!['admin', 'user'].includes(role.code) && role.isActive && (
                    <button
                      onClick={() => handleDelete(role)}
                      className={`${BTN_DANGER} ${BTN_SM} flex items-center gap-1`}
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 권한 목록 */}
            <div className="p-4 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    role.canApprove ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'
                  }`}
                >
                  {role.canApprove ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span>결재 권한</span>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    role.canManageExpense ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'
                  }`}
                >
                  {role.canManageExpense ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span>지출 관리</span>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    role.canAccessAdmin ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'
                  }`}
                >
                  {role.canAccessAdmin ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span>관리자 메뉴</span>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    role.canExportData ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'
                  }`}
                >
                  {role.canExportData ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span>데이터 내보내기</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {roles.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
          등록된 역할이 없습니다.
        </div>
      )}

      {/* 권한 설명 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">권한 설명</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-700">
          <div><strong>결재 권한:</strong> 지출결의서 결재 (결재 단계 필요)</div>
          <div><strong>지출 관리:</strong> 지급완료 처리, 상태 변경</div>
          <div><strong>관리자 메뉴:</strong> 사용자, 예산, 역할 관리 접근</div>
          <div><strong>데이터 내보내기:</strong> Excel 등 다운로드</div>
        </div>
      </div>
    </div>
  );
}
