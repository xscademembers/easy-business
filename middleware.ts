import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokenSecret } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin_token')?.value;
    const secret = getTokenSecret();

    if (!token || token !== secret) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/((?!login).*)'],
};
