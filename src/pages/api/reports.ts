import { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient } from '@supabase/ssr';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Create authenticated Supabase client
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => {
          res.setHeader('Set-Cookie', `${name}=${value}`);
        },
        remove: (name, options) => {
          res.setHeader('Set-Cookie', `${name}=`);
        },
      },
    }
  );
  
  // Get the user session
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = session.user;

  if (req.method === 'POST') {
    try {
      const { recipe_id, recipe_type, reported_user_id, reason, details } = req.body;

      // Validate that either recipe_id and recipe_type are provided, or reported_user_id is provided
      if (!((recipe_id && recipe_type) || reported_user_id) || !reason) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const { data, error } = await supabaseServer
        .from('reports')
        .insert({
          recipe_id,
          recipe_type,
          reported_user_id,
          user_id: user.id,
          reason,
          details,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json(data);
    } catch (error) {
      console.error('Error submitting report:', error);
      return res.status(500).json({ message: 'Failed to submit report' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { status } = req.query;
      let query = supabaseServer
        .from('reports')
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          reported_profiles:reported_user_id (username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      return res.status(500).json({ message: 'Failed to fetch reports' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { reportId } = req.query;

      if (!reportId) {
        return res.status(400).json({ message: 'Report ID is required' });
      }

      // Verify admin status
      const { data: adminData, error: adminError } = await supabaseServer
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      if (adminError) {
        console.error('Error checking admin status:', adminError);
        return res.status(500).json({ message: 'Failed to verify admin status' });
      }

      if (!adminData?.is_admin) {
        return res.status(403).json({ message: 'Unauthorized: Admin access required' });
      }

      // First, get the report details before deletion
      const { data: reportData, error: reportError } = await supabaseServer
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError) {
        console.error('Error fetching report:', reportError);
        return res.status(500).json({ message: 'Failed to fetch report details' });
      }

      // Insert into deleted_reports table
      const { error: insertError } = await supabaseServer
        .from('deleted_reports')
        .insert({
          report_id: reportId,
          recipe_id: reportData.recipe_id,
          recipe_type: reportData.recipe_type,
          reason: reportData.reason,
          status: reportData.status,
          deleted_at: new Date().toISOString(),
          original_created_at: reportData.created_at,
          deleted_by: user.id,
          user_id: reportData.user_id
        });

      if (insertError) {
        console.error('Error inserting into deleted_reports:', insertError);
        return res.status(500).json({ message: insertError.message || 'Failed to log deleted report', details: insertError.details });
      }

      // Delete the report
      const { error: deleteError } = await supabaseServer
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (deleteError) {
        console.error('Error deleting report:', deleteError);
        return res.status(500).json({ message: 'Failed to delete report' });
      }

      return res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
      console.error('Error in DELETE handler:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 