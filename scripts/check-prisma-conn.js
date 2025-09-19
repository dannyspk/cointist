// Simple CommonJS test script to verify Prisma can open the DB via DATABASE_URL
const { PrismaClient } = require('@prisma/client');

async function main(){
  const dbUrl = process.env.DATABASE_URL || '<not-set>';
  console.log('DATABASE_URL=', dbUrl);
  const prisma = new PrismaClient();
  try {
    const count = await prisma.article.count();
    console.log('article.count=', count);
  } catch (err) {
    console.error('Prisma error:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
