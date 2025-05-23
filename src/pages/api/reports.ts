import { NextApiRequest, NextApiResponse } from 'next';
import { createServerClientWithCookies } from '@/lib/supabase/serverClient';

// Helper function to parse auth cookies
const parseAuthCookie = (cookie: string | undefined): any => {
  if (!cookie) return null;
  
  try {
    // Handle base64-encoded cookies
    if (cookie.startsWith('base64-')) {
      const base64Data = cookie.substring(7); // Remove 'base64-' prefix
      const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
      let parsed;
      try {
        parsed = JSON.parse(decodedData);
      } catch (e) {
        console.error('Failed to parse decoded base64 data as JSON:', e, decodedData);
        parsed = null;
      }
      return parsed;
    }
    
    // Handle regular JSON cookies
    let parsed2;
    try {
      parsed2 = JSON.parse(cookie);
    } catch (e) {
      console.error('Failed to parse cookie as JSON:', e, cookie);
      parsed2 = null;
    }
    return parsed2;
  } catch (error) {
    console.error('Error parsing auth cookie:', error);
    return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Reports API called with method:', req.method);
  
  // Log cookies for debugging
  console.log('Request cookies:', Object.keys(req.cookies).length ? Object.keys(req.cookies) : 'No cookies');
  
  // Check for the auth token cookie specifically
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cookieName = `sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`;
  if (req.cookies[cookieName]) {
    console.log(`Found auth token cookie: ${cookieName}`);
  } else {
    console.log(`Missing auth token cookie: ${cookieName}`);
    // Check if we have any cookie with a name containing "auth"
    const authCookies = Object.keys(req.cookies).filter(name => name.includes('auth'));
    if (authCookies.length > 0) {
      console.log('Found potential auth cookies:', authCookies);
    }
  }
  
  // Check for Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    console.log('Found Authorization header');
  } else {
    console.log('No Authorization header found');
  }
  
  // Create authenticated Supabase client
  const supabaseServer = createServerClientWithCookies({
    get: (name) => {
      const cookie = req.cookies[name];
      if (cookie) {
        console.log(`Found cookie: ${name} (length: ${cookie.length})`);
        return cookie;
      } else {
        console.log(`Cookie not found: ${name}`);
        return undefined;
      }
    },
    set: (name, value) => {
      console.log(`Setting cookie: ${name}`);
      res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`);
    },
    remove: (name) => {
      console.log(`Removing cookie: ${name}`);
      res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    },
  });
  
  // Get the user session
  try {
    // Try to get session from cookies first
    const {
      data: { session },
      error: sessionError
    } = await supabaseServer.auth.getSession();

    // If standard session check fails, try using our custom SQL functions
    if (sessionError || !session) {
      console.log('Standard session check failed, trying alternative methods');
      
      // Check Authorization header as last resort
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
          try {
            const { data: { user }, error } = await supabaseServer.auth.getUser(token);
            if (!error && user) {
              console.log('Successfully got user from token');
              return handleRequestWithUser(req, res, supabaseServer, user);
            }
          } catch (error) {
            console.error('Failed to get user from token:', error);
          }
        }
      }
      
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // If we have a valid session, proceed with the request
    return handleRequestWithUser(req, res, supabaseServer, session.user);
  } catch (error) {
    console.error('Error in reports API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to handle the request with a valid user
async function handleRequestWithUser(
  req: NextApiRequest, 
  res: NextApiResponse, 
  supabaseServer: any, 
  user: any
) {
  if (req.method === 'GET') {
    try {
      const { status } = req.query;
      
      // Check if user is admin or moderator
      let profileData;
      let profileError;
      
      try {
        // First try with both columns
        const result = await supabaseServer
          .from('profiles')
          .select('is_admin, is_moderator')
          .eq('user_id', user.id)
          .single();
          
        profileData = result.data;
        profileError = result.error;
      } catch (error) {
        console.error('Error with full profile query:', error);
        
        // If that fails, try with just is_admin
        try {
          const result = await supabaseServer
            .from('profiles')
            .select('is_admin')
            .eq('user_id', user.id)
            .single();
            
          profileData = result.data;
          profileError = result.error;
          
          // Add is_moderator field if it doesn't exist
          if (profileData && !('is_moderator' in profileData)) {
            profileData.is_moderator = false;
          }
        } catch (fallbackError) {
          console.error('Error with fallback profile query:', fallbackError);
          profileError = fallbackError;
        }
      }
        
      if (profileError && profileError.code === 'PGRST116') {
        // Profile missing, create it
        const { data: newProfile, error: createError } = await supabaseServer
          .from('profiles')
          .insert({
            user_id: user.id,
            username: `user_${user.id.slice(0, 8)}`,
            is_private: false,
            show_email: false,
            banned: false,
            ban_count: 0,
            warnings: 0
          })
          .select('is_admin, is_moderator')
          .single();
        if (createError) {
          return res.status(500).json({ message: 'Failed to create profile', details: createError });
        }
        profileData = newProfile;
      }
      
      if (profileError) {
        console.error('Error checking admin status:', profileError);
        return res.status(500).json({ message: 'Failed to verify permissions' });
      }
      
      const isAdminOrModerator = profileData?.is_admin || profileData?.is_moderator;
      
      // Regular users can only see their own reports
      if (!isAdminOrModerator) {
        let query = supabaseServer
          .from('reports_with_profiles')
          .select()
          .eq('reporter_id', user.id)
          .order('created_at', { ascending: false });

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching reports:', error);
          return res.status(500).json({ message: 'Failed to fetch reports' });
        }

        return res.status(200).json(data);
      }
      
      // Admins and moderators can see all reports
      let query = supabaseServer
        .from('reports_with_profiles')
        .select()
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reports:', error);
        return res.status(500).json({ message: 'Failed to fetch reports' });
      }

      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      return res.status(500).json({ message: 'Failed to fetch reports' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { recipe_id, recipe_type, reported_user_id, reason, details } = req.body;

      // Validate that either recipe_id and recipe_type are provided, or reported_user_id is provided
      if (!((recipe_id && recipe_type) || reported_user_id) || !reason) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Check if the user is trying to report themselves
      if (reported_user_id === user.id) {
        return res.status(400).json({ message: 'You cannot report yourself' });
      }

      // If reporting a user, verify the user exists
      if (reported_user_id) {
        const { data: profileCheck, error: profileCheckError } = await supabaseServer
          .from('profiles')
          .select('user_id')
          .eq('user_id', reported_user_id)
          .single();
        
        if (profileCheckError || !profileCheck) {
          return res.status(400).json({ message: 'Cannot report this user. The user may not exist in our system.' });
        }
      }

      const { data, error } = await supabaseServer
        .from('reports')
        .insert({
          recipe_id,
          recipe_type,
          reported_user_id,
          reporter_id: user.id,
          reason,
          details,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        
        if (error.message.includes('violates foreign key constraint')) {
          if (error.message.includes('reported_user_id')) {
            return res.status(400).json({ message: 'Cannot report this user. The user may not exist in our system.' });
          } else if (error.message.includes('recipe_id')) {
            return res.status(400).json({ message: 'Cannot report this recipe. The recipe may have been deleted.' });
          } else {
            return res.status(400).json({ message: 'Cannot submit report due to a data constraint issue.' });
          }
        }
        
        // Handle recipe_type constraint violations
        if (error.code === '23514' && error.message.includes('reports_recipe_type_check')) {
          console.log('Recipe type constraint violation, fixing recipe type value');
          
          // Try again with 'user' as the recipe_type
          const { data: fixedData, error: fixedError } = await supabaseServer
            .from('reports')
            .insert({
              recipe_id,
              recipe_type: 'user', // Force to 'user'
              reported_user_id,
              reporter_id: user.id,
              reason,
              details,
              status: 'pending'
            })
            .select()
            .single();
            
          if (fixedError) {
            console.error('Error after fixing recipe_type:', fixedError);
            return res.status(500).json({ message: 'Failed to submit report', error: fixedError.message });
          }
          
          return res.status(200).json(fixedData);
        }
        
        return res.status(500).json({ message: 'Failed to submit report', error: error.message });
      }

      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error submitting report:', error);
      return res.status(500).json({ message: 'Failed to submit report', error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { reportId, status, admin_notes } = req.body;

      if (!reportId || !status) {
        return res.status(400).json({ message: 'Report ID and status are required' });
      }

      // Verify admin or moderator status
      let profileData;
      let profileError;
      
      try {
        // First try with both columns
        const result = await supabaseServer
          .from('profiles')
          .select('is_admin, is_moderator')
          .eq('user_id', user.id)
          .single();
          
        profileData = result.data;
        profileError = result.error;
      } catch (error) {
        console.error('Error with full profile query:', error);
        
        // If that fails, try with just is_admin
        try {
          const result = await supabaseServer
            .from('profiles')
            .select('is_admin')
            .eq('user_id', user.id)
            .single();
            
          profileData = result.data;
          profileError = result.error;
          
          // Add is_moderator field if it doesn't exist
          if (profileData && !('is_moderator' in profileData)) {
            profileData.is_moderator = false;
          }
        } catch (fallbackError) {
          console.error('Error with fallback profile query:', fallbackError);
          profileError = fallbackError;
        }
      }

      if (profileError && profileError.code === 'PGRST116') {
        // Profile missing, create it
        const { data: newProfile, error: createError } = await supabaseServer
          .from('profiles')
          .insert({
            user_id: user.id,
            username: `user_${user.id.slice(0, 8)}`,
            is_private: false,
            show_email: false,
            banned: false,
            ban_count: 0,
            warnings: 0
          })
          .select('is_admin, is_moderator')
          .single();
        if (createError) {
          return res.status(500).json({ message: 'Failed to create profile', details: createError });
        }
        profileData = newProfile;
      }

      if (profileError) {
        console.error('Error checking admin status:', profileError);
        return res.status(500).json({ message: 'Failed to verify permissions' });
      }

      if (!profileData?.is_admin && !profileData?.is_moderator) {
        return res.status(403).json({ message: 'Unauthorized: Admin or moderator access required' });
      }

      // Create basic update data
      const updateData: any = {
        status
      };

      // Add admin_notes if provided
      if (admin_notes) {
        updateData.admin_notes = admin_notes;
      }

      // Set reviewed_at timestamp if status is changing to reviewed or resolved
      if (status === 'reviewed' || status === 'resolved') {
        updateData.reviewed_at = new Date().toISOString();
      }

      // First try to run a migration to add the missing columns
      try {
        // Try to call the RPC function to add missing columns
        await supabaseServer.rpc('add_missing_report_columns');
        
        // If successful, add reviewed_by to the update data
        updateData.reviewed_by = user.id;
      } catch (columnError) {
        console.error('Error adding missing columns:', columnError);
        // Continue without reviewed_by if the function fails
      }

      // Now update the report
      try {
        const { data, error } = await supabaseServer
          .from('reports')
          .update(updateData)
          .eq('id', reportId)
          .select()
          .single();

        if (error) {
          console.error('Error updating report:', error);
          
          // If the error is about reviewed_by column, try again without it
          if (error.message && error.message.includes('reviewed_by')) {
            console.log('Retrying update without reviewed_by field');
            delete updateData.reviewed_by;
            
            const { data: retryData, error: retryError } = await supabaseServer
              .from('reports')
              .update(updateData)
              .eq('id', reportId)
              .select()
              .single();
              
            if (retryError) {
              throw retryError;
            }
            
            return res.status(200).json(retryData);
          }
          
          // Handle status constraint violations
          if (error.code === '23514' && error.message.includes('reports_status_check')) {
            console.log('Status constraint violation, fixing status value');
            
            // Set status to a valid value
            updateData.status = 'reviewed';
            
            const { data: fixedData, error: fixedError } = await supabaseServer
              .from('reports')
              .update(updateData)
              .eq('id', reportId)
              .select()
              .single();
              
            if (fixedError) {
              throw fixedError;
            }
            
            return res.status(200).json(fixedData);
          }
          
          // Handle recipe_type constraint violations
          if (error.code === '23514' && error.message.includes('reports_recipe_type_check')) {
            console.log('Recipe type constraint violation, fixing recipe type value');
            
            // Get the current report to preserve other fields
            const { data: currentReport } = await supabaseServer
              .from('reports')
              .select('*')
              .eq('id', reportId)
              .single();
              
            if (currentReport) {
              // Set recipe_type to a valid value
              updateData.recipe_type = 'user';
              
              const { data: fixedData, error: fixedError } = await supabaseServer
                .from('reports')
                .update(updateData)
                .eq('id', reportId)
                .select()
                .single();
                
              if (fixedError) {
                throw fixedError;
              }
              
              return res.status(200).json(fixedData);
            }
          }
          
          throw error;
        }

        return res.status(200).json(data);
      } catch (updateError) {
        console.error('Error updating report:', updateError);
        return res.status(500).json({ 
          message: 'Failed to update report', 
          error: updateError instanceof Error ? updateError.message : 'Unknown error' 
        });
      }
    } catch (error: any) {
      console.error('Error in PATCH handler:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { reportId } = req.query;

      if (!reportId) {
        return res.status(400).json({ message: 'Report ID is required' });
      }

      // Verify admin status
      let profileData;
      let profileError;
      
      try {
        const result = await supabaseServer
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();
          
        profileData = result.data;
        profileError = result.error;
      } catch (error) {
        console.error('Error checking admin status:', error);
        profileError = error;
      }

      if (profileError) {
        console.error('Error checking admin status:', profileError);
        return res.status(500).json({ message: 'Failed to verify admin status' });
      }

      if (!profileData?.is_admin) {
        return res.status(403).json({ message: 'Unauthorized: Admin access required' });
      }

      // First get the report details
      const { data: reportData, error: reportError } = await supabaseServer
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError) {
        console.error('Error fetching report:', reportError);
        return res.status(500).json({ message: 'Failed to fetch report details', error: reportError.message });
      }

      if (!reportData) {
        return res.status(404).json({ message: 'Report not found' });
      }

      // Try to directly delete the report first
      try {
        const { error: deleteError } = await supabaseServer
          .from('reports')
          .delete()
          .eq('id', reportId);

        if (deleteError) {
          throw deleteError;
        }

        // If successful, try to archive it (but don't fail if this doesn't work)
        try {
          await supabaseServer
            .from('deleted_reports')
            .insert({
              report_id: reportData.id,
              reporter_id: reportData.reporter_id,
              reported_user_id: reportData.reported_user_id,
              recipe_id: reportData.recipe_id,
              recipe_type: reportData.recipe_type,
              reason: reportData.reason,
              details: reportData.details,
              status: reportData.status,
              admin_notes: reportData.admin_notes,
              reviewed_by: reportData.reviewed_by,
              reviewed_at: reportData.reviewed_at,
              deleted_by: user.id,
              deleted_at: new Date().toISOString(),
              original_created_at: reportData.created_at
            });
        } catch (archiveError) {
          console.error('Error archiving report (non-critical):', archiveError);
          // Continue even if archiving fails
        }

        return res.status(200).json({ message: 'Report deleted successfully' });
      } catch (error: any) {
        console.error('Error deleting report:', error);
        return res.status(500).json({ message: 'Failed to delete report', error: error.message });
      }
    } catch (error: any) {
      console.error('Error in DELETE handler:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 