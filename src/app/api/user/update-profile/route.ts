import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username, phone, company, country } = await req.json();

    // Check username is unique if changed
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: session.user.id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Username is already taken. Please choose another.' }, { status: 409 });
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        username: username || null,
        phone: phone || null,
        company: company || null,
        country: country || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}