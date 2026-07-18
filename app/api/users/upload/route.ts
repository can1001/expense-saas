import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { prisma, prismaBase } from '@/lib/prisma';
import { UserApiHandler, withPermissions } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getTenantIdOptional } from '@/lib/tenant-context';
import { roleCodeToMembershipRole } from '@/lib/services/membership';
import { getAllRoles } from '@/lib/services/user-service';

// 역할 코드 타입 (Role.code와 동일)
type UserRole = 'admin' | 'finance_head' | 'accountant' | 'finance_member' | 'team_leader' | 'admin_assistant' | 'user';

// 기본 비밀번호
const DEFAULT_PASSWORD = 'chc2026';

// 역할 한글 -> 영문 매핑
const ROLE_MAP: Record<string, UserRole> = {
  '관리자': 'admin',
  'admin': 'admin',
  '재정팀장': 'finance_head',
  'finance_head': 'finance_head',
  '회계': 'accountant',
  'accountant': 'accountant',
  '재정팀원': 'finance_member',
  'finance_member': 'finance_member',
  '팀장': 'team_leader',
  'team_leader': 'team_leader',
  '행정간사': 'admin_assistant',
  'admin_assistant': 'admin_assistant',
  '사용자': 'user',
  'user': 'user',
  '': 'user',
};

interface ExcelRow {
  userid: string;
  username: string;
  role?: string;
  department?: string;
  isActive?: boolean | string;
}

interface UploadSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

type UploadMode = 'merge' | 'append';

// GET: 템플릿 다운로드 (현재 사용자 목록 포함)
const handleGet: UserApiHandler = async () => {
  try {
    // 현재 모든 사용자 조회
    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
      select: {
        userid: true,
        username: true,
        role: true,
        department: true,
        isActive: true,
      },
    });

    // 역할 영문 -> 한글 매핑
    const roleDisplayMap: Record<UserRole, string> = {
      admin: '관리자',
      finance_head: '재정팀장',
      accountant: '회계',
      finance_member: '재정팀원',
      team_leader: '팀장',
      admin_assistant: '행정간사',
      user: '사용자',
    };

    // 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('사용자목록');

    // 헤더 추가
    ws.columns = [
      { header: 'userid (아이디)', key: 'userid', width: 25 },
      { header: 'username (이름)', key: 'username', width: 15 },
      { header: 'role (역할)', key: 'role', width: 15 },
      { header: 'department (부서)', key: 'department', width: 20 },
      { header: 'isActive (활성화)', key: 'isActive', width: 12 },
    ];

    // 데이터 추가
    if (users.length === 0) {
      ws.addRow({
        userid: '',
        username: '',
        role: '사용자',
        department: '',
        isActive: 'Y',
      });
    } else {
      users.forEach((user) => {
        ws.addRow({
          userid: user.userid,
          username: user.username,
          role: roleDisplayMap[user.role as UserRole] ?? user.role,
          department: user.department || '',
          isActive: user.isActive ? 'Y' : 'N',
        });
      });
    }

    // 안내 시트 추가
    const wsGuide = workbook.addWorksheet('작성안내');
    wsGuide.columns = [
      { header: '항목', key: 'item', width: 20 },
      { header: '설명', key: 'desc', width: 50 },
      { header: '예시', key: 'example', width: 20 },
    ];

    const guideData = [
      { item: 'userid (아이디)', desc: '로그인 아이디 (필수, 중복불가)', example: '청연정혜종' },
      { item: 'username (이름)', desc: '표시 이름 (필수)', example: '정혜종' },
      { item: 'role (역할)', desc: '역할 (관리자/재정팀장/회계/팀장/행정간사/사용자)', example: '사용자' },
      { item: 'department (부서)', desc: '소속 부서 (선택)', example: '재정팀' },
      { item: 'isActive (활성화)', desc: '활성화 여부 (Y/N)', example: 'Y' },
      { item: '', desc: '', example: '' },
      { item: '※ 참고사항', desc: '', example: '' },
      { item: '- 새 사용자', desc: '기본 비밀번호 chc2026 으로 생성됩니다', example: '' },
      { item: '- 기존 사용자', desc: '병합 모드에서 이름/역할/부서/활성화 상태가 업데이트됩니다', example: '' },
      { item: '- 비밀번호', desc: '엑셀로 변경할 수 없습니다 (보안)', example: '' },
    ];
    guideData.forEach((row) => wsGuide.addRow(row));

    // Buffer로 변환
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="users_template_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Template download error:', error);
    return NextResponse.json(
      { success: false, error: { type: 'DOWNLOAD_ERROR', message: '템플릿 다운로드 실패' } },
      { status: 500 }
    );
  }
};

