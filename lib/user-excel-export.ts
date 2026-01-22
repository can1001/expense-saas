/**
 * 사용자 목록 엑셀 내보내기 유틸리티
 */

import * as XLSX from 'xlsx';

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
): XLSX.WorkBook {
  const rows = usersToExcelRows(users, getRoleName);

  // 워크북 생성
  const workbook = XLSX.utils.book_new();

  // 데이터를 워크시트로 변환
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { wch: 15 },  // 아이디
    { wch: 12 },  // 이름
    { wch: 15 },  // 역할코드
    { wch: 15 },  // 역할명
    { wch: 20 },  // 부서
    { wch: 10 },  // 상태
    { wch: 12 },  // 등록일
  ];

  // "사용자목록" 시트로 추가
  XLSX.utils.book_append_sheet(workbook, worksheet, '사용자목록');

  return workbook;
}

/**
 * 엑셀 파일 다운로드 (브라우저)
 */
export function downloadUserExcel(
  users: UserForExcel[],
  getRoleName?: (role: string) => string,
  filename?: string
): void {
  const workbook = generateUserExcelWorkbook(users, getRoleName);

  // 파일명 생성
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const defaultFilename = `사용자목록_${dateStr}.xlsx`;

  // 다운로드
  XLSX.writeFile(workbook, filename || defaultFilename);
}
