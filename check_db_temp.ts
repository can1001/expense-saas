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
      console.log(d.name + '|' + amount);
    }
  }
  
  console.log('TOTAL|' + total);
  
  await prisma.$disconnect();
}

main();
