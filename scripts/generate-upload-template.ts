/**
 * 일괄 업로드용 Excel 템플릿 생성 스크립트
 *
 * 사용법:
 *   npm run generate-template
 *
 * 내부 로직은 lib/services/bulk-expense-template.ts 공용 (웹 API와 동일).
 */

import * as path from 'path';
import * as fs from 'fs';
import { buildExpenseTemplateWorkbook } from '@/lib/services/bulk-expense-template';

async function main() {
  const buffer = await buildExpenseTemplateWorkbook();

  const outputDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'bulk-upload-template.xlsx');
  fs.writeFileSync(outputPath, buffer);

  console.log('='.repeat(60));
  console.log('일괄 업로드 템플릿 생성 완료');
  console.log('='.repeat(60));
  console.log(`파일 경로: ${outputPath}`);
  console.log('');
  console.log('사용법:');
  console.log('  1. 템플릿 파일을 열어 "업로드데이터" 시트에 데이터 입력');
  console.log('  2. groupId가 같은 행들은 하나의 지출결의서로 묶임');
  console.log('  3. npm run bulk-upload -- ./templates/bulk-upload-template.xlsx');
  console.log('');
  console.log('Dry Run (검증만):');
  console.log('  npm run bulk-upload -- ./templates/bulk-upload-template.xlsx --dry-run');
}

main();
