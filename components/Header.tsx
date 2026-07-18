'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, CheckSquare, Home, LogOut, User, Settings, Menu, X, Key, PenLine, ChevronDown, Bell, History, Send, UserPlus, Moon, Repeat, ArrowLeftRight } from 'lucide-react';
import { useRoles } from '@/hooks/useRoles';
import { usePendingApprovalCount } from '@/hooks/usePendingApprovalCount';
import { canShowUserRegisterMenu, canAccessAdminMenuWithRoles, canAccessRecurringExpenseMenuWithRoles } from '@/lib/constants/menu-permissions';
import QuickUserRegister from '@/components/QuickUserRegister';
import TenantSwitcher, { useMemberships } from '@/components/TenantSwitcher';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';
import { apiBase } from '@/lib/api/api-base';

interface UserInfo {
  id: string;
  userid: string;
  username: string;
  role: string;
  roles?: string[];  // 다중 역할 지원
  department?: string;
  canRegisterUsers?: boolean;
  roleRef?: { canRegisterUsers?: boolean } | null;
}

// 테넌트 정보 타입
interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
}

// 모바일 드로어 컴포넌트
function MobileDrawer({
  isOpen,
  onClose,
  navItems,
  user,
  tenant,
  loading,
  onLogout,
  getRoleName,
  pendingCount,
  onOpenUserRegister,
  canSwitchTenant,
  onOpenTenantSwitcher,
}: {
  isOpen: boolean;
  onClose: () => void;
  navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }[];
  user: UserInfo | null;
  tenant: TenantInfo | null;
  loading: boolean;
  onLogout: () => void;
  getRoleName: (code: string) => string;
  pendingCount: number;
  onOpenUserRegister: () => void;
  canSwitchTenant: boolean;
  onOpenTenantSwitcher: () => void;
}) {
  // 내 정보 아코디언 상태 (기본 접힘)
  const [isMyInfoOpen, setIsMyInfoOpen] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 드로어 - flexbox 레이아웃 */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl transform transition-transform duration-300 ease-out md:hidden flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 드로어 헤더 */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200">
          <Link href="/" onClick={onClose} className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Home className="w-5 h-5" />
            <span>{tenant ? tenant.name : '지출결의서 관리'}</span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 사용자 정보 */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
          {loading ? (
            <div className="h-12 bg-gray-200 rounded animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{user.username}</p>
                <p className="text-sm text-blue-600">{getRoleName(user.role)}</p>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="block w-full py-3 text-center bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              로그인
            </Link>
          )}
        </div>

        {/* 메인 메뉴 - flex-1로 남은 공간 차지 + 스크롤 */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* 지출결의서, 결재함, 관리 */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isApprovalMenu = item.href === '/approvals';
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 w-full px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                  item.active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
                {isApprovalMenu && pendingCount > 0 && (
                  <span
                    className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full"
                    aria-label={`결재 대기 ${pendingCount}건`}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}

          {/* 서명/도장 관리 */}
          {user && (
            <Link
              href="/mypage/signatures"
              onClick={onClose}
              className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <PenLine className="w-5 h-5" />
              서명/도장 관리
            </Link>
          )}

          {/* 사용자 등록 (권한 있는 사용자만) */}
          {user && canShowUserRegisterMenu(user) && (
            <button
              onClick={() => {
                onClose();
                onOpenUserRegister();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              사용자 등록
            </button>
          )}

          {/* 조직 전환 (복수 소속 사용자만, B5) */}
          {user && canSwitchTenant && (
            <button
              onClick={() => {
                onClose();
                onOpenTenantSwitcher();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <ArrowLeftRight className="w-5 h-5" />
              조직 전환
            </button>
          )}
        </nav>

        {/* 내 정보 (아코디언) */}
        {user && (
          <div className="flex-shrink-0 px-4 pb-4 border-t border-gray-200 pt-4">
            {/* 아코디언 헤더 */}
            <button
              onClick={() => setIsMyInfoOpen(!isMyInfoOpen)}
              className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
            >
              <span className="uppercase tracking-wider">내 정보</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isMyInfoOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* 아코디언 내용 */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isMyInfoOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="mt-1 space-y-1">
                <Link
                  href="/mypage/password"
                  onClick={onClose}
                  className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Key className="w-5 h-5" />
                  비밀번호 변경
                </Link>
                <Link
                  href="/mypage/notifications"
                  onClick={onClose}
                  className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  알림 설정
                </Link>
                {roleHasPermission(user.role, PERMISSIONS.NOTIFICATION_SEND) && (
                  <Link
                    href="/mypage/send-notification"
                    onClick={onClose}
                    className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Send className="w-5 h-5" />
                    알림 발송
                  </Link>
                )}
                <Link
                  href="/mypage/notification-history"
                  onClick={onClose}
                  className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <History className="w-5 h-5" />
                  알림 히스토리
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 로그아웃 버튼 - safe-area 패딩 적용 */}
        {user && (
          <div
            className="flex-shrink-0 p-4 border-t border-gray-200 bg-white"
            style={{ paddingBottom: 'calc(16px + var(--bottom-safe-area, 0px))' }}
          >
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center justify-center gap-2 w-full py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  const [user, setUser] = useState<UserInfo | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUserRegisterOpen, setIsUserRegisterOpen] = useState(false);
  const [isTenantSwitcherOpen, setIsTenantSwitcherOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 소속 조직 목록 (B5) — 복수 소속일 때만 조직 전환 메뉴 노출
  const { memberships } = useMemberships(!!user);
  const canSwitchTenant = memberships.length > 1;

  // Role 테이블에서 역할 정보 가져오기
  const { getRoleName } = useRoles();

  // 결재 대기 건수 조회 (로그인 사용자만)
  const { count: pendingCount } = usePendingApprovalCount({
    enabled: !!user,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();
        if (response.ok && data.user) {
          setUser(data.user);
          if (data.tenant) {
            setTenant(data.tenant);
          }
        } else {
          setUser(null);
          setTenant(null);
        }
      } catch {
        setUser(null);
        setTenant(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [pathname]);

  // 페이지 변경 시 드로어/메뉴 닫기
  useEffect(() => {
    setIsDrawerOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  // 사용자 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    try {
      await fetch(`${apiBase('auth')}/auth/logout`, { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch {
      // 에러 처리
    }
  };

  // 로그인 페이지에서는 헤더 숨김
  if (isLoginPage) {
    return null;
  }

  const navItems = [
    {
      href: '/expenses',
      label: '지출결의서',
      icon: FileText,
      active: pathname.startsWith('/expenses'),
    },
    {
      href: '/approvals',
      label: '결재함',
      icon: CheckSquare,
      active: pathname.startsWith('/approvals'),
    },
    // 자동이체 메뉴 (재정팀 전용)
    ...(user && canAccessRecurringExpenseMenuWithRoles(user.roles || [user.role])
      ? [
          {
            href: '/recurring-expenses',
            label: '자동이체',
            icon: Repeat,
            active: pathname.startsWith('/recurring-expenses'),
          },
        ]
      : []),
    // 청나잇 메뉴 (임시 숨김)
    // {
    //   href: '/youth-night',
    //   label: '청나잇',
    //   icon: Moon,
    //   active: pathname.startsWith('/youth-night'),
    // },
    // admin 메뉴 (관리 권한 있는 역할만 표시, 다중 역할 지원)
    ...(user && canAccessAdminMenuWithRoles(user.roles || [user.role])
      ? [
          {
            href: '/admin',
            label: '관리',
            icon: Settings,
            active: pathname.startsWith('/admin'),
          },
        ]
      : []),
  ];

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 md:gap-8">
              {/* 모바일 햄버거 버튼 */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="메뉴 열기"
              >
                <Menu className="w-6 h-6" />
              </button>

              <Link
                href="/"
                className="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                <Home className="w-6 h-6" />
                <span className="hidden sm:inline">
                  {tenant ? `${tenant.name}` : '지출결의서 관리'}
                </span>
              </Link>

              {/* 데스크톱 네비게이션 */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isApprovalMenu = item.href === '/approvals';
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                        item.active
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {isApprovalMenu && pendingCount > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full"
                          aria-label={`결재 대기 ${pendingCount}건`}
                        >
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* 오른쪽 영역 - 사용자 드롭다운 메뉴 (데스크톱) */}
            <div className="hidden md:flex items-center gap-4">
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              ) : user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>{user.username}</span>
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {getRoleName(user.role)}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* 드롭다운 메뉴 */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <Link
                        href="/mypage/password"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Key className="w-4 h-4" />
                        비밀번호 변경
                      </Link>
                      <Link
                        href="/mypage/signatures"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <PenLine className="w-4 h-4" />
                        서명/도장 관리
                      </Link>
                      <Link
                        href="/mypage/notifications"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Bell className="w-4 h-4" />
                        알림 설정
                      </Link>
                      <Link
                        href="/mypage/notification-history"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <History className="w-4 h-4" />
                        알림 히스토리
                      </Link>
                      {user && roleHasPermission(user.role, PERMISSIONS.NOTIFICATION_SEND) && (
                        <Link
                          href="/mypage/send-notification"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Send className="w-4 h-4" />
                          알림 발송
                        </Link>
                      )}
                      {user && canShowUserRegisterMenu(user) && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsUserRegisterOpen(true);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <UserPlus className="w-4 h-4" />
                          사용자 등록
                        </button>
                      )}
                      {canSwitchTenant && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsTenantSwitcherOpen(true);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                          조직 전환
                        </button>
                      )}
                      <div className="border-t border-gray-200 my-1" />
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  로그인
                </Link>
              )}
            </div>

            {/* 모바일 - 로그인 버튼만 표시 (사용자 아이콘은 드로어에서 표시) */}
            <div className="md:hidden">
              {!loading && !user && (
                <Link
                  href="/login"
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  로그인
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 모바일 드로어 */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        navItems={navItems}
        user={user}
        tenant={tenant}
        loading={loading}
        onLogout={handleLogout}
        getRoleName={getRoleName}
        pendingCount={pendingCount}
        onOpenUserRegister={() => setIsUserRegisterOpen(true)}
        canSwitchTenant={canSwitchTenant}
        onOpenTenantSwitcher={() => setIsTenantSwitcherOpen(true)}
      />

      {/* 사용자 등록 모달 */}
      <QuickUserRegister
        isOpen={isUserRegisterOpen}
        onClose={() => setIsUserRegisterOpen(false)}
      />

      {/* 조직 전환 모달 (복수 소속 사용자만 트리거 노출, B5) */}
      <TenantSwitcher
        isOpen={isTenantSwitcherOpen}
        onClose={() => setIsTenantSwitcherOpen(false)}
        memberships={memberships}
      />
    </>
  );
}
