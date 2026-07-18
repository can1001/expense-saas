'use client';

/**
 * 조직 전환 모달 (ARC-002 §2.2·§3.2, B5)
 *
 * 복수 소속 사용자에게만 트리거가 노출된다 (useMemberships 결과 0/1건이면 미노출 —
 * 단일 소속 사용자 UX 무변경). 전환은 반드시 POST /api/auth/switch-tenant →
 * 새 토큰 발급 방식이며, 성공 시 설정 캐시를 비우고 전체 리로드로
 * 새 테넌트 컨텍스트를 적용한다 (§3.2: 토큰 교체 → 설정 재조회 → 화면 리로드).
 */

import { useEffect, useState } from 'react';
import { Building2, Check, X } from 'lucide-react';
import { clearMeConfigCache } from '@/lib/contexts/MeConfigContext';
import { ORG_TYPE_CACHE_KEY } from '@/lib/contexts/TenantContext';

export interface MembershipOption {
  tenantId: string;
  tenantName: string;
  orgType: string;
  role: string;
  isCurrent: boolean;
}

/**
 * 현재 사용자의 소속 목록 조회 훅.
 * 미로그인/조회 실패(백필 전 포함) 시 빈 배열 — 전환 메뉴가 노출되지 않는다.
 */
export function useMemberships(enabled: boolean): {
  memberships: MembershipOption[];
} {
  const [memberships, setMemberships] = useState<MembershipOption[]>([]);

  useEffect(() => {
    if (!enabled) {
      setMemberships([]);
      return;
    }

    let cancelled = false;
    const fetchMemberships = async () => {
      try {
        const response = await fetch('/api/me/memberships');
        const data = await response.json();
        if (!cancelled && response.ok && Array.isArray(data.memberships)) {
          setMemberships(data.memberships);
        }
      } catch {
        // 조회 실패 — 전환 메뉴 미노출 (기존 UX 유지)
      }
    };
    fetchMemberships();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { memberships };
}

interface TenantSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  memberships: MembershipOption[];
}

export default function TenantSwitcher({
  isOpen,
  onClose,
  memberships,
}: TenantSwitcherProps) {
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ESC 키로 닫기 (전환 진행 중에는 유지)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !switchingId) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, switchingId]);

  // 닫힐 때 에러 초기화
  useEffect(() => {
    if (!isOpen) setError('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (tenantId: string) => {
    setSwitchingId(tenantId);
    setError('');

    try {
      const response = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '조직 전환에 실패했습니다.');
        setSwitchingId(null);
        return;
      }

      // 이전 테넌트의 설정 캐시 제거 후 전체 리로드 — 새 토큰 기준으로 재조회.
      // FCM은 서버(switch-tenant)가 토픽을 재스코프하고, 리로드 시
      // FcmAutoRegister가 재등록해 새 테넌트 구독을 확정한다 (B6).
      clearMeConfigCache();
      try {
        window.sessionStorage.removeItem(ORG_TYPE_CACHE_KEY);
      } catch {
        // 무시
      }
      window.location.assign('/');
    } catch {
      setError('조직 전환 처리 중 오류가 발생했습니다.');
      setSwitchingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!switchingId) onClose();
        }}
      />

      {/* 모달 */}
      <div className="relative w-full max-w-sm bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">조직 전환</h2>
          <button
            onClick={onClose}
            disabled={!!switchingId}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            이동할 조직을 선택해주세요.
          </p>

          <ul className="space-y-2">
            {memberships.map((membership) => (
              <li key={membership.tenantId}>
                <button
                  onClick={() => handleSwitch(membership.tenantId)}
                  disabled={membership.isCurrent || !!switchingId}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-left border rounded-lg transition-colors min-h-[44px] ${
                    membership.isCurrent
                      ? 'border-blue-200 bg-blue-50 cursor-default'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 font-medium text-gray-900">
                    {membership.tenantName}
                  </span>
                  {membership.isCurrent ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                      <Check className="w-4 h-4" />
                      현재
                    </span>
                  ) : switchingId === membership.tenantId ? (
                    <span className="text-xs text-gray-500">전환 중...</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-3 text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
