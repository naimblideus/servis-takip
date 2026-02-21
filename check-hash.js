const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'admin@demo.com' } });
  console.log('Hash in DB:', user.passwordHash);
  
  const result = await bcrypt.compare('admin123', user.passwordHash);
  console.log('Password match:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());