/**
 * 사용자 목록 엑셀 내보내기 유틸리티
 */

import ExcelJS from 'exceljs';

// 사용자 인터페이스
export interface UserForExcel {
  userid: string;
  username: string;
  role: string;
  roleName?: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
}

// 엑셀 행 인터페이스
export interface UserExcelRow {
  아이디: string;
  이름: string;
  역할코드: string;
  역할명: string;
  부서: string;
  상태: string;
  등록일: string;
}

/**
 * 날짜를 엑셀 형식으로 변환 (YYYY-MM-DD)
 */
function formatDateForExcel(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 사용자 데이터를 엑셀 행으로 변환
 */
export function usersToExcelRows(
  users: UserForExcel[],
  getRoleName?: (role: string) => string
): UserExcelRow[] {
  return users.map((user) => ({
    아이디: user.userid,
    이름: user.username,
    역할코드: user.role,
    역할명: user.roleName || (getRoleName ? getRoleName(user.role) : user.role),
    부서: user.department || '-',
    상태: user.isActive ? '활성' : '비활성',
    등록일: formatDateForExcel(user.createdAt),
  }));
}

/**
 * 엑셀 워크북 생성
 */
export function generateUserExcelWorkbook(
  users: UserForExcel[],
  getRoleName?: (role: string) => string
): ExcelJS.Workbook {
  const rows = usersToExcelRows(users, getRoleName);

  // 워크북 생성
  const workbook = new ExcelJS.Workbook();

  // "사용자목록" 시트 추가
  const worksheet = workbook.addWorksheet('사용자목록');

  // 컬럼 정의
  worksheet.columns = [
    { header: '아이디', key: '아이디', width: 15 },
    { header: '이름', key: '이름', width: 12 },
    { header: '역할코드', key: '역할코드', width: 15 },
    { header: '역할명', key: '역할명', width: 15 },
    { header: '부서', key: '부서', width: 20 },
    { header: '상태', key: '상태', width: 10 },
    { header: '등록일', key: '등록일', width: 12 },
  ];

  // 데이터 행 추가
  for (const row of rows) {
    worksheet.addRow(row);
  }

  return workbook;
}

/**
 * 엑셀 파일 다운로드 (브라우저)
 */
export async function downloadUserExcel(
  users: UserForExcel[],
  getRoleName?: (role: string) => string,
  filename?: string
): Promise<void> {
  const workbook = generateUserExcelWorkbook(users, getRoleName);

  // 파일명 생성
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const defaultFilename = `사용자목록_${dateStr}.xlsx`;

  // Buffer로 변환
  const buffer = await workbook.xlsx.writeBuffer();

  // Blob으로 변환하여 다운로드
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
