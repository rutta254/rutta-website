import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import OnboardingForm from './OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.profileComplete) {
    redirect('/hub');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, profileComplete: true },
  });

  if (user?.profileComplete) {
    redirect('/hub');
  }

  return (
    <OnboardingForm userName={session.user.name ?? 'there'} />
  );
}