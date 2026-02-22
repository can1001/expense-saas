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
