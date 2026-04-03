/**
 * 결재 대기 건 확인 스크립트
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const approverName = '정혜종';

  console.log('=== 결재 대기 건 확인 ===\n');
  console.log('결재자: ' + approverName + '\n');

  // 1. 정혜종이 결재자로 지정된 모든 PENDING step 조회
  const pendingSteps = await prisma.approvalStep.findMany({
    where: {
      approverName: approverName,
      status: 'PENDING',
    },
    include: {
      approvalLine: {
        include: {
          expense: {
            select: {
              id: true,
              applicantName: true,
              status: true,
              requestAmount: true,
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('정혜종이 결재자인 PENDING step 수: ' + pendingSteps.length + '\n');

  // 2. 결재 순서가 맞는 건 (isMyTurn) 확인
  let myTurnCount = 0;
  let notMyTurnCount = 0;

  for (const step of pendingSteps) {
    const currentStep = step.approvalLine.currentStep;
    const isMyTurn = step.stepNumber === currentStep;

    if (isMyTurn) {
      myTurnCount++;
    } else {
      notMyTurnCount++;
    }

    console.log('Expense ID: ' + step.approvalLine.expense.id);
    console.log('  청구인: ' + step.approvalLine.expense.applicantName);
    console.log('  금액: ' + step.approvalLine.expense.requestAmount.toLocaleString() + '원');
    console.log('  Expense 상태: ' + step.approvalLine.expense.status);
    console.log('  내 step: ' + step.stepNumber + ' / currentStep: ' + currentStep);
    console.log('  내 차례인가: ' + (isMyTurn ? '예 ✓' : '아니오 (대기중)'));
    console.log('');
  }

  console.log('=== 요약 ===');
  console.log('내 차례인 건: ' + myTurnCount + '건');
  console.log('대기 중인 건: ' + notMyTurnCount + '건');
  console.log('총 PENDING 건: ' + pendingSteps.length + '건');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
