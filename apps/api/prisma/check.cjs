const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [profileCount, technologyCount, tagCount, seoCount] = await Promise.all([
    prisma.profile.count(),
    prisma.technology.count(),
    prisma.tag.count(),
    prisma.seoPageMetadata.count(),
  ]);

  await prisma.$queryRaw`SELECT 1`;

  const result = {
    database: 'ok',
    profileCount,
    technologyCount,
    tagCount,
    seoMetadataCount: seoCount,
  };

  console.log('Banco validado com sucesso:');
  console.table(result);

  if (profileCount < 1 || technologyCount < 1 || tagCount < 1 || seoCount < 1) {
    throw new Error('O banco respondeu, mas o seed esperado não está completo.');
  }
}

main()
  .catch((error) => {
    console.error('Falha na validação do banco:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
