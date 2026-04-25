/**
 * DB에서 예산 데이터를 조회하여 budget-seed.ts 형식으로 출력하는 스크립트
 * 실행: npx tsx scripts/export-budget-to-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('='.repeat(60));
  console.log('DB 예산 데이터 Export to budget-seed.ts');
  console.log('='.repeat(60));

  // 1. 각 테이블 데이터 조회 (필요한 필드만 선택)
  console.log('\n[1] 데이터 조회 중...');

  const committees = await prisma.committee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`   - Committee: ${committees.length}개`);

  const departments = await prisma.department.findMany({
    where: { isActive: true },
    select: { id: true, name: true, committeeId: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`   - Department: ${departments.length}개`);

  const budgetCategories = await prisma.budgetCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`   - BudgetCategory: ${budgetCategories.length}개`);

  const budgetSubcategories = await prisma.budgetSubcategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, categoryId: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`   - BudgetSubcategory: ${budgetSubcategories.length}개`);

  const budgetDetails = await prisma.budgetDetail.findMany({
    where: { isActive: true },
    select: { id: true, name: true, subcategoryId: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`   - BudgetDetail: ${budgetDetails.length}개`);

  const departmentBudgetDetails = await prisma.departmentBudgetDetail.findMany({
    where: {
      department: { isActive: true },
      budgetDetail: { isActive: true },
    },
    select: { id: true, departmentId: true, budgetDetailId: true },
  });
  console.log(`   - DepartmentBudgetDetail: ${departmentBudgetDetails.length}개`);

  const budgetDetailYears = await prisma.budgetDetailYear.findMany({
    where: { isActive: true },
    select: { id: true, budgetDetailId: true, year: true, budgetAmount: true, managerId: true, isActive: true },
    orderBy: { year: 'asc' },
  });
  console.log(`   - BudgetDetailYear: ${budgetDetailYears.length}개`);

  // 2. budget-seed.ts 파일 생성
  console.log('\n[2] budget-seed.ts 파일 생성 중...');

  const output = generateSeedFile({
    committees,
    departments,
    budgetCategories,
    budgetSubcategories,
    budgetDetails,
    departmentBudgetDetails,
    budgetDetailYears,
  });

  // 3. 파일 저장
  const outputPath = 'prisma/seeds/budget-seed.ts';
  fs.writeFileSync(outputPath, output);
  console.log(`\n[3] ✅ ${outputPath} 업데이트 완료!`);

  // 4. 통계 출력
  console.log('\n' + '='.repeat(60));
  console.log('통계 요약');
  console.log('='.repeat(60));
  console.log(`- Committee: ${committees.length}개`);
  console.log(`- Department: ${departments.length}개`);
  console.log(`- BudgetCategory: ${budgetCategories.length}개`);
  console.log(`- BudgetSubcategory: ${budgetSubcategories.length}개`);
  console.log(`- BudgetDetail: ${budgetDetails.length}개`);
  console.log(`- DepartmentBudgetDetail: ${departmentBudgetDetails.length}개`);
  console.log(`- BudgetDetailYear: ${budgetDetailYears.length}개`);

  await prisma.$disconnect();
  await pool.end();
}

interface BudgetData {
  committees: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  departments: Array<{
    id: string;
    name: string;
    committeeId: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  budgetCategories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  budgetSubcategories: Array<{
    id: string;
    name: string;
    categoryId: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  budgetDetails: Array<{
    id: string;
    name: string;
    subcategoryId: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  departmentBudgetDetails: Array<{
    id: string;
    departmentId: string;
    budgetDetailId: string;
  }>;
  budgetDetailYears: Array<{
    id: string;
    budgetDetailId: string;
    year: number;
    budgetAmount: number;
    managerId: string | null;
    isActive: boolean;
  }>;
}

function generateSeedFile(data: BudgetData): string {
  const today = new Date().toISOString().split('T')[0];

  let output = `/**
 * 예산 관련 시드 데이터
 * 생성일: ${today}
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

`;

  // Committee
  output += `// Committee (${data.committees.length}개)\n`;
  output += `const committees = ${JSON.stringify(data.committees, null, 2)};\n\n`;

  // Department
  output += `// Department (${data.departments.length}개)\n`;
  output += `const departments = ${JSON.stringify(data.departments, null, 2)};\n\n`;

  // BudgetCategory
  output += `// BudgetCategory (${data.budgetCategories.length}개)\n`;
  output += `const budgetCategories = ${JSON.stringify(data.budgetCategories, null, 2)};\n\n`;

  // BudgetSubcategory
  output += `// BudgetSubcategory (${data.budgetSubcategories.length}개)\n`;
  output += `const budgetSubcategories = ${JSON.stringify(data.budgetSubcategories, null, 2)};\n\n`;

  // BudgetDetail
  output += `// BudgetDetail (${data.budgetDetails.length}개)\n`;
  output += `const budgetDetails = ${JSON.stringify(data.budgetDetails, null, 2)};\n\n`;

  // DepartmentBudgetDetail
  output += `// DepartmentBudgetDetail (${data.departmentBudgetDetails.length}개)\n`;
  output += `const departmentBudgetDetails = ${JSON.stringify(data.departmentBudgetDetails, null, 2)};\n\n`;

  // BudgetDetailYear
  output += `// BudgetDetailYear (${data.budgetDetailYears.length}개)\n`;
  output += `const budgetDetailYears = ${JSON.stringify(data.budgetDetailYears, null, 2)};\n\n`;

  // main function
  output += `async function main() {
  console.log('🚀 예산 시드 시작...\\n');

  // 1. Committee
  console.log('📋 위원회(Committee) 시드 중...');
  for (const c of committees) {
    await prisma.committee.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(\`   ✅ \${committees.length}개 완료\\n\`);

  // 2. Department
  console.log('🏢 사역팀(Department) 시드 중...');
  for (const d of departments) {
    await prisma.department.upsert({ where: { id: d.id }, update: d, create: d });
  }
  console.log(\`   ✅ \${departments.length}개 완료\\n\`);

  // 3. BudgetCategory
  console.log('📁 예산항(BudgetCategory) 시드 중...');
  for (const c of budgetCategories) {
    await prisma.budgetCategory.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(\`   ✅ \${budgetCategories.length}개 완료\\n\`);

  // 4. BudgetSubcategory
  console.log('📂 예산목(BudgetSubcategory) 시드 중...');
  for (const s of budgetSubcategories) {
    await prisma.budgetSubcategory.upsert({ where: { id: s.id }, update: s, create: s });
  }
  console.log(\`   ✅ \${budgetSubcategories.length}개 완료\\n\`);

  // 5. BudgetDetail
  console.log('📝 예산세목(BudgetDetail) 시드 중...');
  for (const d of budgetDetails) {
    await prisma.budgetDetail.upsert({ where: { id: d.id }, update: d, create: d });
  }
  console.log(\`   ✅ \${budgetDetails.length}개 완료\\n\`);

  // 6. DepartmentBudgetDetail
  console.log('🔗 부서-세목 연결(DepartmentBudgetDetail) 시드 중...');
  for (const d of departmentBudgetDetails) {
    await prisma.departmentBudgetDetail.upsert({ where: { id: d.id }, update: d, create: d });
  }
  console.log(\`   ✅ \${departmentBudgetDetails.length}개 완료\\n\`);

  // 7. BudgetDetailYear
  console.log('📅 연도별 세목설정(BudgetDetailYear) 시드 중...');
  for (const y of budgetDetailYears) {
    await prisma.budgetDetailYear.upsert({ where: { id: y.id }, update: y, create: y });
  }
  console.log(\`   ✅ \${budgetDetailYears.length}개 완료\\n\`);

  console.log('🎉 모든 예산 시드 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
`;

  return output;
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
