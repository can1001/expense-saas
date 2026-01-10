import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// 역할 코드 타입 (Role.code와 동일)
type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

// 기본 비밀번호
const DEFAULT_PASSWORD = 'chc2026';

// 유효한 역할 목록
const VALID_ROLES: UserRole[] = ['admin', 'finance_head', 'accountant', 'team_leader', 'admin_assistant', 'user'];

// 역할 한글 -> 영문 매핑
const ROLE_MAP: Record<string, UserRole> = {
  '관리자': 'admin',
  'admin': 'admin',
  '재정팀장': 'finance_head',
  'finance_head': 'finance_head',
  '회계': 'accountant',
  'accountant': 'accountant',
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
export async function GET() {
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
      team_leader: '팀장',
      admin_assistant: '행정간사',
      user: '사용자',
    };

    // 엑셀 데이터 생성
    const data = users.map((user) => ({
      'userid (아이디)': user.userid,
      'username (이름)': user.username,
      'role (역할)': roleDisplayMap[user.role as UserRole] ?? user.role,
      'department (부서)': user.department || '',
      'isActive (활성화)': user.isActive ? 'Y' : 'N',
    }));

    // 빈 행 추가 (새 사용자 등록용)
    if (data.length === 0) {
      data.push({
        'userid (아이디)': '',
        'username (이름)': '',
        'role (역할)': '사용자',
        'department (부서)': '',
        'isActive (활성화)': 'Y',
      });
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 25 }, // userid
      { wch: 15 }, // username
      { wch: 15 }, // role
      { wch: 20 }, // department
      { wch: 12 }, // isActive
    ];

    XLSX.utils.book_append_sheet(wb, ws, '사용자목록');

    // 안내 시트 추가
    const guideData = [
      { 항목: 'userid (아이디)', 설명: '로그인 아이디 (필수, 중복불가)', 예시: '청연정혜종' },
      { 항목: 'username (이름)', 설명: '표시 이름 (필수)', 예시: '정혜종' },
      { 항목: 'role (역할)', 설명: '역할 (관리자/재정팀장/회계/팀장/행정간사/사용자)', 예시: '사용자' },
      { 항목: 'department (부서)', 설명: '소속 부서 (선택)', 예시: '재정팀' },
      { 항목: 'isActive (활성화)', 설명: '활성화 여부 (Y/N)', 예시: 'Y' },
      { 항목: '', 설명: '', 예시: '' },
      { 항목: '※ 참고사항', 설명: '', 예시: '' },
      { 항목: '- 새 사용자', 설명: '기본 비밀번호 chc2026 으로 생성됩니다', 예시: '' },
      { 항목: '- 기존 사용자', 설명: '병합 모드에서 이름/역할/부서/활성화 상태가 업데이트됩니다', 예시: '' },
      { 항목: '- 비밀번호', 설명: '엑셀로 변경할 수 없습니다 (보안)', 예시: '' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, '작성안내');

    // Buffer로 변환
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

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
}

// POST: 엑셀 업로드 처리
export async function POST(request: NextRequest) {
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
      select: { userid: true },
    });
    const existingUserIds = new Set(existingUsers.map((u) => u.userid));

    // 처리 대상 분류
    const toCreate: ExcelRow[] = [];
    const toUpdate: ExcelRow[] = [];

    validRows.forEach((row) => {
      if (existingUserIds.has(row.userid)) {
        if (mode === 'merge') {
          toUpdate.push(row);
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

    // 생성
    if (toCreate.length > 0) {
      await prisma.user.createMany({
        data: toCreate.map((row) => ({
          userid: row.userid,
          username: row.username,
          role: row.role as UserRole,
          department: row.department || null,
          isActive: row.isActive === true || row.isActive === 'true',
          password: hashedPassword,
        })),
        skipDuplicates: true,
      });
    }

    // 업데이트
    for (const row of toUpdate) {
      await prisma.user.update({
        where: { userid: row.userid },
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
}
