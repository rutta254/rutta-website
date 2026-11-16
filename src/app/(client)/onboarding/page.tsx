import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingForm from './OnboardingForm';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.profileComplete) {
    redirect('/hub');
  }

  return (
    <OnboardingForm
      userName={session.user.name ?? 'there'}
    />
  );
}