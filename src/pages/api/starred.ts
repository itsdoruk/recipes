import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/auth-utils';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { getStarredRecipes, toggleStar } from '@/lib/recipeUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name) => req.cookies?.[name],
      set: () => {},
      remove: () => {},
    },
  });

  const { user_id, recipe_id, recipe_type } = req.query;
  const method = req.method;

  // Auth: Only allow access if user is authenticated and matches user_id
  const sessionResult = await getSession({ get: (name) => req.cookies?.[name] });
  const currentUserId = sessionResult.user?.id;
  
  // If no user is authenticated, return unauthorized
  if (!currentUserId) {
    return res.status(401).json({ error: 'Unauthorized - Please sign in' });
  }

  // If user_id is provided in query, verify it matches the authenticated user
  if (user_id && user_id !== currentUserId) {
    return res.status(403).json({ error: 'Forbidden - Cannot access other users\' starred recipes' });
  }

  // Use the authenticated user's ID if no user_id is provided
  const effectiveUserId = user_id || currentUserId;

  console.log('Incoming request:', req.query);
  try {
    if (method === 'GET') {
      console.log('Fetching starred recipes for user:', effectiveUserId);
      const data = await getStarredRecipes(
        supabase,
        effectiveUserId,
        recipe_id as string | undefined,
        recipe_type as 'user' | 'spoonacular' | 'ai' | undefined
      );
      console.log('Starred recipes fetch result:', data);
      return res.status(200).json({ data, error: null });
    }

    if (method === 'POST' || method === 'DELETE') {
      if (!recipe_id || !recipe_type) {
        console.log('Missing recipe_id or recipe_type:', { recipe_id, recipe_type });
        return res.status(400).json({ 
          error: 'Missing recipe_id or recipe_type',
          data: null 
        });
      }

      console.log('Toggling star for recipe:', { recipe_id, recipe_type, user_id: effectiveUserId });
      const result = await toggleStar(
        supabase,
        recipe_id as string,
        effectiveUserId,
        recipe_type as 'user' | 'spoonacular' | 'ai'
      );
      console.log('Toggle star result:', result);

      return res.status(200).json({ data: { starred: result }, error: null });
    }

    return res.status(405).json({ 
      error: 'Method not allowed',
      data: null 
    });
  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      data: null
    });
  }
} 