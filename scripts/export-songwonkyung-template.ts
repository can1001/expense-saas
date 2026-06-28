/**
 * 송원경 행정간사 작성 지출결의서를 일괄 업로드 템플릿 형식의 엑셀로 출력.
 *
 * 동일 Expense는 같은 groupId(=expense.id 짧은 번호)로 묶고, ExpenseItem을
 * 행 단위로 펼쳐 EXCEL_ROW_HEADERS 순서대로 채움.
 *
 * 실행: npx tsx scripts/export-songwonkyung-template.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { EXCEL_ROW_HEADERS } from '../lib/services/bulk-expense-upload-service';

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  // YYYY-MM-DD (로컬)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function findApplicant(name: string) {
  // username 정확 매칭 우선, 그다음 contains
  let user = await prisma.user.findFirst({ where: { username: name } });
  if (!user) {
    const candidates = await prisma.user.findMany({
      where: { username: { contains: name } },
      select: { id: true, userid: true, username: true, department: true, isActive: true },
    });
    if (candidates.length === 0) {
      throw new Error(`사용자를 찾을 수 없습니다: "${name}"`);
    }
    if (candidates.length > 1) {
      console.error('동명 후보가 여럿입니다. 가장 활성 상태인 유저를 사용합니다:');
      candidates.forEach((c) =>
        console.error(`  - ${c.username} (userid=${c.userid}, dept=${c.department}, active=${c.isActive})`)
      );
    }
    user = await prisma.user.findFirstOrThrow({ where: { id: candidates[0].id } });
  }
  return user;
}

async function main() {
  const targetName = '송원경';
  const user = await findApplicant(targetName);
  console.log(`청구인 매칭: ${user.username} (userid=${user.userid}, id=${user.id})`);

  const expenses = await prisma.expense.findMany({
    where: { userId: user.id },
    include: {
      items: { orderBy: { order: 'asc' } },
    },
    orderBy: { requestDate: 'asc' },
  });
  console.log(`지출결의서 ${expenses.length}건, 총 항목 ${expenses.reduce((s, e) => s + e.items.length, 0)}건`);

  if (expenses.length === 0) {
    console.error('출력할 데이터가 없습니다.');
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'expense-system bulk-upload template';
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet('업로드데이터');
  const COLUMN_WIDTHS: Record<string, number> = {
    groupId: 10, committee: 14, department: 14,
    budgetCategory: 18, budgetSubcategory: 20, budgetDetail: 22,
    description: 30, unitPrice: 12, quantity: 8,
    requestDate: 12, expenseDate: 12,
    bankName: 12, accountNumber: 20, accountHolder: 12,
  };
  dataSheet.columns = EXCEL_ROW_HEADERS.map((h) => ({
    header: h, key: h, width: COLUMN_WIDTHS[h] ?? 14,
  }));
  const header = dataSheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  // 같은 expense 안에 항목이 여러 개면 같은 groupId(=숫자) 부여
  let groupCounter = 1;
  for (const e of expenses) {
    const groupId = e.items.length > 1 ? groupCounter++ : '';
    for (const item of e.items) {
      dataSheet.addRow({
        groupId: groupId,
        committee: e.committee,
        department: e.department,
        budgetCategory: item.budgetCategory,
        budgetSubcategory: item.budgetSubcategory,
        budgetDetail: item.budgetDetail,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        requestDate: fmtDate(e.requestDate),
        expenseDate: fmtDate(e.expenseDate),
        bankName: e.bankName,
        accountNumber: e.accountNumber,
        accountHolder: e.accountHolder,
      });
    }
  }

  // 메타 시트 — 검증 흐름과 사용법 안내
  const metaSheet = workbook.addWorksheet('안내');
  metaSheet.columns = [
    { header: '항목', key: 'k', width: 20 },
    { header: '값/설명', key: 'v', width: 80 },
  ];
  metaSheet.getRow(1).font = { bold: true };
  metaSheet.addRow({ k: '청구인', v: `${user.username} (userid=${user.userid})` });
  metaSheet.addRow({ k: '원본 지출결의서', v: `${expenses.length}건` });
  metaSheet.addRow({ k: '엑셀 행 수', v: dataSheet.rowCount - 1 });
  metaSheet.addRow({ k: 'groupId 규칙', v: '한 지출결의서에 항목이 2개 이상이면 같은 숫자, 단일항목이면 비움' });
  metaSheet.addRow({ k: '청구인 컬럼 없음', v: '업로드 수행자(로그인 사용자)가 자동 채워짐 — 송원경 본인이 업로드해야 함' });
  metaSheet.addRow({ k: '재업로드 시 검증', v: 'committee/department가 budgetDetail 실제 매핑과 일치하지 않으면 행 에러' });

  const outputDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'bulk-upload-template-songwonkyung.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log('='.repeat(60));
  console.log('템플릿 생성 완료');
  console.log('='.repeat(60));
  console.log(`파일 경로: ${outputPath}`);
  console.log(`업로드데이터 시트: ${dataSheet.rowCount - 1}행 (헤더 제외)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
