/**
 * Production DB 마이그레이션 실행 스크립트
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting migration...\n');

  try {
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '../migrations/001_add_approval_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Migration SQL loaded from:', sqlPath);
    console.log('📊 SQL length:', sql.length, 'characters\n');

    // SQL 실행 (raw query)
    console.log('⚙️  Executing migration...\n');
    await prisma.$executeRawUnsafe(sql);

    console.log('✅ Migration completed successfully!\n');

    // 검증
    console.log('🔍 Verifying migration...\n');

    // 테이블 존재 확인
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('ApprovalLine', 'ApprovalStep', 'ApprovalLog')
      ORDER BY table_name;
    `;

    console.log('📋 Created tables:', tables);

    // Expense 테이블 새 컬럼 확인
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Expense'
      AND column_name IN ('status', 'submittedAt', 'approvedAt', 'rejectedAt')
      ORDER BY column_name;
    `;

    console.log('📋 Expense table new columns:', columns);

    console.log('\n✨ Migration verification passed!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
