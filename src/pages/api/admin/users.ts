import { NextApiRequest, NextApiResponse } from 'next';
import { withServiceRoleBypass } from '@/lib/supabase/adminClient';
import { getServerClient } from '@/lib/supabase/serverClient';
import { checkAdminStatus } from '@/lib/admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the user's session from the request using server client
    const supabase = getServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check if the user is authenticated
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if the user is an admin
    const isAdmin = await checkAdminStatus(session.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    
    // Use service role to bypass RLS
    const data = await withServiceRoleBypass(async (adminClient) => {
      // Example query that bypasses RLS
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*');
      
      if (error) throw error;
      return data;
    });
    
    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in admin API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
