/**
 * 결재 상태 배지 컴포넌트
 */

interface ApprovalStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ApprovalStatusBadge({
  status,
  size = 'md',
}: ApprovalStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return {
          label: '작성중',
          color: 'bg-gray-100 text-gray-700 border-gray-300',
        };
      case 'PENDING':
        return {
          label: '결재대기',
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        };
      case 'IN_PROGRESS':
        return {
          label: '결재진행중',
          color: 'bg-blue-100 text-blue-700 border-blue-300',
        };
      case 'APPROVED':
        return {
          label: '승인완료',
          color: 'bg-green-100 text-green-700 border-green-300',
        };
      case 'REJECTED':
        return {
          label: '반려',
          color: 'bg-red-100 text-red-700 border-red-300',
        };
      case 'WITHDRAWN':
        return {
          label: '회수',
          color: 'bg-gray-100 text-gray-700 border-gray-300',
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-700 border-gray-300',
        };
    }
  };

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'md':
        return 'px-3 py-1 text-sm';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1 text-sm';
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.color} ${getSizeClass(
        size
      )}`}
    >
      {config.label}
    </span>
  );
}
