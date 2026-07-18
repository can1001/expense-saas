import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import {
  createPendingSelectionToken,
  createUserToken,
  createUserTokenCookie,
  deriveLegacyFlags,
  PENDING_SELECTION_MAX_AGE_SECONDS,
  UserSession,
} from '@/lib/auth/user';
import {
  isKakaoConfigured,
  isKakaoOidcEnabled,
  KakaoConfigError,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';
import { findUserByProvider } from '@/lib/services/auth-account';
import { getMemberships } from '@/lib/services/membership';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { z } from 'zod';

const kakaoLoginSchema = z.object({
  kakaoAccessToken: z.string().min(1, '카카오 토큰을 입력하세요'),
  // OIDC(id_token) 분기용 예약 필드 — KAKAO_USE_OIDC 활성화 시 사용 (ARC-003 §5)
  idToken: z.string().optional(),
});

// POST /api/auth/kakao - 카카오 로그인 (ARC-003 §2, C2)
// 카카오 토큰은 서버측 kapi 검증에만 쓰고 세션으로 쓰지 않는다 — 응답은 항상 자체 JWT.
// 소셜 로그인은 "누구인지"만 판별하고, 소속 결정은 로그인(B2)과 동일하게 Membership이 담당.
export async function POST(request: NextRequest) {
  try {
    // 환경변수 미설정 시에도 코드가 죽지 않게 즉시 503 (한국어 안내)
    if (!isKakaoConfigured()) {
      return NextResponse.json(
        { error: '카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 503 }
      );
    }

    // OIDC 분기 지점 — 초기 구현은 액세스 토큰 + kapi 방식만 (ARC-003 §5)
    if (isKakaoOidcEnabled()) {
      return NextResponse.json(
        { error: '카카오 OIDC 로그인은 아직 지원되지 않습니다.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { kakaoAccessToken } = kakaoLoginSchema.parse(body);

    // 1. 서버측 카카오 토큰 검증 — 클라이언트가 보낸 토큰을 그대로 신뢰하지 않는다
    let providerUserId: string;
    try {
      ({ providerUserId } = await verifyKakaoAccessToken(kakaoAccessToken));
    } catch (error) {
      if (error instanceof KakaoConfigError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      if (error instanceof KakaoTokenError) {
        // 검증 실패(만료·위조) — 자체 토큰 미발급
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      throw error;
    }

    // 2. AuthAccount 연결 조회 — 이메일 매칭 자동 병합 금지 (공통 원칙 3, ARC-003 §4)
    const user = await findUserByProvider('kakao', providerUserId);

    // 연결 없음 → 초대 안내 응답 (C4 화면에서 사용). JWT·쿠키 미발급.
    if (!user) {
      return NextResponse.json({
        success: true,
        linked: false,
        message: '연결된 계정이 없습니다. 초대를 받은 후 이용할 수 있습니다.',
      });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: '계정이 비활성화되어 있습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    // 3. 소속 결정 — B2 로그인과 동일. Membership 조회 실패(백필 전)는 0건으로 폴백.
    const memberships = await getMemberships(user.id).catch(() => []);

    // 복수 소속: 최종 토큰 대신 선택용 임시 토큰 → 최종 토큰은 switch-tenant(B3)에서
    if (memberships.length > 1) {
      const pendingToken = await createPendingSelectionToken({
        id: user.id,
        userid: user.userid,
        username: user.username,
      });

      const response = NextResponse.json({
        success: true,
        linked: true,
        message: '소속 조직을 선택해주세요.',
        requiresTenantSelection: true,
        memberships: memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          orgType: m.tenant.orgType,
          role: m.role,
        })),
        token: pendingToken,
      });

      response.headers.set(
        'Set-Cookie',
        createUserTokenCookie(pendingToken, PENDING_SELECTION_MAX_AGE_SECONDS)
      );

      return response;
    }

    // 단일 소속은 Membership의 tenantId로, 0건은 기존 User.tenantId 그대로
    const sessionTenantId =
      memberships.length === 1 ? memberships[0].tenantId : user.tenantId || '';

    const tenant = await prismaBase.tenant.findUnique({
      where: { id: sessionTenantId },
      select: { id: true, name: true, subdomain: true, isActive: true },
    });

    if (!tenant?.isActive) {
      return NextResponse.json(
        { error: '이 조직은 현재 이용할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 4. 자체 JWT 발급 — 로그인과 동일한 roles-only 방식 (tenantId 클레임 유지)
    const roles = [user.role];
    const granted = user.canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const flags = deriveLegacyFlags(roles, granted);

    const session: UserSession = {
      id: user.id,
      tenantId: tenant.id,
      userid: user.userid,
      username: user.username,
      role: user.role,
      roles,
      roleId: user.roleId,
      department: user.department,
      granted,
      ...flags,
    };

    const token = await createUserToken(session);

    const response = NextResponse.json({
      success: true,
      linked: true,
      message: '로그인 성공',
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
        permissions: {
          canApprove: session.canApprove,
          canManageExpense: session.canManageExpense,
          canAccessAdmin: session.canAccessAdmin,
          canExportData: session.canExportData,
          canRegisterUsers: session.canRegisterUsers,
        },
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      token,
    });

    response.headers.set('Set-Cookie', createUserTokenCookie(token));

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '카카오 토큰을 입력해주세요.' },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
