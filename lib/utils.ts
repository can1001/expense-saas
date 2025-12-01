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
