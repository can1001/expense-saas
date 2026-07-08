import { NextResponse } from 'next/server';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 헌금 관리 권한이 있는 역할
const OFFERING_ALLOWED_ROLES = ['admin', 'admin_assistant', 'accountant', 'finance_head'];

/**
 * GET /api/admin/offerings/template
 * CSV 템플릿 다운로드
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  if (!OFFERING_ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  // BOM + CSV 헤더 + 예시 데이터
  const csvContent = `날짜,이름,헌금종류,금액,메모
2024-03-31,홍길동,십일조,500000,
2024-03-31,김철수,감사헌금,100000,감사합니다
2024-03-31,이영희,특별헌금,200000,부활절 특별헌금
2024-03-31,박지민,선교헌금,50000,단기선교 후원
2024-03-31,최수현,건축헌금,300000,
2024-03-31,정민준,구제헌금,30000,이웃돕기
2024-03-31,강서연,기타,20000,`;

  // UTF-8 BOM 추가 (Excel 호환성)
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename="헌금_업로드_템플릿.csv"',
    },
  });
};

export const GET = withAuth(handleGet);
