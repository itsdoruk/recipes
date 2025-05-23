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
      return createWarningsTable(res, supabase);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createWarningsTable(
  res: NextApiResponse,
  supabase: any
) {
  try {
    // Create the warnings table
    const { error: tableError } = await supabase
      .from('warnings')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        admin_id: '00000000-0000-0000-0000-000000000000',
        reason: 'Test warning',
        created_at: new Date().toISOString()
      })
      .select();

    if (tableError) {
      if (tableError.code === '42P01') {
        // Table doesn't exist, create it
        const { error: createError } = await supabase.rpc('create_table_warnings');
        
        if (createError) {
          console.error('Error creating warnings table:', createError);
          return res.status(500).json({ error: 'Failed to create warnings table', details: createError });
        }
        
        return res.status(200).json({ success: true, message: 'Warnings table created' });
      } else {
        console.error('Error inserting test warning:', tableError);
        return res.status(500).json({ error: 'Failed to test warnings table', details: tableError });
      }
    }

    return res.status(200).json({ success: true, message: 'Warnings table exists' });
  } catch (error) {
    console.error('Error in createWarningsTable:', error);
    return res.status(500).json({ error: 'Internal server error', details: error });
  }
} 