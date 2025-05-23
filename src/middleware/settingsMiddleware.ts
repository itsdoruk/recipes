import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function settingsMiddleware(request: NextRequest) {
  try {
    // Create a Supabase client configured to use cookies
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req: request, res });

    // Refresh session if expired - required for Server Components
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session in settings middleware:', sessionError);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const user = session?.user;

    if (!user) {
      console.log('No user in session, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // If user is authenticated, allow access
    return res;
  } catch (error) {
    console.error('Error in settings middleware:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Export the config to specify which routes to protect
export const config = {
  matcher: [
    '/settings/:path*',
    '/api/settings/:path*',
    '/account',
    '/api/account/:path*'
  ]
}; 