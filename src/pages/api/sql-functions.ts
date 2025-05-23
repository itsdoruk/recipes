import { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Create authenticated Supabase client
  const supabase = createPagesServerClient<Database>({ req, res });

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_moderator')
    .eq('user_id', session.user.id)
    .single();

  if (!profile || (!profile.is_admin && !profile.is_moderator)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Handle different HTTP methods
  switch (req.method) {
    case 'POST':
      return createSqlFunctions(res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createSqlFunctions(
  res: NextApiResponse,
  supabase: any
) {
  try {
    // Create check_table_exists function
    const checkTableSql = `
      CREATE OR REPLACE FUNCTION public.check_table_exists(p_table_name TEXT)
      RETURNS BOOLEAN AS $$
      DECLARE
        v_exists BOOLEAN;
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = p_table_name
        ) INTO v_exists;
        
        RETURN v_exists;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Create create_warnings_table function
    const createWarningsTableSql = `
      CREATE OR REPLACE FUNCTION public.create_warnings_table()
      RETURNS VOID AS $$
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
    `;
    
    // Execute the SQL to create the functions
    const { error: error1 } = await supabase.rpc('exec_sql', { sql: checkTableSql });
    if (error1) throw error1;
    
    const { error: error2 } = await supabase.rpc('exec_sql', { sql: createWarningsTableSql });
    if (error2) throw error2;
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating SQL functions:', error);
    return res.status(500).json({ error: 'Failed to create SQL functions', details: error });
  }
} 