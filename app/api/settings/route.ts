import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/settings
 * 시스템 설정 조회
 *
 * Query: ?key=paymentSignatureRequired (특정 키) or ?keys=key1,key2 (여러 키)
 * 키 없으면 전체 설정 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const keys = searchParams.get('keys');

    if (key) {
      // 단일 키 조회
      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!setting) {
        return NextResponse.json({ key, value: null });
      }

      // JSON 파싱 시도
      let parsedValue = setting.value;
      try {
        parsedValue = JSON.parse(setting.value);
      } catch {
        // JSON이 아니면 원래 값 사용
      }

      return NextResponse.json({
        key: setting.key,
        value: parsedValue,
        description: setting.description,
      });
    }

    if (keys) {
      // 여러 키 조회
      const keyList = keys.split(',').map(k => k.trim());
      const settings = await prisma.systemSetting.findMany({
        where: { key: { in: keyList } },
      });

      const result: Record<string, unknown> = {};
      for (const s of settings) {
        let parsedValue = s.value;
        try {
          parsedValue = JSON.parse(s.value);
        } catch {
          // JSON이 아니면 원래 값 사용
        }
        result[s.key] = parsedValue;
      }

      // 없는 키는 null로 설정
      for (const k of keyList) {
        if (!(k in result)) {
          result[k] = null;
        }
      }

      return NextResponse.json(result);
    }

    // 전체 조회
    const allSettings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    const result: Record<string, { value: unknown; description: string | null }> = {};
    for (const s of allSettings) {
      let parsedValue = s.value;
      try {
        parsedValue = JSON.parse(s.value);
      } catch {
        // JSON이 아니면 원래 값 사용
      }
      result[s.key] = {
        value: parsedValue,
        description: s.description,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: '설정을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * 시스템 설정 저장/업데이트 (관리자 전용)
 *
 * Body: { key: string, value: any, description?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const allowedRoles = ['admin', 'finance_head'];
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        { error: '설정 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: '설정 키가 필요합니다.' },
        { status: 400 }
      );
    }

    // 값을 문자열로 변환 (JSON 직렬화)
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: stringValue,
        description: description || undefined,
      },
      create: {
        key,
        value: stringValue,
        description: description || null,
      },
    });

    // 응답 값 파싱
    let parsedValue = setting.value;
    try {
      parsedValue = JSON.parse(setting.value);
    } catch {
      // JSON이 아니면 원래 값 사용
    }

    return NextResponse.json({
      success: true,
      setting: {
        key: setting.key,
        value: parsedValue,
        description: setting.description,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: '설정을 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
