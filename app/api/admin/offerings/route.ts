import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { OfferingType } from '@prisma/client';
import { mapKoreanTypeToEnum } from '@/lib/constants/offering-types';

// 헌금 관리 권한이 있는 역할
const OFFERING_ALLOWED_ROLES = ['admin', 'admin_assistant', 'accountant', 'finance_head'];

/**
 * GET /api/admin/offerings
 * 헌금 목록 조회 (필터링, 페이지네이션, 통계)
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    if (!OFFERING_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const month = searchParams.get('month') || ''; // YYYY-MM
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: {
      name?: { contains: string; mode: 'insensitive' };
      memo?: { contains: string; mode: 'insensitive' };
      type?: OfferingType;
      date?: { gte?: Date; lt?: Date };
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; memo?: { contains: string; mode: 'insensitive' } }>;
    } = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { memo: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type && type !== '전체') {
      where.type = type as OfferingType;
    }

    if (month && month !== '전체') {
      const [year, mon] = month.split('-').map(Number);
      const startDate = new Date(year, mon - 1, 1);
      const endDate = new Date(year, mon, 1);
      where.date = {
        gte: startDate,
        lt: endDate,
      };
    }

    // 데이터 조회
    const [offerings, total] = await Promise.all([
      prisma.offering.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      prisma.offering.count({ where }),
    ]);

    // 통계 계산
    const stats = await prisma.offering.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    });

    // 고유 헌금자 수
    const uniqueDonors = await prisma.offering.groupBy({
      by: ['name'],
      where,
    });

    // 타입별 통계
    const byType = await prisma.offering.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    // 사용 가능한 월 목록
    const months = await prisma.$queryRaw<{ month: string }[]>`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') as month
      FROM "Offering"
      ORDER BY month DESC
    `;

    return NextResponse.json({
      offerings: offerings.map(o => ({
        ...o,
        date: o.date.toISOString().slice(0, 10),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAmount: stats._sum.amount || 0,
        count: stats._count,
        uniqueDonors: uniqueDonors.length,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = {
            count: item._count,
            amount: item._sum.amount || 0,
          };
          return acc;
        }, {} as Record<string, { count: number; amount: number }>),
      },
      months: months.map(m => m.month),
    });
  } catch (error: unknown) {
    console.error('Get offerings error:', error);
    return NextResponse.json(
      { error: '헌금 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/admin/offerings
 * 헌금 등록 (단건 또는 일괄)
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    if (!OFFERING_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();

    // 일괄 등록인 경우
    if (body.offerings && Array.isArray(body.offerings)) {
      const offeringsData = body.offerings.map((o: {
        date: string;
        name: string;
        type: string;
        amount: number;
        memo?: string;
      }) => {
        // 한글 타입을 enum으로 변환
        let offeringType: OfferingType = o.type as OfferingType;
        if (!Object.values(OfferingType).includes(offeringType)) {
          const mapped = mapKoreanTypeToEnum(o.type);
          if (mapped) {
            offeringType = mapped;
          } else {
            offeringType = 'OTHER';
          }
        }

        return {
          date: new Date(o.date),
          name: o.name,
          type: offeringType,
          amount: Number(o.amount),
          memo: o.memo || null,
        };
      });

      const result = await prisma.offering.createMany({
        data: offeringsData,
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        message: `${result.count}건의 헌금이 등록되었습니다.`,
      });
    }

    // 단건 등록
    const { date, name, type, amount, memo } = body;

    if (!date || !name || !type || !amount) {
      return NextResponse.json(
        { error: '날짜, 이름, 헌금종류, 금액은 필수입니다.' },
        { status: 400 }
      );
    }

    // 한글 타입을 enum으로 변환
    let offeringType: OfferingType = type as OfferingType;
    if (!Object.values(OfferingType).includes(offeringType)) {
      const mapped = mapKoreanTypeToEnum(type);
      if (mapped) {
        offeringType = mapped;
      } else {
        offeringType = 'OTHER';
      }
    }

    const offering = await prisma.offering.create({
      data: {
        date: new Date(date),
        name,
        type: offeringType,
        amount: Number(amount),
        memo: memo || null,
      },
    });

    return NextResponse.json({
      success: true,
      offering: {
        ...offering,
        date: offering.date.toISOString().slice(0, 10),
      },
    });
  } catch (error: unknown) {
    console.error('Create offering error:', error);
    return NextResponse.json(
      { error: '헌금 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
