// scripts/set-published.js
// Usage: node scripts/set-published.js --slug ssss
//        node scripts/set-published.js --id 13

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const argv = require('minimist')(process.argv.slice(2));
  const slug = argv.slug || argv.s;
  const id = argv.id || argv.i;

  if (!slug && !id) {
    console.error('Provide --slug <slug> or --id <id>');
    process.exit(1);
  }

  try {
    let res;
    const now = new Date();
    if (slug) {
      res = await prisma.article.updateMany({ where: { slug }, data: { published: true, publishedAt: now } });
    } else {
      res = await prisma.article.updateMany({ where: { id: Number(id) }, data: { published: true, publishedAt: now } });
    }
    console.log('Updated rows:', res);
  } catch (e) {
    console.error('Error:', e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
