import { NextResponse, type NextRequest } from 'next/server';
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  headers.delete('x-is-gamefi-subdomain');
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
