import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - auth routes (login, signup, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|login|signup|banned).*)',
  ],
};

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Check if user is authenticated
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting user:', error);
    return response;
  }

  if (user) {
    // Check if user is banned
    const { data: profile } = await supabase
      .from('profiles')
      .select('banned, ban_expiry, ban_type')
      .eq('user_id', user.id)
      .single();

    if (profile?.banned) {
      // Check if ban has expired
      const isBanExpired = profile.ban_expiry && new Date(profile.ban_expiry) < new Date();
      
      if (!isBanExpired) {
        // If user is banned and ban hasn't expired, redirect to banned page
        // unless they're already on the banned page
        if (req.nextUrl.pathname !== '/banned') {
          return NextResponse.redirect(new URL('/banned', req.url));
        }
      } else {
        // If ban has expired, update the profile to remove the ban
        await supabase
          .from('profiles')
          .update({
            banned: false,
            ban_type: null,
            ban_reason: null,
            ban_expiry: null
          })
          .eq('user_id', user.id);
      }
    }
  }

  return response;
} 