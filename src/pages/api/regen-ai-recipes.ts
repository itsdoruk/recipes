import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '@/lib/supabase/serverClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getServerClient();
    // Delete all AI recipes
    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('recipe_type', 'ai');
    if (deleteError) {
      return res.status(500).json({ error: 'Failed to delete old AI recipes', details: deleteError.message });
    }

    // Determine absolute base URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Generate 15 new AI recipes
    const fetches = Array.from({ length: 15 }).map(async () => {
      const response = await fetch(`${baseUrl}/api/generate-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Generate a creative, unique, and delicious recipe.' })
      });
      if (!response.ok) throw new Error('Failed to generate AI recipe');
      return response.json();
    });
    const results = await Promise.all(fetches);

    // Filter out any recipes with duplicate titles
    const seenTitles = new Set();
    const newRecipes = results
      .filter(recipe => recipe && recipe.title && !seenTitles.has(recipe.title.toLowerCase().trim()))
      .map(recipe => {
        seenTitles.add(recipe.title.toLowerCase().trim());
        return recipe;
      });

    // Save new recipes to database
    if (newRecipes.length > 0) {
      const { error: insertError } = await supabase
        .from('recipes')
        .insert(newRecipes);
      if (insertError) {
        return res.status(500).json({ error: 'Failed to save new AI recipes', details: insertError.message });
      }
    }

    return res.status(200).json({ recipes: newRecipes });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
} 