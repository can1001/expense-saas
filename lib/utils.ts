import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 숫자를 한글 통화 형식으로 포맷
export function formatCurrency(amount: number): string {
  return `₩ ${amount.toLocaleString('ko-KR')} 원`;
}

// 날짜를 한글 형식으로 포맷
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy년 MM월 dd일', { locale: ko });
}

// 날짜를 짧은 형식으로 포맷
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

// 계좌번호 마스킹 (뒷 4자리만 표시)
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '';
  const cleaned = accountNumber.replace(/[^0-9]/g, '');
  if (cleaned.length <= 4) return cleaned;
  const lastFour = cleaned.slice(-4);
  return `****${lastFour}`;
}

// 타임스탬프를 상대 시간으로 포맷 ("방금", "5분 전" 등)
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return '지난주';
}
