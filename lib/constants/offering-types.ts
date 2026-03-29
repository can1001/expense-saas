/**
 * 헌금 종류 관련 상수 및 유틸리티 함수
 */

import { OfferingType } from '@prisma/client';

// 헌금 종류 한글 라벨
export const OFFERING_TYPE_LABELS: Record<OfferingType, string> = {
  TITHE: '십일조',
  THANKSGIVING: '감사헌금',
  SPECIAL: '특별헌금',
  MISSION: '선교헌금',
  BUILDING: '건축헌금',
  RELIEF: '구제헌금',
  OTHER: '기타',
};

// 헌금 종류별 색상 (Tailwind CSS 클래스)
export const OFFERING_TYPE_COLORS: Record<OfferingType, { bg: string; text: string }> = {
  TITHE: { bg: 'bg-teal-100', text: 'text-teal-800' },
  THANKSGIVING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  SPECIAL: { bg: 'bg-purple-100', text: 'text-purple-800' },
  MISSION: { bg: 'bg-orange-100', text: 'text-orange-800' },
  BUILDING: { bg: 'bg-blue-100', text: 'text-blue-800' },
  RELIEF: { bg: 'bg-green-100', text: 'text-green-800' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

// 헌금 종류 목록
export const OFFERING_TYPES = Object.keys(OFFERING_TYPE_LABELS) as OfferingType[];

// 한글 헌금 종류를 enum 값으로 변환
export function mapKoreanTypeToEnum(koreanType: string): OfferingType | null {
  const mapping: Record<string, OfferingType> = {
    '십일조': 'TITHE',
    '감사헌금': 'THANKSGIVING',
    '특별헌금': 'SPECIAL',
    '선교헌금': 'MISSION',
    '건축헌금': 'BUILDING',
    '구제헌금': 'RELIEF',
    '기타': 'OTHER',
  };
  return mapping[koreanType] || null;
}

// 금액 포맷 (원화)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

// 오늘 날짜 (YYYY-MM-DD)
export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// 주차 라벨 (예: "3월 2주")
export function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekNum = Math.ceil(day / 7);
  return `${month}월 ${weekNum}주`;
}
