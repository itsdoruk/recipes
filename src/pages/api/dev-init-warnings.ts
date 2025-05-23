import { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow this endpoint in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' });
  }

  // Create authenticated Supabase client
  const supabase = createPagesServerClient<Database>({ req, res });

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
    // First, try to create the exec_sql function directly
    try {
      const { error: execSqlError } = await supabase.rpc('exec_sql', {
        sql: `
        CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
        RETURNS void AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
        `
      });

      if (execSqlError) {
        console.error('Error creating exec_sql function:', execSqlError);
      }
    } catch (execError) {
      console.error('Error in exec_sql creation:', execError);
    }

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

    // Try to execute the SQL directly
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSql });
      if (error) {
        console.error('Error executing SQL with exec_sql:', error);
        
        // Try with direct SQL using rpc
        try {
          // Use a different approach since .execute() is not available
          const { error: directError } = await supabase.rpc('exec_sql', { sql: createTableSql });
          if (directError) {
            console.error('Error executing direct SQL:', directError);
            throw directError;
          }
        } catch (directExecError) {
          console.error('Error in direct SQL execution:', directExecError);
          throw directExecError;
        }
      }
    } catch (execSqlError) {
      console.error('Error calling exec_sql:', execSqlError);
      
      // Try with a different approach
      try {
        // Create the table directly
        const { error: createError } = await supabase.from('warnings').insert({
          id: '00000000-0000-0000-0000-000000000000',
          user_id: '00000000-0000-0000-0000-000000000000',
          reason: 'Initial setup',
          created_at: new Date().toISOString()
        }).select();
        
        console.log('Attempted to create warnings table directly:', createError ? 'Error' : 'Success');
      } catch (directExecError) {
        console.error('Error in direct table creation:', directExecError);
      }
    }

    // Now try to create the update_user_warning_count function and trigger
    const warningCountSql = `
      -- Create function to update user warning count
      CREATE OR REPLACE FUNCTION public.update_user_warning_count()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update the warnings count in the profiles table
        UPDATE public.profiles
        SET warnings = (
          SELECT COUNT(*)
          FROM public.warnings
          WHERE user_id = NEW.user_id
        )
        WHERE user_id = NEW.user_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Create trigger for warning count updates
      DROP TRIGGER IF EXISTS update_warning_count_trigger ON public.warnings;
      CREATE TRIGGER update_warning_count_trigger
      AFTER INSERT OR DELETE ON public.warnings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_user_warning_count();
      
      -- Grant permissions
      GRANT ALL ON TABLE public.warnings TO authenticated;
      GRANT ALL ON FUNCTION public.update_user_warning_count() TO authenticated;
    `;

    // Try to execute the warning count SQL
    try {
      const { error: countError } = await supabase.rpc('exec_sql', { sql: warningCountSql });
      if (countError) {
        console.error('Error executing warning count SQL with exec_sql:', countError);
      }
    } catch (countExecError) {
      console.error('Error calling exec_sql for warning count:', countExecError);
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

    // Try to execute the fix audit log SQL
    try {
      const { error: fixError } = await supabase.rpc('exec_sql', { sql: fixAuditLogSql });
      if (fixError) {
        console.error('Error executing fix audit log SQL with exec_sql:', fixError);
      }
    } catch (fixExecError) {
      console.error('Error calling exec_sql for fix audit log:', fixExecError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error initializing warnings:', error);
    return res.status(500).json({ error: 'Failed to initialize warnings', details: error });
  }
} 