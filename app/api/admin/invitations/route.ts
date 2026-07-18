import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { UserApiHandler, withPermissions } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createInvitation, listInvitations } from '@/lib/services/invitation';
import { MEMBERSHIP_ROLES } from '@/lib/services/membership';
import { z } from 'zod';

// tenantId는 세션(JWT 클레임)에서만 — 바디로 받지 않는다 (공통 원칙 2)
const createInvitationSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.').optional(),
  role: z.enum(MEMBERSHIP_ROLES).optional(),
});

/**
 * GET /api/admin/invitations
 * 초대 목록 조회 (세션 테넌트 스코프)
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const invitations = await listInvitations(user.tenantId);
    return NextResponse.json(invitations);
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * POST /api/admin/invitations
 * 초대 생성 — 토큰(랜덤 32바이트)은 응답으로 반환해 어드민이 초대 링크로 전달한다
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = createInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: '초대 정보가 올바르지 않습니다. 이메일과 역할(TENANT_ADMIN/MEMBER)을 확인해주세요.' },
        { status: 400 }
      );
    }

    const invitation = await createInvitation({
      tenantId: user.tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedById: user.id,
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withPermissions(PERMISSIONS.USER_REGISTER, handleGet);
export const POST = withPermissions(PERMISSIONS.USER_REGISTER, handlePost);
