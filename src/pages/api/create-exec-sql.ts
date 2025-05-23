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
      return createExecSqlFunction(res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createExecSqlFunction(
  res: NextApiResponse,
  supabase: any
) {
  try {
    // Create the exec_sql function using raw SQL
    const { error } = await supabase.rpc('_', {
      query: `
        CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
        RETURNS void AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
      `
    });

    if (error) {
      console.error('Error creating exec_sql function:', error);
      return res.status(500).json({ error: 'Failed to create exec_sql function', details: error });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating exec_sql function:', error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
} 