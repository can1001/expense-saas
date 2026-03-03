'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  Trash2,
  Edit,
  CloudUpload,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useOfflineExpense } from '@/lib/hooks/useOfflineExpense';
import type { OfflineExpense } from '@/lib/db/types';

interface DraftListProps {
  /** 표시할 최대 항목 수 */
  maxItems?: number;
  /** 빈 목록 메시지 */
  emptyMessage?: string;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 오프라인 임시저장 목록 컴포넌트
 */
export function DraftList({
  maxItems = 10,
  emptyMessage = '임시저장된 항목이 없습니다.',
  className = '',
}: DraftListProps) {
  const router = useRouter();
  const { isReady, getDrafts, getPendingSync, deleteDraft, syncOne } =
    useOfflineExpense();

  const [drafts, setDrafts] = useState<OfflineExpense[]>([]);
  const [pendingSync, setPendingSync] = useState<OfflineExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // 목록 로드
  useEffect(() => {
    if (!isReady) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [draftList, pendingList] = await Promise.all([
          getDrafts(),
          getPendingSync(),
        ]);
        setDrafts(draftList.slice(0, maxItems));
        setPendingSync(pendingList.slice(0, maxItems));
      } catch (error) {
        console.error('[DraftList] 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isReady, getDrafts, getPendingSync, maxItems]);

  // 삭제 핸들러
  const handleDelete = async (localId: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;

    const success = await deleteDraft(localId);
    if (success) {
      setDrafts((prev) => prev.filter((d) => d.localId !== localId));
      setPendingSync((prev) => prev.filter((d) => d.localId !== localId));
    }
  };

  // 수정 핸들러 (임시저장 데이터로 폼 이동)
  const handleEdit = (expense: OfflineExpense) => {
    // localId를 쿼리 파라미터로 전달하여 폼에서 로드
    router.push(`/expenses/new?draftId=${expense.localId}`);
  };

  // 동기화 핸들러
  const handleSync = async (localId: string) => {
    setSyncingIds((prev) => new Set(prev).add(localId));

    try {
      const result = await syncOne(localId);
      if (result.success) {
        setPendingSync((prev) => prev.filter((d) => d.localId !== localId));
        alert('동기화가 완료되었습니다.');
      } else {
        alert(`동기화 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[DraftList] 동기화 실패:', error);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  // 날짜 포맷
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 총 금액 계산
  const calculateTotal = (expense: OfflineExpense) => {
    return expense.data.items.reduce((sum, item) => sum + item.amount, 0);
  };

  // 상태 아이콘
  const StatusIcon = ({ status }: { status: OfflineExpense['status'] }) => {
    switch (status) {
      case 'draft':
        return <FileText className="w-4 h-4 text-gray-400" />;
      case 'pending_sync':
        return <CloudUpload className="w-4 h-4 text-blue-500" />;
      case 'syncing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
      case 'conflict':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  // 상태 텍스트
  const getStatusText = (status: OfflineExpense['status']) => {
    switch (status) {
      case 'draft':
        return '임시저장';
      case 'pending_sync':
        return '동기화 대기';
      case 'syncing':
        return '동기화 중';
      case 'synced':
        return '동기화 완료';
      case 'failed':
        return '동기화 실패';
      case 'conflict':
        return '충돌 발생';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-gray-100 rounded-lg mb-2"
          />
        ))}
      </div>
    );
  }

  const allItems = [...pendingSync, ...drafts];

  if (allItems.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {allItems.map((expense) => {
        const isSyncing = syncingIds.has(expense.localId);

        return (
          <div
            key={expense.localId}
            className="
              bg-white border border-gray-200 rounded-lg p-4
              hover:border-gray-300 transition-colors
            "
          >
            <div className="flex items-start justify-between">
              {/* 왼쪽: 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon status={expense.status} />
                  <span className="text-xs text-gray-500">
                    {getStatusText(expense.status)}
                  </span>
                </div>

                <h4 className="font-medium text-gray-900 truncate">
                  {expense.data.applicantName || '신청자 미입력'}
                </h4>

                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span>{formatAmount(calculateTotal(expense))}</span>
                  <span className="text-gray-300">|</span>
                  <span>{formatDate(expense.updatedAt)}</span>
                </div>

                {expense.syncMeta.lastError && (
                  <p className="mt-2 text-xs text-red-500">
                    오류: {expense.syncMeta.lastError}
                  </p>
                )}
              </div>

              {/* 오른쪽: 액션 버튼 */}
              <div className="flex items-center gap-2 ml-4">
                {expense.status === 'draft' && (
                  <button
                    onClick={() => handleEdit(expense)}
                    className="
                      p-2 text-gray-500 hover:text-blue-500
                      hover:bg-blue-50 rounded-lg transition-colors
                    "
                    title="수정"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {(expense.status === 'pending_sync' ||
                  expense.status === 'failed') && (
                  <button
                    onClick={() => handleSync(expense.localId)}
                    disabled={isSyncing}
                    className="
                      p-2 text-gray-500 hover:text-green-500
                      hover:bg-green-50 rounded-lg transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                    title="동기화"
                  >
                    <CloudUpload
                      className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`}
                    />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(expense.localId)}
                  className="
                    p-2 text-gray-500 hover:text-red-500
                    hover:bg-red-50 rounded-lg transition-colors
                  "
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DraftList;
