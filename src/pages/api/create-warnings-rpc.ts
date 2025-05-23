import { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Create authenticated Supabase client
  const supabase = createPagesServerClient<Database>({ req, res });

  // Handle different HTTP methods
  switch (req.method) {
    case 'POST':
      return createRpcFunction(res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createRpcFunction(
  res: NextApiResponse,
  supabase: any
) {
  try {
    // First create the exec_sql function if it doesn't exist
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

      if (execSqlError && !execSqlError.message?.includes('function "exec_sql" already exists')) {
        console.error('Error creating exec_sql function:', execSqlError);
      }
    } catch (execError) {
      console.error('Error in exec_sql creation attempt:', execError);
    }

    // Create the RPC function to create the warnings table using the exec_sql function
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION public.create_table_warnings()
      RETURNS void AS $$
      BEGIN
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
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      GRANT EXECUTE ON FUNCTION public.create_table_warnings() TO authenticated;
    `;

    // Try to execute the SQL using the exec_sql function
    const { error } = await supabase.rpc('exec_sql', { sql: createFunctionSql });

    if (error) {
      console.error('Error creating RPC function:', error);
      return res.status(500).json({ error: 'Failed to create RPC function', details: error });
    }

    return res.status(200).json({ success: true, message: 'RPC function created' });
  } catch (error) {
    console.error('Error in createRpcFunction:', error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
} 