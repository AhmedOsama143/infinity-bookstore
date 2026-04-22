import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
  const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/register');

  if (isAccount && !user) {
    const redirect = url.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', url.pathname);
    return NextResponse.redirect(redirect);
  }

  if (isAuthPage && user) {
    const redirect = url.clone();
    redirect.pathname = '/account';
    return NextResponse.redirect(redirect);
  }

  return response;
}
