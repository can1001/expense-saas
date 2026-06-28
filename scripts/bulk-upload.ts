/**
 * 지출결의서 일괄 업로드 스크립트
 *
 * 사용법:
 *   npm run bulk-upload -- <excel-file-path> --as <username>           # 실제 업로드
 *   npm run bulk-upload -- <excel-file-path> --as <username> --dry-run # 검증만
 *
 * --as <username>: 생성될 지출결의서의 청구인(userId/applicantName)으로 사용할 사용자.
 *                  웹 UI는 로그인 사용자가 자동으로 지정되지만 CLI는 명시 필요.
 */

import * as path from 'path';
import * as fs from 'fs';
import { prisma } from '@/lib/prisma';
import {
  parseExpenseExcelBuffer,
  executeBulkUpload,
} from '@/lib/services/bulk-expense-upload-service';

function printUsage() {
  console.log('사용법: npm run bulk-upload -- <excel-file-path> --as <username> [--dry-run]');
  console.log('');
  console.log('  --as <username>  생성될 지출결의서의 청구인 (필수)');
  console.log('  --dry-run        실제 저장 없이 검증만');
  console.log('');
  console.log('Excel 파일 형식은 docs/BULK_UPLOAD.md 참고');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const asIdx = args.indexOf('--as');
  const asUsername = asIdx >= 0 ? args[asIdx + 1] : undefined;
  // 인덱스 기반으로 식별 — 같은 값이 중복돼도 안전, --as의 값 슬롯도 정확히 제외
  const fileArg = args.find((a, i) => !a.startsWith('--') && i !== asIdx + 1);

  if (!fileArg || !asUsername) {
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
  console.log(`청구인: ${asUsername}`);
  console.log(`모드: ${dryRun ? 'DRY RUN (실제 저장 안 함)' : '실제 업로드'}`);
  console.log('');

  try {
    // 청구인 사용자 조회
    const user = await prisma.user.findFirst({
      where: { username: asUsername, isActive: true },
      select: { id: true, username: true },
    });
    if (!user) {
      console.error(`❌ 청구인 사용자를 찾을 수 없습니다: ${asUsername}`);
      process.exit(1);
    }
    const applicant = { userId: user.id, username: user.username };

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
    const result = await executeBulkUpload(rows, { dryRun }, applicant);

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
