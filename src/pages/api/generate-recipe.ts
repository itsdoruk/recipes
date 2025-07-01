import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '@/lib/supabase/serverClient';
import { v4 as uuidv4 } from 'uuid';
import { generateAIRecipe } from '@/lib/aiRecipeGenerator';

// Helper function to extract minutes from cooking time string
function extractCookingTimeMinutes(cookingTime: string): number | null {
  if (!cookingTime) return null;
  
  // Match patterns like "45 mins", "1 hour", "1.5 hours", etc.
  const hourMatch = cookingTime.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  const minuteMatch = cookingTime.match(/(\d+)\s*mins?/i);
  
  if (hourMatch) {
    return Math.round(parseFloat(hourMatch[1]) * 60);
  }
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10);
  }
  
  return null;
}

// Valid diet types
const VALID_DIET_TYPES = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'paleo',
  'omnivore',
  'pescatarian',
  'none'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Generate the recipe using the shared utility
    let newRecipe;
    try {
      newRecipe = await generateAIRecipe(prompt);
    } catch (error) {
      console.error('Error generating recipe:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate recipe' });
    }

    // Save the recipe to Supabase
    const supabase = getServerClient();
    const { data: savedRecipe, error: saveError } = await supabase
      .from('recipes')
      .insert([newRecipe])
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save recipe to Supabase:', saveError);
      throw saveError;
    }

    return res.status(200).json(savedRecipe);
  } catch (error) {
    console.error('Error generating recipe:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate recipe' });
  }
} 