const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const res = await prisma.article.updateMany({
    where: { subcategory: 'latest' },
    data: { subcategory: 'Latest', updatedAt: new Date() }
  });
  console.log('Updated rows:', res.count);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
