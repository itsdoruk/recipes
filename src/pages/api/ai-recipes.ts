import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '@/lib/supabase/serverClient';
import { RANDOM_CARD_IMG } from '@/lib/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Debug] API Request received:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query
  });

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    console.log('[Debug] Handling OPTIONS request');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    console.log('[Debug] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Debug] Starting AI recipes API request');
    const supabase = getServerClient();
    
    if (!supabase) {
      console.error('[Debug] Failed to initialize Supabase client');
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    // Get the session to check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('[Debug] Session check:', { 
      hasSession: !!session, 
      error: sessionError,
      userId: session?.user?.id 
    });

    // Let's see ALL recipes in the database to understand their structure
    const { data: allRecipes, error: allRecipesError } = await supabase
      .from('recipes')
      .select('*')
      .limit(10);

    if (allRecipesError) {
      console.error('[Debug] Error fetching all recipes:', allRecipesError);
      return res.status(500).json({ 
        error: 'Failed to fetch recipes',
        details: allRecipesError.message
      });
    }

    console.log('[Debug] All recipes in database:', allRecipes?.map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      user_id: recipe.user_id,
      recipe_type: recipe.recipe_type,
      created_at: recipe.created_at
    })));

    // First, let's try to find any recipes with recipe_type = 'ai'
    const { data: aiTypeRecipes, error: aiTypeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('recipe_type', 'ai')
      .limit(6);

    console.log('[Debug] Recipes with recipe_type = ai:', aiTypeRecipes);

    // Then, let's try to find recipes with the default UUID
    const { data: defaultUuidRecipes, error: defaultUuidError } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', '00000000-0000-0000-0000-000000000000')
      .limit(6);

    console.log('[Debug] Recipes with default UUID:', defaultUuidRecipes);

    // Combine the results
    const recipes = [...(aiTypeRecipes || []), ...(defaultUuidRecipes || [])];
    const error = aiTypeError || defaultUuidError;

    if (error) {
      console.error('[Debug] Error fetching AI recipes:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch AI recipes',
        details: error.message
      });
    }

    console.log('[Debug] Combined recipes:', recipes);

    // Map recipes to ensure consistent data structure
    const mappedRecipes = (recipes || []).map(recipe => ({
      ...recipe,
      title: recipe.title || 'Untitled Recipe',
      description: recipe.description || 'A delicious AI-generated recipe',
      image_url: recipe.image_url || RANDOM_CARD_IMG,
      created_at: recipe.created_at || new Date().toISOString(),
      user_id: recipe.user_id || '00000000-0000-0000-0000-000000000000',
      recipeType: 'ai'
    }));

    console.log('[Debug] Sending response with mapped recipes:', mappedRecipes.length);
    return res.status(200).json({ data: mappedRecipes });
  } catch (error) {
    console.error('[Debug] Error in AI recipes API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch AI recipes',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 