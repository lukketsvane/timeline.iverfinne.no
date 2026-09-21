import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (host === 'max.iverfinne.no' && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/max-night-garden.html', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
