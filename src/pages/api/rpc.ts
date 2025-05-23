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
      return handleRpcCall(req, res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleRpcCall(
  req: NextApiRequest,
  res: NextApiResponse,
  supabase: any
) {
  const { function_name, params } = req.body;

  if (!function_name) {
    return res.status(400).json({ error: 'Missing function name' });
  }

  try {
    switch (function_name) {
      case 'check_table_exists':
        return await checkTableExists(res, supabase, params?.table_name);
      case 'create_warnings_table':
        return await createWarningsTable(res, supabase);
      default:
        return res.status(400).json({ error: 'Unknown function' });
    }
  } catch (error) {
    console.error(`Error in RPC function ${function_name}:`, error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
}

async function checkTableExists(
  res: NextApiResponse,
  supabase: any,
  tableName: string
) {
  if (!tableName) {
    return res.status(400).json({ error: 'Missing table name' });
  }

  try {
    const { data, error } = await supabase.rpc('check_table_exists', {
      p_table_name: tableName
    });

    if (error) throw error;

    return res.status(200).json({ exists: data });
  } catch (error) {
    console.error('Error checking table existence:', error);
    return res.status(500).json({ error: 'Failed to check table', details: error });
  }
}

async function createWarningsTable(
  res: NextApiResponse,
  supabase: any
) {
  try {
    // Execute raw SQL to create the warnings table
    const { error } = await supabase.rpc('create_warnings_table');

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating warnings table:', error);
    return res.status(500).json({ error: 'Failed to create table', details: error });
  }
} 