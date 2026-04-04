import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_SESSION_TOKEN_VALUE =
  'easy-business-secret-key-change-in-production';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin' || (pathname.startsWith('/admin/') && !pathname.startsWith('/admin/login'))) {
    const token = request.cookies.get('admin_token')?.value;

    if (!token || token !== ADMIN_SESSION_TOKEN_VALUE) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/((?!login).*)'],
};
