import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phone, company, country, userType } = await req.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      phone,
      company,
      country,
      role: userType === 'STUDENT' ? 'STUDENT' : 'CLIENT',
      profileComplete: true,
    },
  });

  return NextResponse.json({ success: true });
}