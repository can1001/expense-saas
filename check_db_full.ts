import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const details = await prisma.budgetDetail.findMany({
    include: {
      subcategory: {
        include: {
          category: true
        }
      },
      yearSettings: {
        where: { year: 2026 }
      }
    }
  });

  let total = 0;

  for (const d of details) {
    const amount = d.yearSettings?.[0]?.budgetAmount || 0;
    if (amount > 0) {
      total += amount;
      const 항 = d.subcategory?.category?.name || '';
      const 목 = d.subcategory?.name || '';
      const 세목 = d.name;
      console.log(`${항}|${목}|${세목}|${amount}`);
    }
  }

  console.log('TOTAL|' + total);

  await prisma.$disconnect();
}

main();
