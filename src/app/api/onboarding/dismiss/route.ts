import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/onboarding/dismiss — hos geldin sihirbazi tamamlandi/atlandi -> onboardedAt damgala
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email! },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await prisma.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
