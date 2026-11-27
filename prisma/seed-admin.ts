// prisma/seed-admin.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'the_subSaharan@proton.me';

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'RG000 Admin',
      username: 'RG000',
      role: 'ADMIN',
      profileComplete: true,
    },
    create: {
      email: adminEmail,
      name: 'RG000 Admin',
      username: 'RG000',
      role: 'ADMIN',
      profileComplete: true,
    },
  });

  console.log('RG000 Admin ready:', {
    id: adminUser.id,
    clientNumber: adminUser.clientNumber,
    username: adminUser.username,
    email: adminUser.email,
    role: adminUser.role,
  });
}

main()
  .catch((err) => {
    console.error('Failed to seed RG000 admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });