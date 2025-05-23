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
      try {
        // Ensure profile exists for this user
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin, is_moderator')
          .eq('user_id', userId)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Profile missing, create it
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: userId,
              username: `user_${userId.slice(0, 8)}`,
              is_private: false,
              show_email: false,
              banned: false,
              ban_count: 0,
              warnings: 0
            })
            .select('is_admin, is_moderator')
            .single();
          if (createError) {
            return res.status(500).json({ error: 'Failed to create profile', details: createError });
          }
          profile = newProfile;
        }

        if (profile && (profile.is_admin || profile.is_moderator)) {
          isAdmin = true;
        }
      } catch (error) {
        console.error('Error ensuring profile exists:', error);
        return res.status(500).json({ error: 'Internal server error', details: error });
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
      return initializeWarnings(res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function initializeWarnings(
  res: NextApiResponse,
  supabase: any
) {
  try {
    // Create the warnings table directly with SQL
    const createTableSql = `
      -- Create the warnings table if it doesn't exist
      CREATE TABLE IF NOT EXISTS public.warnings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      
      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON public.warnings(user_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_admin_id ON public.warnings(admin_id);
      CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON public.warnings(created_at);
      
      -- Add RLS policies for warnings table
      ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
      
      -- Policy for users to view their own warnings
      DROP POLICY IF EXISTS "Users can view their own warnings" ON public.warnings;
      CREATE POLICY "Users can view their own warnings" ON public.warnings
        FOR SELECT USING (auth.uid() = user_id);
      
      -- Policy for admins to view all warnings
      DROP POLICY IF EXISTS "Admins can view all warnings" ON public.warnings;
      CREATE POLICY "Admins can view all warnings" ON public.warnings
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND (is_admin = true OR is_moderator = true)
          )
        );
      
      -- Policy for admins to create warnings
      DROP POLICY IF EXISTS "Admins can create warnings" ON public.warnings;
      CREATE POLICY "Admins can create warnings" ON public.warnings
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND (is_admin = true OR is_moderator = true)
          )
        );
      
      -- Policy for admins to update warnings
      DROP POLICY IF EXISTS "Admins can update warnings" ON public.warnings;
      CREATE POLICY "Admins can update warnings" ON public.warnings
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND (is_admin = true OR is_moderator = true)
          )
        );
      
      -- Policy for admins to delete warnings
      DROP POLICY IF EXISTS "Admins can delete warnings" ON public.warnings;
      CREATE POLICY "Admins can delete warnings" ON public.warnings
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid()
            AND (is_admin = true OR is_moderator = true)
          )
        );
    `;

    // Execute the SQL directly
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSql });
      
      // If exec_sql doesn't exist, create it first
      if (error && error.message && error.message.includes('function "exec_sql" does not exist')) {
        // Create the exec_sql function
        try {
          const createExecSqlResult = await supabase.from('_rpc').select('*').execute(`
            CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
            RETURNS void AS $$
            BEGIN
              EXECUTE sql;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;

            GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
          `);

          if (createExecSqlResult.error) {
            throw createExecSqlResult.error;
          }

          // Try again with the warnings table
          const retryResult = await supabase.rpc('exec_sql', { sql: createTableSql });
          if (retryResult.error) throw retryResult.error;
        } catch (execSqlError) {
          console.error('Error creating exec_sql function:', execSqlError);
          throw execSqlError;
        }
      } else if (error) {
        throw error;
      }

      // Fix the admin_audit_log foreign key constraint
      const fixAuditLogSql = `
        -- Check if the admin_audit_log table exists
        DO $$
        BEGIN
          IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'admin_audit_log'
          ) THEN
            -- Drop the existing constraint if it exists
            IF EXISTS (
              SELECT 1 
              FROM information_schema.table_constraints 
              WHERE constraint_name = 'fk_admin_audit_log_target_user_id' 
              AND table_name = 'admin_audit_log'
            ) THEN
              ALTER TABLE public.admin_audit_log DROP CONSTRAINT fk_admin_audit_log_target_user_id;
            END IF;
            
            -- Add the corrected constraint that references auth.users instead of users
            ALTER TABLE public.admin_audit_log
            ADD CONSTRAINT fk_admin_audit_log_target_user_id
            FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `;

      // Execute the SQL to fix the admin_audit_log constraint
      const { error: fixError } = await supabase.rpc('exec_sql', { sql: fixAuditLogSql });
      if (fixError) throw fixError;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error executing SQL:', error);
      return res.status(500).json({ error: 'Failed to execute SQL', details: error });
    }
  } catch (error) {
    console.error('Error initializing warnings:', error);
    return res.status(500).json({ error: 'Failed to initialize warnings', details: error });
  }
} 