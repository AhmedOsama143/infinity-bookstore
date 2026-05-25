import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  // Forward the current pathname as a header so server components in nested
  // layouts (like the storefront onboarding gate) can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() refreshes the session cookie if needed.
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const isAccount = url.pathname.startsWith('/account') || url.pathname.startsWith('/wishlist');
  const isAdmin = url.pathname.startsWith('/admin');
  const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/register');

  if ((isAccount || isAdmin) && !user) {
    const redirect = url.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', url.pathname);
    return withRefreshedCookies(NextResponse.redirect(redirect), response);
  }

  if (isAuthPage && user) {
    const redirect = url.clone();
    redirect.pathname = isAdminUser(user) ? '/admin' : '/account';
    return withRefreshedCookies(NextResponse.redirect(redirect), response);
  }

  return response;
}

// When middleware returns a fresh NextResponse (e.g. a redirect), any
// session cookies that @supabase/ssr just wrote onto `response` via setAll()
// are lost. Copy them across so the browser sees the refreshed session
// even on redirect branches. (Per @supabase/ssr nextjs guide.)
function withRefreshedCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value);
  });
  return target;
}

function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null): boolean {
  return user?.app_metadata?.role === 'admin';
}
