/**
 * 지출결의서 일괄 업로드 스크립트
 *
 * 사용법:
 *   npm run bulk-upload -- <excel-file-path>           # 실제 업로드
 *   npm run bulk-upload -- <excel-file-path> --dry-run # 검증만
 *
 * 내부 로직은 lib/services/bulk-expense-upload-service.ts 공용.
 * 청구인 매칭 실패는 admin 폴백 없이 에러로 처리 (스펙 결정).
 */

import * as path from 'path';
import * as fs from 'fs';
import { prisma } from '@/lib/prisma';
import {
  parseExpenseExcelBuffer,
  executeBulkUpload,
} from '@/lib/services/bulk-expense-upload-service';

function printUsage() {
  console.log('사용법: npm run bulk-upload -- <excel-file-path> [--dry-run]');
  console.log('');
  console.log('Excel 파일 형식은 docs/BULK_UPLOAD.md 참고');
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!fileArg) {
    printUsage();
    process.exit(1);
  }

  const absolutePath = path.resolve(fileArg);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${absolutePath}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('지출결의서 일괄 업로드');
  console.log('='.repeat(60));
  console.log(`파일: ${fileArg}`);
  console.log(`모드: ${dryRun ? 'DRY RUN (실제 저장 안 함)' : '실제 업로드'}`);
  console.log('');

  try {
    console.log('📂 Excel 파일 읽는 중...');
    const buffer = fs.readFileSync(absolutePath);
    const rows = await parseExpenseExcelBuffer(buffer);
    console.log(`   ${rows.length}개 행 읽음`);

    if (rows.length === 0) {
      console.error('❌ Excel 파일에 데이터가 없습니다.');
      process.exit(1);
    }

    console.log('');
    console.log(dryRun ? '🔍 검증 중 (dry-run)...' : '💾 일괄 업로드 시도 중...');
    const result = await executeBulkUpload(rows, { dryRun });

    if (result.errors.length > 0) {
      console.log('');
      console.log('❌ 오류 발견:');
      result.errors.forEach((e) => {
        const loc = e.groupId ? `행 ${e.rowNumber}(그룹 ${e.groupId})` : `행 ${e.rowNumber}`;
        const fld = e.field ? ` [${e.field}]` : '';
        console.log(`   ${loc}${fld}: ${e.message}`);
      });
      process.exit(1);
    }

    if (dryRun) {
      console.log('');
      console.log(`   ✅ 검증 통과: ${result.totalExpenses}개 지출결의서 생성 예정`);
      console.log('');
      console.log('미리보기:');
      (result.preview || []).forEach((p) => {
        console.log(
          `   - 그룹 ${p.groupId}: ${p.committee}/${p.department} · ${p.applicantName} · ${p.itemsCount}개 항목 · ${p.requestAmount.toLocaleString()}원`
        );
      });
      console.log('');
      console.log('='.repeat(60));
      console.log('DRY RUN 완료 - 실제 데이터는 저장되지 않았습니다.');
      console.log('실제 업로드: --dry-run 옵션을 제거하세요.');
      console.log('='.repeat(60));
      return;
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`✅ 업로드 완료: ${result.createdIds?.length || 0}개 생성`);
    console.log('='.repeat(60));
    (result.createdIds || []).forEach((id) => console.log(`   - ${id}`));
  } catch (err) {
    console.error('');
    console.error('❌ 오류 발생:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
