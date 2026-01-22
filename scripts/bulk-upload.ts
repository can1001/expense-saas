/**
 * 지출결의서 일괄 업로드 스크립트
 *
 * 사용법:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bulk-upload.ts <excel-file-path>
 *
 * 또는 npm script:
 *   npm run bulk-upload -- ./data/expenses.xlsx
 *
 * Excel 파일 형식:
 *   - category: 예산(항)
 *   - subcategory: 예산(목)
 *   - detail: 예산(세목)
 *   - description: 적요
 *   - unitPrice: 단가
 *   - quantity: 수량
 *   - requestDate: 청구일자 (YYYY-MM-DD)
 *   - expenseDate: 지출일자 (YYYY-MM-DD, 선택)
 *   - applicantName: 청구인
 *   - bankName: 은행명
 *   - accountNumber: 계좌번호
 *   - accountHolder: 예금주
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Prisma 클라이언트 초기화
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 금액 계산 함수 (절삭 없음)
function calculateAmount(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

// Excel 행 데이터 타입
interface ExcelRow {
  // 예산 정보 (필수)
  category: string;
  subcategory: string;
  detail: string;

  // 항목 정보
  description: string;
  unitPrice: number;
  quantity: number;

  // 청구 정보
  requestDate: string | Date;
  expenseDate?: string | Date;
  applicantName: string;
  applicantTitle?: string;

  // 은행 정보
  bankName: string;
  accountNumber: string;
  accountHolder: string;

  // 그룹핑용 (같은 groupId는 같은 지출결의서로 묶임)
  groupId?: string | number;
}

// 예산 조회 결과 캐시 (정규화 테이블 사용)
const budgetCache = new Map<string, { committee: string; department: string } | null>();

/**
 * 정규화된 테이블에서 category, subcategory, detail로 committee, department 조회
 * BudgetDetail → DepartmentBudgetDetail → Department → Committee
 */
