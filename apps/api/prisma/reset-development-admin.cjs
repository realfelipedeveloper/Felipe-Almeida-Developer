const argon2 = require('argon2');
const { AdminRole, PrismaClient } = require('@prisma/client');
const { readDevelopmentAdminConfig } = require('./admin-credentials.cjs');

const prisma = new PrismaClient();

async function main() {
  const { email, password } = readDevelopmentAdminConfig(process.env);
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.adminUser.findUnique({ where: { email } });
    const admin = existing
      ? await transaction.adminUser.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            role: AdminRole.SUPER_ADMIN,
            active: true,
            mustChangePassword: true,
          },
        })
      : await transaction.adminUser.create({
          data: {
            email,
            passwordHash,
            role: AdminRole.SUPER_ADMIN,
            active: true,
            mustChangePassword: true,
          },
        });

    await transaction.adminSession.deleteMany({ where: { adminUserId: admin.id } });
    return existing ? 'atualizada' : 'criada';
  });

  console.log(
    `Credencial SUPER_ADMIN de desenvolvimento ${result}. Sessões anteriores foram revogadas.`,
  );
  console.log('Use ADMIN_EMAIL e ADMIN_INITIAL_PASSWORD do .env e altere a senha após o login.');
}

main()
  .catch((error) => {
    console.error(`Falha ao sincronizar a credencial administrativa: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
