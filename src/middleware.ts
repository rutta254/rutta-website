import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // If logged in and trying to access login page, redirect to hub
    if (pathname === '/login' && token) {
      return NextResponse.redirect(new URL('/hub', req.url));
    }

    // If logged in but profile not complete, redirect to onboarding
    // (except if already going to onboarding or API routes)
    if (
      token &&
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