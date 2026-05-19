import { NextResponse } from 'next/server';

const SECRET = process.env.AUTH_SECRET;

async function sign(body, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyToken(token) {
  if (!token || !SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = await sign(body, SECRET);
  if (expected !== sig) return null;
  try {
    const d = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (Date.now() - d.iat > 7 * 86400000) return null;
    return d;
  } catch { return null; }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only protect admin routes (except admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('cs_token')?.value;
    const data = await verifyToken(token);
    if (!data || data.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      url.searchParams.set('hint', 'admin');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
