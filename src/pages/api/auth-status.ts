import { NextApiRequest, NextApiResponse } from 'next';
import { createServerClientWithCookies } from '@/lib/supabase/serverClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Auth status API called with method:', req.method);
  console.log('Request cookies:', req.cookies);
  
  // Create authenticated Supabase client
  const supabaseServer = createServerClientWithCookies({
    get: (name) => {
      const cookie = req.cookies[name];
      console.log(`Getting cookie ${name}:`, cookie ? 'found' : 'not found');
      return cookie;
    },
    set: (name, value) => {
      console.log(`Setting cookie ${name}`);
      res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`);
    },
    remove: (name) => {
      const cookie = req.cookies[name];
      if (cookie) {
        res.setHeader('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`);
      }
    },
  });
  
  // Get the user session
  try {
    const {
      data: { session },
      error: sessionError
    } = await supabaseServer.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      return res.status(401).json({ 
        authenticated: false, 
        error: sessionError.message,
        message: 'Authentication error'
      });
    }

    if (!session) {
      console.log('No session found');
      return res.status(200).json({ 
        authenticated: false,
        message: 'No session found'
      });
    }

    console.log('Session found for user:', session.user.id);
    
    // Return basic user info
    return res.status(200).json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      message: 'Authenticated'
    });
  } catch (error: any) {
    console.error('Unexpected error in auth status API:', error);
    return res.status(500).json({ 
      authenticated: false,
      error: error.message,
      message: 'Server error'
    });
  }
} 