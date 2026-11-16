import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.profileComplete) {
    redirect('/hub');
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Welcome, {session.user.name ?? 'there'}</h1>
      <p className="mt-3 text-muted-foreground">
        Your account setup is not complete yet. Please finish setting up your profile to continue.
      </p>
    </main>
  );
}