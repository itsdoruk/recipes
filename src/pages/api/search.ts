import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { searchRecipes } from '@/lib/spoonacular';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { q: query, cuisine, diet, time } = req.query;

  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  try {
    // Search local recipes
    const supabaseQuery = supabase
      .from('recipes')
      .select('*')
      .or(
        `title.ilike.%${query}%,` +
        `description.ilike.%${query}%,` +
        `ingredients.cs.{${query}},` +
        `instructions.cs.{${query}}`
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (cuisine) {
      supabaseQuery.eq('cuisine_type', cuisine);
    }
    if (diet) {
      supabaseQuery.eq('diet_type', diet);
    }
    if (time) {
      supabaseQuery.lte('cooking_time_value', time);
    }

    const { data: localRecipes, error: localError } = await supabaseQuery;

    if (localError) {
      console.error('Error searching local recipes:', localError);
      return res.status(500).json({ message: 'Failed to search local recipes' });
    }

    let allRecipes = [...(localRecipes || [])];

    // Search Spoonacular recipes
    try {
      const spoonacularRecipes = await searchRecipes(query as string, {
        cuisine: cuisine as string,
        diet: diet as string,
        maxReadyTime: time ? parseInt(time as string) : undefined,
      });
      
      if (spoonacularRecipes && spoonacularRecipes.length > 0) {
        allRecipes = [...allRecipes, ...spoonacularRecipes];
      }
    } catch (spoonacularError) {
      console.error('Spoonacular search failed:', spoonacularError);
      // Continue with just local recipes
    }

    // Sort combined results by date (newest first)
    allRecipes.sort((a, b) => {
      const dateA = 'created_at' in a ? new Date(a.created_at) : new Date();
      const dateB = 'created_at' in b ? new Date(b.created_at) : new Date();
      return dateB.getTime() - dateA.getTime();
    });

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return res.status(200).json(allRecipes);
  } catch (error) {
    console.error('Error in search API:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 