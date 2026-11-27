import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    const email = token?.email?.toLowerCase();
    const isAdmin =
      token?.role === 'ADMIN' ||
      token?.clientNumber === 'RG000' ||
      email === 'the_subsaharan@proton.me';

    // If already logged in and visiting /login, route admins to /admin and clients to /hub
    if (pathname === '/login' && token) {
      return NextResponse.redirect(
        new URL(isAdmin ? '/admin' : '/hub', req.url)
      );
    }

    // Protect /admin routes so only ADMIN / RG000 can enter
    if (pathname.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/hub', req.url));
    }

    // Skip client /onboarding for ADMIN / RG000 users
    if (
      token &&
      !isAdmin &&
      !token.profileComplete &&
      pathname !== '/onboarding' &&
      !pathname.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Public routes — no login required
        const publicRoutes = ['/', '/login', '/haya-structures'];
        if (publicRoutes.includes(pathname)) return true;

        // API auth routes are always public
        if (pathname.startsWith('/api/auth')) return true;

        // All other routes require login
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};