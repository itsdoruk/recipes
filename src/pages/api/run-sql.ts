import { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create authenticated Supabase client
  const supabase = createPagesServerClient<Database>({ req, res });

  // Custom authentication handling
  let userId = null;
  let isAdmin = false;

  try {
    // Try standard session check first
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      userId = session.user.id;
    } else {
      // Fallback: Try to extract user ID from cookie directly
      const authCookie = req.cookies['sb-viyrnasgmutvmhidjxjr-auth-token'];
      if (authCookie) {
        try {
          // Check if it's base64 encoded first
          if (authCookie.startsWith('base64-')) {
            try {
              const base64Data = authCookie.replace('base64-', '');
              const decodedData = Buffer.from(base64Data, 'base64').toString();
              let parsed;
              try {
                parsed = JSON.parse(decodedData);
              } catch (e) {
                console.error('Failed to parse decoded base64 data as JSON:', e, decodedData);
                parsed = null;
              }
              if (parsed && parsed.user?.id) {
                userId = parsed.user?.id;
              }
            } catch (e) {
              console.error('Failed to decode base64 auth cookie:', e);
            }
          } else {
            // Try to parse as regular JSON
            let parsed2;
            try {
              parsed2 = JSON.parse(authCookie);
            } catch (e) {
              console.error('Failed to parse auth cookie as JSON:', e, authCookie);
              parsed2 = null;
            }
            if (parsed2 && parsed2.user?.id) {
              userId = parsed2.user?.id;
            }
          }
        } catch (e) {
          console.error('Error processing auth cookie:', e);
        }
      }
      
      // Check Authorization header as last resort
      if (!userId && req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1];
        if (token) {
          try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
              userId = user.id;
            }
          } catch (e) {
            console.error('Failed to get user from token:', e);
          }
        }
      }
    }

    // If we have a user ID, check if they're an admin
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (profile && profile.is_admin) {
        isAdmin = true;
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
  }

  // Check authentication results
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden - only admins can run SQL' });
  }

  // Get the SQL from the request body
  const { sql } = req.body;
  
  if (!sql) {
    return res.status(400).json({ error: 'Missing SQL in request body' });
  }

  try {
    // Try to use exec_sql function if it exists
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        // If exec_sql function doesn't exist or other error, try alternative approach
        throw error;
      }
      
      return res.status(200).json({ success: true });
    } catch (execError: any) {
      console.error('Error executing SQL with exec_sql:', execError);
      
      // Try with raw SQL query using the REST API
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
          'apikey': `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
        },
        body: JSON.stringify({ sql })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`SQL execution failed: ${JSON.stringify(errorData)}`);
      }
      
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Error running SQL:', error);
    return res.status(500).json({ error: 'Failed to run SQL', details: error });
  }
} 