import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

interface ExcelRow {
  committee: string;
  department: string;
  leader: string;
}

interface UploadSummary {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: number;
}

// GET: 템플릿 다운로드 (현재 사역팀장 목록 포함)
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // 현재 모든 사역팀 조회
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        committee: { select: { name: true } },
        // 연도별 팀장 조회
        yearRoles: {
          where: {
            year,
            role: 'team_leader',
          },
          include: {
            user: { select: { username: true } },
          },
          take: 1,
        },
      },
      orderBy: [
        { committee: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
    });

    // 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('사역팀장목록');

    // 헤더 추가
    ws.columns = [
      { header: '위원회', key: 'committee', width: 20 },
      { header: '사역팀', key: 'department', width: 25 },
      { header: '팀장', key: 'leader', width: 15 },
    ];

    // 데이터 추가
    if (departments.length === 0) {
      ws.addRow({
        committee: '',
        department: '',
        leader: '',
      });
    } else {
      departments.forEach((dept) => {
        ws.addRow({
          committee: dept.committee.name,
          department: dept.name,
          leader: dept.yearRoles[0]?.user?.username || '',
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
      { item: '적용 연도', desc: String(year), example: '' },
      { item: '', desc: '', example: '' },
      { item: '위원회', desc: '위원회 이름 (필수)', example: '교육위원회' },
      { item: '사역팀', desc: '사역팀 이름 (필수)', example: '유년부' },
      { item: '팀장', desc: '팀장 이름 (사용자 이름과 일치해야 함)', example: '정혜종' },
      { item: '', desc: '', example: '' },
      { item: '※ 참고사항', desc: '', example: '' },
      { item: '- 팀장 비우기', desc: '팀장 열을 비워두면 팀장이 해제됩니다', example: '' },
      { item: '- 사용자 매칭', desc: '팀장 이름이 정확히 일치해야 합니다', example: '' },
      { item: '- 연도별 관리', desc: '팀장은 연도별로 관리됩니다', example: '' },
    ];
    guideData.forEach((row) => wsGuide.addRow(row));

    // Buffer로 변환
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leaders_template_${year}_${new Date().toISOString().split('T')[0]}.xlsx"`,
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

// POST: 엑셀 업로드 처리 (UserYearRole 생성/업데이트)
const handlePost: UserApiHandler = async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dryRun = formData.get('dryRun') === 'true';
    const year = parseInt(formData.get('year') as string) || new Date().getFullYear();

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

    // 헤더 정규화
    const rows: ExcelRow[] = rawRows.map((row) => {
      const normalized: ExcelRow = {
        committee: '',
        department: '',
        leader: '',
      };

      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('위원회') || lowerKey.includes('committee')) {
          normalized.committee = String(value || '').trim();
        } else if (lowerKey.includes('사역팀') || lowerKey.includes('department') || lowerKey.includes('부서')) {
          normalized.department = String(value || '').trim();
        } else if (lowerKey.includes('팀장') || lowerKey.includes('leader') || lowerKey.includes('담당')) {
          normalized.leader = String(value || '').trim();
        }
      }

      return normalized;
    });

    // 위원회 목록 조회
    const committees = await prisma.committee.findMany({
      where: { isActive: true },
      include: {
        departments: {
          where: { isActive: true },
        },
      },
    });

    // 위원회 이름 -> ID 매핑
    const committeeMap = new Map<string, string>();
    committees.forEach((c) => {
      committeeMap.set(c.name, c.id);
    });

    // 사역팀 (위원회ID + 이름) -> 사역팀 ID 매핑
    const departmentMap = new Map<string, string>();
    committees.forEach((c) => {
      c.departments.forEach((d) => {
        departmentMap.set(`${c.id}|${d.name}`, d.id);
      });
    });

    // 사용자 목록 조회
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true },
    });

    // 사용자 이름 -> ID 매핑
    const userMap = new Map<string, string>();
    users.forEach((u) => {
      userMap.set(u.username, u.id);
    });

    // 역할 ID 조회
    const teamLeaderRole = await prisma.role.findFirst({
      where: { code: 'team_leader' },
    });

    // 검증 및 처리 대상 분류
    const validationErrors: Array<{ fieldName: string; message: string }> = [];
    const toUpdate: Array<{ departmentId: string; userId: string | null; departmentName: string; leaderName: string }> = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // 헤더 + 1-based

      // 빈 행 스킵
      if (!row.committee && !row.department) {
        return;
      }

      if (!row.committee) {
        validationErrors.push({ fieldName: `행 ${rowNum}`, message: '위원회가 비어있습니다.' });
        return;
      }

      if (!row.department) {
        validationErrors.push({ fieldName: `행 ${rowNum}`, message: '사역팀이 비어있습니다.' });
        return;
      }

      // 위원회 찾기
      const committeeId = committeeMap.get(row.committee);
      if (!committeeId) {
        validationErrors.push({ fieldName: `행 ${rowNum}`, message: `위원회를 찾을 수 없습니다: ${row.committee}` });
        return;
      }

      // 사역팀 찾기
      const departmentId = departmentMap.get(`${committeeId}|${row.department}`);
      if (!departmentId) {
        validationErrors.push({ fieldName: `행 ${rowNum}`, message: `사역팀을 찾을 수 없습니다: ${row.committee} - ${row.department}` });
        return;
      }

      // 팀장 찾기 (비어있으면 null)
      let userId: string | null = null;
      if (row.leader) {
        userId = userMap.get(row.leader) ?? null;
        if (!userId) {
          validationErrors.push({ fieldName: `행 ${rowNum}`, message: `사용자를 찾을 수 없습니다: ${row.leader}` });
          return;
        }
      }

      toUpdate.push({
        departmentId,
        userId,
        departmentName: row.department,
        leaderName: row.leader || '(없음)',
      });
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

    const summary: UploadSummary = {
      totalRows: rows.filter((r) => r.committee || r.department).length,
      updated: toUpdate.length,
      skipped: 0,
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
          year,
          preview: toUpdate.slice(0, 10).map((u) => ({
            department: u.departmentName,
            leader: u.leaderName,
          })),
        },
      });
    }

    // 실제 DB 업데이트 (UserYearRole)
    for (const item of toUpdate) {
      if (item.userId) {
        // 팀장 설정: UserYearRole upsert
        await prisma.userYearRole.upsert({
          where: {
            userId_year_departmentId_role: {
              userId: item.userId,
              year,
              departmentId: item.departmentId,
              role: 'team_leader',
            },
          },
          update: {
            roleId: teamLeaderRole?.id,
          },
          create: {
            userId: item.userId,
            year,
            role: 'team_leader',
            roleId: teamLeaderRole?.id,
            departmentId: item.departmentId,
          },
        });
      } else {
        // 팀장 해제: 해당 부서의 기존 팀장 역할 삭제
        await prisma.userYearRole.deleteMany({
          where: {
            year,
            departmentId: item.departmentId,
            role: 'team_leader',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `업로드 완료: ${year}년도 ${summary.updated}개 사역팀 팀장 설정`,
      data: {
        summary,
        dryRun: false,
        year,
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

export const GET = withAdmin(handleGet);
export const POST = withAdmin(handlePost);
