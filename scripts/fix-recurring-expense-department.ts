import { prisma } from '../lib/prisma';
import { deriveRequestTeam } from '../lib/domain/request-team';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== 자동이체 expense department 보정 ${DRY_RUN ? '(dry-run)' : ''} ===`);

  const candidates = await prisma.expense.findMany({
    where: { recurringExpenseId: { not: null } },
    select: {
      id: true,
      committee: true,
      department: true,
      requestTeam: true,
      recurringExpense: {
        select: { committee: true, department: true },
      },
    },
  });

  let total = candidates.length;
  let fixed = 0;
  let skipped = 0;

  for (const e of candidates) {
    const r = e.recurringExpense;
    if (!r) {
      skipped++;
      continue;
    }

    const wrongDepartment = `${r.committee}/${r.department}`;
    const needsDepartmentFix = e.department === wrongDepartment;
    const correctRequestTeam = deriveRequestTeam(r.committee, r.department);
    const needsRequestTeamFix = e.requestTeam !== correctRequestTeam;

    if (!needsDepartmentFix && !needsRequestTeamFix) {
      skipped++;
      continue;
    }

    const newDepartment = needsDepartmentFix ? r.department : e.department;

    console.log(`\n[${e.id}]`);
    if (needsDepartmentFix) {
      console.log(`  department: "${e.department}" → "${newDepartment}"`);
    }
    if (needsRequestTeamFix) {
      console.log(`  requestTeam: "${e.requestTeam}" → "${correctRequestTeam}"`);
    }

    if (!DRY_RUN) {
      await prisma.expense.update({
        where: { id: e.id },
        data: {
          department: newDepartment,
          requestTeam: correctRequestTeam,
        },
      });
    }
    fixed++;
  }

  console.log('\n=== 요약 ===');
  console.log(`총 자동이체 expense: ${total}`);
  console.log(`보정 ${DRY_RUN ? '대상' : '완료'}: ${fixed}`);
  console.log(`건너뜀(이미 정상): ${skipped}`);
  if (DRY_RUN) {
    console.log('\n실제 적용하려면 --dry-run 없이 다시 실행하세요.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
