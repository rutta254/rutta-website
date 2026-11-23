import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      clientNumber: true,
      phone: true,
      company: true,
      country: true,
      profileComplete: true,
      createdAt: true,
    },
  });

  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Account settings</h1>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-medium">Name</dt>
          <dd>{user.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium">Username</dt>
          <dd>{user.username ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium">Email</dt>
          <dd>{user.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium">Phone</dt>
          <dd>{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium">Company</dt>
          <dd>{user.company ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium">Country</dt>
          <dd>{user.country ?? '—'}</dd>
        </div>
      </dl>
    </main>
  );
}