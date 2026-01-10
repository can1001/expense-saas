import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';

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
export async function GET() {
  try {
    // 현재 모든 사역팀 조회 (위원회, 팀장 포함)
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        committee: { select: { name: true } },
        leader: { select: { username: true } },
      },
      orderBy: [
        { committee: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
    });

    // 엑셀 데이터 생성
    const data = departments.map((dept) => ({
      '위원회': dept.committee.name,
      '사역팀': dept.name,
      '팀장': dept.leader?.username || '',
    }));

    // 빈 행 추가 (없는 경우)
    if (data.length === 0) {
      data.push({
        '위원회': '',
        '사역팀': '',
        '팀장': '',
      });
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 20 }, // 위원회
      { wch: 25 }, // 사역팀
      { wch: 15 }, // 팀장
    ];

    XLSX.utils.book_append_sheet(wb, ws, '사역팀장목록');

    // 안내 시트 추가
    const guideData = [
      { 항목: '위원회', 설명: '위원회 이름 (필수)', 예시: '교육위원회' },
      { 항목: '사역팀', 설명: '사역팀 이름 (필수)', 예시: '유년부' },
      { 항목: '팀장', 설명: '팀장 이름 (사용자 이름과 일치해야 함)', 예시: '정혜종' },
      { 항목: '', 설명: '', 예시: '' },
      { 항목: '※ 참고사항', 설명: '', 예시: '' },
      { 항목: '- 팀장 비우기', 설명: '팀장 열을 비워두면 팀장이 해제됩니다', 예시: '' },
      { 항목: '- 사용자 매칭', 설명: '팀장 이름이 정확히 일치해야 합니다', 예시: '' },
      { 항목: '- 사역팀 매칭', 설명: '위원회 + 사역팀 조합으로 찾습니다', 예시: '' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, '작성안내');

    // Buffer로 변환
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leaders_template_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Template download error:', error);
    return NextResponse.json(
      { success: false, error: { type: 'DOWNLOAD_ERROR', message: '템플릿 다운로드 실패' } },
      { status: 500 }
    );
  }
}

// POST: 엑셀 업로드 처리
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dryRun = formData.get('dryRun') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: { type: 'VALIDATION_ERROR', message: '파일이 필요합니다.' } },
        { status: 400 }
      );
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

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

    // 검증 및 처리 대상 분류
    const validationErrors: Array<{ fieldName: string; message: string }> = [];
    const toUpdate: Array<{ departmentId: string; leaderId: string | null; departmentName: string; leaderName: string }> = [];

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
      let leaderId: string | null = null;
      if (row.leader) {
        leaderId = userMap.get(row.leader) ?? null;
        if (!leaderId) {
          validationErrors.push({ fieldName: `행 ${rowNum}`, message: `사용자를 찾을 수 없습니다: ${row.leader}` });
          return;
        }
      }

      toUpdate.push({
        departmentId,
        leaderId,
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
          preview: toUpdate.slice(0, 10).map((u) => ({
            department: u.departmentName,
            leader: u.leaderName,
          })),
        },
      });
    }

    // 실제 DB 업데이트
    for (const item of toUpdate) {
      await prisma.department.update({
        where: { id: item.departmentId },
        data: { leaderId: item.leaderId },
      });
    }

    return NextResponse.json({
      success: true,
      message: `업로드 완료: ${summary.updated}개 사역팀 팀장 설정`,
      data: {
        summary,
        dryRun: false,
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
}
