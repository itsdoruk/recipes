import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function adminMiddleware(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session in admin middleware:', sessionError);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const user = session?.user;

    if (!user) {
      console.log('No user in session, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check if user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error checking admin status:', profileError);
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (!profile?.is_admin) {
      console.log('User is not an admin, redirecting to home');
      return NextResponse.redirect(new URL('/', request.url));
    }

    // If user is authenticated and is an admin, allow access
    return NextResponse.next();
  } catch (error) {
    console.error('Error in admin middleware:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Export the config to specify which routes to protect
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*'
  ]
}; 