async function findBudgetInfo(
  category: string,
  subcategory: string,
  detail: string
): Promise<{ committee: string; department: string } | null> {
  const cacheKey = `${category}|${subcategory}|${detail}`;

  if (budgetCache.has(cacheKey)) {
    return budgetCache.get(cacheKey) || null;
  }

  // BudgetDetail 조회
  const budgetDetail = await prisma.budgetDetail.findFirst({
    where: {
      name: detail,
      isActive: true,
      subcategory: {
        name: subcategory,
        category: {
          name: category,
        },
      },
    },
    include: {
      departmentDetails: {
        where: { isActive: true },
        include: {
          department: {
            include: {
              committee: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (budgetDetail && budgetDetail.departmentDetails.length > 0) {
    const dept = budgetDetail.departmentDetails[0].department;
    const result = {
      committee: dept.committee.name,
      department: dept.name,
    };
    budgetCache.set(cacheKey, result);
    return result;
  }

  budgetCache.set(cacheKey, null);
  return null;
}

/**
 * 날짜 파싱 함수
 */
function parseDate(value: string | Date | number | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    // Excel 시리얼 날짜 변환
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Excel 파일 읽기
 */
function readExcelFile(filePath: string): ExcelRow[] {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${absolutePath}`);
  }

  const workbook = XLSX.readFile(absolutePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  if (rows.length === 0) {
    throw new Error('Excel 파일에 데이터가 없습니다.');
  }

  return rows;
}

/**
 * 행 데이터 검증
 */
function validateRow(row: ExcelRow, index: number): string[] {
  const errors: string[] = [];
  const rowNum = index + 2; // Excel 행 번호 (헤더 + 1-based index)

  if (!row.category) errors.push(`행 ${rowNum}: category(예산항) 누락`);
  if (!row.subcategory) errors.push(`행 ${rowNum}: subcategory(예산목) 누락`);
  if (!row.detail) errors.push(`행 ${rowNum}: detail(예산세목) 누락`);
  if (!row.description) errors.push(`행 ${rowNum}: description(적요) 누락`);
  if (!row.unitPrice || row.unitPrice <= 0) errors.push(`행 ${rowNum}: unitPrice(단가) 유효하지 않음`);
  if (!row.quantity || row.quantity <= 0) errors.push(`행 ${rowNum}: quantity(수량) 유효하지 않음`);
  if (!row.requestDate) errors.push(`행 ${rowNum}: requestDate(청구일자) 누락`);
  if (!row.applicantName) errors.push(`행 ${rowNum}: applicantName(청구인) 누락`);
  if (!row.bankName) errors.push(`행 ${rowNum}: bankName(은행명) 누락`);
  if (!row.accountNumber) errors.push(`행 ${rowNum}: accountNumber(계좌번호) 누락`);
  if (!row.accountHolder) errors.push(`행 ${rowNum}: accountHolder(예금주) 누락`);

  return errors;
}

/**
 * 행들을 지출결의서 단위로 그룹핑
 * groupId가 있으면 같은 groupId끼리 묶고, 없으면 각 행이 개별 지출결의서
 */
function groupRows(rows: ExcelRow[]): Map<string, ExcelRow[]> {
  const groups = new Map<string, ExcelRow[]>();

  rows.forEach((row, index) => {
    const groupKey = row.groupId?.toString() || `single_${index}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(row);
  });

  return groups;
}

/**
 * 지출결의서 생성
 */
async function createExpense(rows: ExcelRow[]): Promise<{ success: boolean; id?: string; error?: string }> {
  const firstRow = rows[0];

  // BudgetMaster에서 committee, department 조회
  const budgetInfo = await findBudgetInfo(
    firstRow.category.trim(),
    firstRow.subcategory.trim(),
    firstRow.detail.trim()
  );

  if (!budgetInfo) {
    return {
      success: false,
      error: `예산 정보를 찾을 수 없습니다: ${firstRow.category} / ${firstRow.subcategory} / ${firstRow.detail}`,
    };
  }

  // 항목 데이터 생성
  const items = rows.map((row, index) => ({
    budgetDetail: row.detail.trim(),
    description: row.description.trim(),
    unitPrice: Math.floor(Number(row.unitPrice)),
    quantity: Math.floor(Number(row.quantity)),
    amount: calculateAmount(Number(row.unitPrice), Number(row.quantity)),
    order: index + 1,
  }));

  // 총 청구금액 계산
  const requestAmount = items.reduce((sum, item) => sum + item.amount, 0);

  // 날짜 파싱
  const requestDate = parseDate(firstRow.requestDate);
  const expenseDate = parseDate(firstRow.expenseDate);

  if (!requestDate) {
    return {
      success: false,
      error: `청구일자 파싱 실패: ${firstRow.requestDate}`,
    };
  }

  try {
    // 청구인 이름으로 사용자 찾기
    const applicantName = firstRow.applicantName.trim();
    let user = await prisma.user.findFirst({
      where: { username: applicantName },
    });

    // 사용자가 없으면 admin 사용자 사용
    if (!user) {
      user = await prisma.user.findFirst({
        where: { role: 'admin' },
      });
    }

    if (!user) {
      return {
        success: false,
        error: `사용자를 찾을 수 없습니다: ${applicantName}`,
      };
    }

    const expense = await prisma.expense.create({
      data: {
        userId: user.id,
        committee: budgetInfo.committee,
        department: budgetInfo.department,
        budgetCategory: firstRow.category.trim(),
        budgetSubcategory: firstRow.subcategory.trim(),
        expenseDate,
        requestAmount,
        requestDate,
        requestTeam: '출납팀',
        applicantName: applicantName,
        applicantTitle: firstRow.applicantTitle?.trim() || null,
        bankName: firstRow.bankName.trim(),
        accountNumber: String(firstRow.accountNumber).trim(),
        accountHolder: firstRow.accountHolder.trim(),
        items: {
          create: items,
        },
      },
    });

    return { success: true, id: expense.id };
  } catch (error: any) {
    return {
      success: false,
      error: `DB 저장 실패: ${error.message}`,
    };
  }
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('사용법: npm run bulk-upload -- <excel-file-path>');
    console.log('');
    console.log('Excel 파일 필수 컬럼:');
    console.log('  - category: 예산(항)');
    console.log('  - subcategory: 예산(목)');
    console.log('  - detail: 예산(세목)');
    console.log('  - description: 적요');
    console.log('  - unitPrice: 단가');
    console.log('  - quantity: 수량');
    console.log('  - requestDate: 청구일자');
    console.log('  - applicantName: 청구인');
    console.log('  - bankName: 은행명');
    console.log('  - accountNumber: 계좌번호');
    console.log('  - accountHolder: 예금주');
    console.log('');
    console.log('선택 컬럼:');
    console.log('  - expenseDate: 지출일자');
    console.log('  - applicantTitle: 직책');
    console.log('  - groupId: 그룹ID (같은 ID는 하나의 지출결의서로 묶임)');
    process.exit(1);
  }

  const filePath = args[0];
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('지출결의서 일괄 업로드');
  console.log('='.repeat(60));
  console.log(`파일: ${filePath}`);
  console.log(`모드: ${dryRun ? 'DRY RUN (실제 저장 안 함)' : '실제 업로드'}`);
  console.log('');

  try {
    // 1. Excel 파일 읽기
    console.log('📂 Excel 파일 읽는 중...');
    const rows = readExcelFile(filePath);
    console.log(`   ${rows.length}개 행 읽음`);

    // 2. 데이터 검증
    console.log('');
    console.log('🔍 데이터 검증 중...');
    const allErrors: string[] = [];
    rows.forEach((row, index) => {
      const errors = validateRow(row, index);
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      console.log('');
      console.log('❌ 검증 오류:');
      allErrors.forEach((err) => console.log(`   ${err}`));
      process.exit(1);
    }
    console.log('   ✅ 검증 통과');

    // 3. 그룹핑
    console.log('');
    console.log('📦 지출결의서 그룹핑 중...');
    const groups = groupRows(rows);
    console.log(`   ${groups.size}개 지출결의서 생성 예정`);

    // 4. BudgetMaster 조회 테스트
    console.log('');
    console.log('🔎 예산 정보 확인 중...');
    const budgetErrors: string[] = [];
    for (const [groupKey, groupRows] of groups) {
      const firstRow = groupRows[0];
      const budgetInfo = await findBudgetInfo(
        firstRow.category.trim(),
        firstRow.subcategory.trim(),
        firstRow.detail.trim()
      );
      if (!budgetInfo) {
        budgetErrors.push(
          `그룹 ${groupKey}: ${firstRow.category} / ${firstRow.subcategory} / ${firstRow.detail}`
        );
      }
    }

    if (budgetErrors.length > 0) {
      console.log('');
      console.log('❌ 예산 정보를 찾을 수 없음:');
      budgetErrors.forEach((err) => console.log(`   ${err}`));
      process.exit(1);
    }
    console.log('   ✅ 모든 예산 정보 확인됨');

    // 5. Dry run이면 여기서 종료
    if (dryRun) {
      console.log('');
      console.log('='.repeat(60));
      console.log('DRY RUN 완료 - 실제 데이터는 저장되지 않았습니다.');
      console.log('실제 업로드하려면 --dry-run 옵션을 제거하세요.');
      console.log('='.repeat(60));
      process.exit(0);
    }

    // 6. 지출결의서 생성
    console.log('');
    console.log('💾 지출결의서 생성 중...');
    let successCount = 0;
    let failCount = 0;
    const results: { groupKey: string; success: boolean; id?: string; error?: string }[] = [];

    for (const [groupKey, groupRows] of groups) {
      const result = await createExpense(groupRows);
      results.push({ groupKey, ...result });

      if (result.success) {
        successCount++;
        console.log(`   ✅ 그룹 ${groupKey}: ${result.id}`);
      } else {
        failCount++;
        console.log(`   ❌ 그룹 ${groupKey}: ${result.error}`);
      }
    }

    // 7. 결과 출력
    console.log('');
    console.log('='.repeat(60));
    console.log('업로드 완료');
    console.log('='.repeat(60));
    console.log(`성공: ${successCount}개`);
    console.log(`실패: ${failCount}개`);
    console.log(`총합: ${groups.size}개`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('');
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
