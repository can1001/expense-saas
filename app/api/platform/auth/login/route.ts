import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { createSuperAdminToken, createTokenCookie } from '@/lib/auth/super-admin';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

// POST /api/platform/auth/login - SuperAdmin 로그인
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 유효성 검사
    const { email, password } = loginSchema.parse(body);

    // SuperAdmin 조회
    const admin = await prismaBase.superAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 활성 상태 확인
    if (!admin.isActive) {
      return NextResponse.json(
        { error: '계정이 비활성화되어 있습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 생성
    const token = await createSuperAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });

    // 응답 생성
    const response = NextResponse.json({
      message: '로그인 성공',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      token, // 클라이언트에서 Authorization 헤더로 사용 가능
    });

    // 쿠키 설정
    response.headers.set('Set-Cookie', createTokenCookie(token));

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> };
      const errorMessages = zodError.errors?.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
