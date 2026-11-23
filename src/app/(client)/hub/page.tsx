import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import HubClient from './HubClient';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const session = await getServerSession(authOptions);

  let userProfile = null;

  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        role: true,
        clientNumber: true,
        profileComplete: true,
      },
    });
    userProfile = dbUser;
  }

  return <HubClient userProfile={userProfile} />;
}