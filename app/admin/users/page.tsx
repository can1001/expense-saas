'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SECTION_CARD,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DANGER,
  BTN_SM,
  BTN_PAGINATION,
  BTN_PAGE_ACTIVE,
  BTN_PAGE_INACTIVE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  INPUT_BASE,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface User {
  id: string;
  userid: string;
  username: string;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  finance_head: 'bg-purple-100 text-purple-800',
  accountant: 'bg-blue-100 text-blue-800',
  team_leader: 'bg-green-100 text-green-800',
  admin_assistant: 'bg-yellow-100 text-yellow-800',
  user: 'bg-gray-100 text-gray-800',
};

function UsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') ?? '');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('isActive') ?? '');
  const currentPage = parseInt(searchParams.get('page') ?? '1');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('pageSize', '20');
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter) params.set('isActive', activeFilter);

      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, roleFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    params.set('page', '1');
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    if (activeFilter) params.set('isActive', activeFilter);
    router.push(`/admin/users?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/admin/users?${params.toString()}`);
  };

  const handleDeactivate = async (id: string, username: string) => {
    if (!confirm(`${username} 사용자를 비활성화하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to deactivate user');
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '비활성화 실패');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) throw new Error('Failed to activate user');
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '활성화 실패');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <div className="flex gap-2">
          <Link href="/admin/users-upload" className={BTN_OUTLINE}>
            일괄 등록
          </Link>
          <Link href="/admin/users/new" className={BTN_PRIMARY}>
            사용자 추가
          </Link>
        </div>
      </div>

      {/* 필터 */}
      <div className={`${SECTION_CARD} mb-6`}>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <input
              type="text"
              placeholder="아이디 또는 이름 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className={INPUT_BASE}
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={SELECT_BASE}
            >
              <option value="">전체</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className={SELECT_BASE}
            >
              <option value="">전체</option>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          </div>
          <button onClick={handleSearch} className={BTN_PRIMARY}>
            검색
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className={`${FLEX_CENTER} py-20`}>
          <div className={SPINNER_LG}></div>
        </div>
      ) : (
        <>
          {/* 테이블 */}
          <div className={SECTION_CARD}>
            <div className="overflow-x-auto">
              <table className={TABLE_BASE}>
                <thead className={TABLE_HEADER}>
                  <tr>
                    <th className={TABLE_HEADER_CELL}>아이디</th>
                    <th className={TABLE_HEADER_CELL}>이름</th>
                    <th className={TABLE_HEADER_CELL}>역할</th>
                    <th className={TABLE_HEADER_CELL}>부서</th>
                    <th className={TABLE_HEADER_CELL}>상태</th>
                    <th className={TABLE_HEADER_CELL}>등록일</th>
                    <th className={TABLE_HEADER_CELL}>관리</th>
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`${TABLE_CELL} text-center text-gray-500 py-10`}>
                        사용자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className={!user.isActive ? 'bg-gray-50' : ''}>
                        <td className={TABLE_CELL}>{user.userid}</td>
                        <td className={TABLE_CELL}>{user.username}</td>
                        <td className={TABLE_CELL}>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-800'}`}>
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        </td>
                        <td className={TABLE_CELL}>{user.department ?? '-'}</td>
                        <td className={TABLE_CELL}>
                          {user.isActive ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">활성</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">비활성</span>
                          )}
                        </td>
                        <td className={TABLE_CELL}>
                          {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className={TABLE_CELL}>
                          <div className="flex gap-2">
                            <Link
                              href={`/admin/users/${user.id}/edit`}
                              className={`${BTN_OUTLINE} ${BTN_SM}`}
                            >
                              수정
                            </Link>
                            {user.isActive ? (
                              <button
                                onClick={() => handleDeactivate(user.id, user.username)}
                                className={`${BTN_DANGER} ${BTN_SM}`}
                              >
                                비활성화
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(user.id)}
                                className={`${BTN_PRIMARY} ${BTN_SM}`}
                              >
                                활성화
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 페이지네이션 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className={BTN_PAGINATION}
              >
                이전
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  const diff = Math.abs(page - currentPage);
                  return diff <= 2 || page === 1 || page === pagination.totalPages;
                })
                .map((page, idx, arr) => (
                  <span key={page} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(page)}
                      className={page === currentPage ? BTN_PAGE_ACTIVE : BTN_PAGE_INACTIVE}
                    >
                      {page}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
                className={BTN_PAGINATION}
              >
                다음
              </button>
            </div>
          )}

          {/* 총 개수 */}
          {pagination && (
            <div className="text-center text-sm text-gray-500 mt-4">
              총 {pagination.total}명의 사용자
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className={`${FLEX_CENTER} min-h-screen`}>
        <div className={SPINNER_LG}></div>
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  );
}
