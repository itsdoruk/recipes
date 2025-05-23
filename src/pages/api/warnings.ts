import { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
          if (authCookie.startsWith('base64-')) {
            // decode base64 and parse as JSON
            const base64Data = authCookie.replace('base64-', '');
            const decodedData = Buffer.from(base64Data, 'base64').toString();
            let parsed;
            try {
              parsed = JSON.parse(decodedData);
            } catch (e) {
              console.error('Failed to parse decoded base64 data as JSON:', e, decodedData);
              parsed = null;
            }
            if (parsed) {
              userId = parsed.user?.id;
            }
          } else if (authCookie.split('.').length === 3) {
            // Looks like a JWT
            try {
              const payload = authCookie.split('.')[1];
              const decodedPayload = Buffer.from(payload, 'base64').toString();
              let parsed2;
              try {
                parsed2 = JSON.parse(decodedPayload);
              } catch (e) {
                console.error('Failed to decode/parse JWT auth cookie:', e, decodedPayload);
                parsed2 = null;
              }
              if (parsed2) {
                userId = parsed2.sub || parsed2.user_id || parsed2.user?.id;
              }
            } catch (e) {
              console.error('Failed to decode/parse JWT auth cookie:', e);
            }
          } else {
            // Try to parse as regular JSON
            let parsed3;
            try {
              parsed3 = JSON.parse(authCookie);
            } catch (e) {
              console.error('Failed to parse auth cookie as JSON:', e, authCookie);
              parsed3 = null;
            }
            if (parsed3) {
              userId = parsed3.user?.id;
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
        .select('is_admin, is_moderator')
        .eq('user_id', userId)
        .single();

      if (profile && (profile.is_admin || profile.is_moderator)) {
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
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Handle different HTTP methods
  switch (req.method) {
    case 'POST':
      return handleAddWarning(req, res, supabase, userId);
    case 'DELETE':
      return handleRemoveWarning(req, res, supabase, userId);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Helper function to ensure the warnings table exists
async function ensureWarningsTable(supabase: any) {
  try {
    // Try to create the warnings table if it doesn't exist
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS public.warnings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    
    try {
      // Try to execute the SQL directly
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSql });
      
      // If there's an error with exec_sql function not existing
      if (error && error.message && error.message.includes('function "exec_sql" does not exist')) {
        // Try creating a test record to see if table exists
        const { error: insertError } = await supabase
          .from('warnings')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            admin_id: '00000000-0000-0000-0000-000000000000',
            reason: 'Test warning',
            created_at: new Date().toISOString()
          });
          
        // If table doesn't exist, we need to handle that separately
        if (insertError && insertError.code === '42P01') {
          // Table doesn't exist, but we can't create it here
          // This would require admin setup through the init-warnings endpoint
          console.error('Warnings table does not exist');
          return false;
        }
      } else if (error) {
        console.error('Error executing SQL:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring warnings table exists:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in ensureWarningsTable:', error);
    return false;
  }
}

async function handleAddWarning(
  req: NextApiRequest,
  res: NextApiResponse,
  supabase: any,
  adminId: string
) {
  const { user_id, reason } = req.body;

  if (!user_id || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Ensure the warnings table exists
    const tableExists = await ensureWarningsTable(supabase);
    if (!tableExists) {
      // If we can't ensure the table exists, we'll still try to update the profile
      console.warn('Could not ensure warnings table exists, proceeding with profile update only');
    }

    // Get current warning count
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('warnings')
      .eq('user_id', user_id)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return res.status(500).json({ error: 'Failed to fetch user data', details: userError });
    }

    // Update the user's warning count
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        warnings: (userData?.warnings || 0) + 1 
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Error updating warning count:', updateError);
      return res.status(500).json({ error: 'Failed to update warning count', details: updateError });
    }

    // Log the admin action
    try {
      await supabase
        .rpc('log_admin_action', {
          p_admin_id: adminId,
          p_action: 'add_warning',
          p_target_user_id: user_id,
          p_details: { reason }
        });
    } catch (logError) {
      console.error('Error logging admin action:', logError);
      // Don't fail the request if logging fails
    }

    // If warnings table exists, also add a record there
    if (tableExists) {
      try {
        const { error: warningError } = await supabase
          .from('warnings')
          .insert({
            user_id: user_id,
            admin_id: adminId,
            reason: reason,
            created_at: new Date().toISOString()
          });
          
        if (warningError) {
          console.error('Error adding warning record:', warningError);
          // Don't fail the request if adding to warnings table fails
        }
      } catch (warningError) {
        console.error('Error adding warning record:', warningError);
        // Don't fail the request if adding to warnings table fails
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in handleAddWarning:', error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
}

async function handleRemoveWarning(
  req: NextApiRequest,
  res: NextApiResponse,
  supabase: any,
  adminId: string
) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id parameter' });
  }

  try {
    // Get current warning count
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('warnings')
      .eq('user_id', user_id)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return res.status(500).json({ error: 'Failed to fetch user data', details: userError });
    }

    // Check if user has warnings
    const currentWarnings = userData?.warnings || 0;
    if (currentWarnings <= 0) {
      return res.status(400).json({ error: 'User has no warnings to remove' });
    }

    // Update the user's warning count
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        warnings: currentWarnings - 1 
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Error updating warning count:', updateError);
      return res.status(500).json({ error: 'Failed to update warning count', details: updateError });
    }

    // Log the admin action
    try {
      await supabase
        .rpc('log_admin_action', {
          p_admin_id: adminId,
          p_action: 'remove_warning',
          p_target_user_id: user_id,
          p_details: { previous_count: currentWarnings }
        });
    } catch (logError) {
      console.error('Error logging admin action:', logError);
      // Don't fail the request if logging fails
    }

    return res.status(200).json({ success: true, warnings_remaining: currentWarnings - 1 });
  } catch (error) {
    console.error('Error in handleRemoveWarning:', error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
} 