// POST: 엑셀 업로드 처리
const handlePost: UserApiHandler = async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as UploadMode) || 'merge';
    const dryRun = formData.get('dryRun') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: { type: 'VALIDATION_ERROR', message: '파일이 필요합니다.' } },
        { status: 400 }
      );
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(Buffer.from(new Uint8Array(arrayBuffer)) as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { success: false, error: { type: 'VALIDATION_ERROR', message: '워크시트를 찾을 수 없습니다.' } },
        { status: 400 }
      );
    }

    // 헤더 행 읽기
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').toLowerCase();
    });

    // 데이터 행 읽기
    const rawRows: Record<string, unknown>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더 건너뛰기

      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });

      // 빈 행 건너뛰기
      if (Object.values(rowData).some((v) => v !== null && v !== undefined && v !== '')) {
        rawRows.push(rowData);
      }
    });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: { type: 'VALIDATION_ERROR', message: '데이터가 없습니다.' } },
        { status: 400 }
      );
    }

    // 헤더 정규화 (한글 헤더 매핑)
    const rows: ExcelRow[] = rawRows.map((row) => {
      const normalized: ExcelRow = {
        userid: '',
        username: '',
      };

      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('userid') || lowerKey.includes('아이디')) {
          normalized.userid = String(value || '').trim();
        } else if (lowerKey.includes('username') || lowerKey.includes('이름')) {
          normalized.username = String(value || '').trim();
        } else if (lowerKey.includes('role') || lowerKey.includes('역할')) {
          normalized.role = String(value || '').trim();
        } else if (lowerKey.includes('department') || lowerKey.includes('부서')) {
          normalized.department = String(value || '').trim() || undefined;
        } else if (lowerKey.includes('isactive') || lowerKey.includes('활성')) {
          const v = String(value || '').trim().toUpperCase();
          normalized.isActive = v === 'Y' || v === 'TRUE' || v === '1' || v === 'YES';
        }
      }

      return normalized;
    });

    // 검증
    const validationErrors: Array<{ fieldName: string; message: string }> = [];
    const validRows: ExcelRow[] = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // 헤더 + 1-based

      if (!row.userid) {
        validationErrors.push({ fieldName: `행 ${rowNum}`, message: 'userid(아이디)가 비어있습니다.' });
        return;
      }

      if (!row.username) {
        validationErrors.push({ fieldName: `행 ${rowNum}`, message: 'username(이름)이 비어있습니다.' });
        return;
      }

      // 역할 검증
      if (row.role) {
        const mappedRole = ROLE_MAP[row.role];
        if (!mappedRole) {
          validationErrors.push({
            fieldName: `행 ${rowNum}`,
            message: `유효하지 않은 역할: ${row.role}`,
          });
          return;
        }
        row.role = mappedRole;
      } else {
        row.role = 'user';
      }

      // isActive 기본값
      if (row.isActive === undefined) {
        row.isActive = true;
      }

      validRows.push(row);
    });

    // 중복 userid 체크 (파일 내)
    const useridCounts = new Map<string, number>();
    validRows.forEach((row) => {
      const count = useridCounts.get(row.userid) || 0;
      useridCounts.set(row.userid, count + 1);
    });

    useridCounts.forEach((count, userid) => {
      if (count > 1) {
        validationErrors.push({
          fieldName: userid,
          message: `파일 내 중복된 userid: ${userid} (${count}회)`,
        });
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: `검증 오류 ${validationErrors.length}건`,
          fields: validationErrors,
        },
      });
    }

    // 기존 사용자 조회
    const existingUsers = await prisma.user.findMany({
      select: { id: true, userid: true },
    });
    const existingUserMap = new Map(existingUsers.map((u) => [u.userid, u.id]));

    // 처리 대상 분류
    const toCreate: ExcelRow[] = [];
    const toUpdate: Array<ExcelRow & { existingId: string }> = [];

    validRows.forEach((row) => {
      const existingId = existingUserMap.get(row.userid);
      if (existingId) {
        if (mode === 'merge') {
          toUpdate.push({ ...row, existingId });
        }
        // append 모드에서는 기존 사용자 건너뜀
      } else {
        toCreate.push(row);
      }
    });

    const summary: UploadSummary = {
      totalRows: validRows.length,
      created: toCreate.length,
      updated: toUpdate.length,
      skipped: validRows.length - toCreate.length - toUpdate.length,
      errors: 0,
    };

    // Dry run이면 여기서 반환
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: '검증 완료 (미리보기)',
        data: {
          summary,
          dryRun: true,
          mode,
        },
      });
    }

    // 실제 DB 작업
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 생성 — User 생성과 Membership 이중 기록(ARC-002 §2.2)을 한 트랜잭션으로 묶는다.
    // 대량 경로도 생성 시점에 소속을 함께 기록해 /api/me/memberships·switch-tenant 누락을 막는다.
    const tenantId = getTenantIdOptional();
    // 역할 코드 → roleId 맵 (단일 createUser와 동일하게 roleRef를 채운다).
    // 누락 시 커스텀 Role.permissions 대신 코드 프리셋으로 폴백돼 어드민 생성 유저와 동작이 갈린다.
    const rolesByCode = new Map<string, string>(
      (await getAllRoles()).map((r) => [r.code, r.id] as [string, string])
    );
    if (toCreate.length > 0) {
      await prismaBase.$transaction(async (tx) => {
        await tx.user.createMany({
          data: toCreate.map((row) => ({
            userid: row.userid,
            username: row.username,
            role: row.role as UserRole,
            roleId: rolesByCode.get(row.role as string) ?? null,
            department: row.department || null,
            isActive: row.isActive === true || row.isActive === 'true',
            password: hashedPassword,
            ...(tenantId ? { tenantId } : {}),
          })),
          skipDuplicates: true,
        });

        // 테넌트 컨텍스트가 있을 때만 소속 기록 (없으면 tenantId 없는 사용자 — 기존 동작 유지)
        if (tenantId) {
          const createdUsers = await tx.user.findMany({
            where: { tenantId, userid: { in: toCreate.map((r) => r.userid) } },
            select: { id: true, role: true },
          });
          if (createdUsers.length > 0) {
            await tx.membership.createMany({
              // isDefault: true — 대량 생성은 항상 신규 유저(테넌트 내 userid 유니크)의 첫 소속이므로 안전.
              // 기존 유저 재사용 경로가 생기면 이 불변식을 재검토해야 한다(이중 default 위험).
              data: createdUsers.map((u) => ({
                userId: u.id,
                tenantId,
                role: roleCodeToMembershipRole(u.role),
                isDefault: true,
              })),
              skipDuplicates: true,
            });
          }
        }
      });
    }

    // 업데이트
    for (const row of toUpdate) {
      await prisma.user.update({
        where: { id: row.existingId },
        data: {
          username: row.username,
          role: row.role as UserRole,
          department: row.department || null,
          isActive: row.isActive === true || row.isActive === 'true',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `업로드 완료: ${summary.created}명 생성, ${summary.updated}명 업데이트`,
      data: {
        summary,
        dryRun: false,
        mode,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : '업로드 처리 중 오류 발생',
        },
      },
      { status: 500 }
    );
  }
};

export const GET = withPermissions(PERMISSIONS.USER_MANAGE, handleGet);
export const POST = withPermissions(PERMISSIONS.USER_MANAGE, handlePost);
