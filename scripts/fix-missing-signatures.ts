/**
 * 청구인 서명 누락 건 확인 및 처리 스크립트
 *
 * 사용법: npx tsx scripts/fix-missing-signatures.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 청구인 서명 누락 건 확인 ===\n');

  // 1. 서명 누락된 제출된 지출결의서 조회
  const expensesWithoutSignature = await prisma.expense.findMany({
    where: {
      applicantSignatureData: null,
      status: {
        notIn: ['DRAFT', 'WITHDRAWN']
      }
    },
    select: {
      id: true,
      applicantName: true,
      userId: true,
      status: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: 'desc' }
  });

  console.log('서명 누락된 지출결의서: ' + expensesWithoutSignature.length + '건\n');

  if (expensesWithoutSignature.length === 0) {
    console.log('서명 누락 건이 없습니다.');
    return;
  }

  const fixableExpenses: Array<{
    expenseId: string;
    applicantName: string;
    signatureId: string;
    signatureType: string;
  }> = [];

  for (const expense of expensesWithoutSignature) {
    // 해당 사용자의 기본 서명 확인
    const defaultSignature = await prisma.userSignature.findFirst({
      where: {
        userId: expense.userId,
        isDefault: true
      },
      select: {
        id: true,
        type: true,
        imageData: true,
      }
    });

    console.log('ID: ' + expense.id);
    console.log('  청구인: ' + expense.applicantName);
    console.log('  userId: ' + expense.userId);
    console.log('  상태: ' + expense.status);
    console.log('  제출일: ' + expense.submittedAt);

    if (defaultSignature) {
      console.log('  기본서명: 있음 (' + defaultSignature.type + ')');
      fixableExpenses.push({
        expenseId: expense.id,
        applicantName: expense.applicantName,
        signatureId: defaultSignature.id,
        signatureType: defaultSignature.type,
      });
    } else {
      console.log('  기본서명: 없음 ❌');
    }
    console.log('');
  }

  console.log('\n=== 처리 가능 건수: ' + fixableExpenses.length + '건 ===\n');

  if (fixableExpenses.length === 0) {
    console.log('처리 가능한 건이 없습니다.');
    return;
  }

  // 처리 여부 확인 (--fix 옵션)
  const shouldFix = process.argv.includes('--fix');

  if (!shouldFix) {
    console.log('실제 처리하려면 --fix 옵션을 추가하세요:');
    console.log('  npx tsx scripts/fix-missing-signatures.ts --fix');
    return;
  }

  console.log('서명 적용 시작...\n');

  for (const item of fixableExpenses) {
    // 서명 데이터 가져오기
    const signature = await prisma.userSignature.findUnique({
      where: { id: item.signatureId },
      select: { type: true, imageData: true }
    });

    if (!signature) continue;

    // 지출결의서에 서명 적용
    await prisma.expense.update({
      where: { id: item.expenseId },
      data: {
        applicantSignatureType: signature.type,
        applicantSignatureData: signature.imageData,
      }
    });

    console.log('✓ ' + item.expenseId + ' (' + item.applicantName + ') - 서명 적용 완료');
  }

  console.log('\n=== 처리 완료 ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
