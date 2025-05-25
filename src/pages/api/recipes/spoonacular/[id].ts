import { NextApiRequest, NextApiResponse } from 'next';
import { SPOONACULAR_USER_ID } from '@/lib/spoonacular';
import { stripHtmlTags } from '@/lib/recipeUtils';

const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SPOONACULAR_API_KEY) {
    return res.status(500).json({ error: 'Spoonacular API key not configured' });
  }

  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Recipe ID is required' });
    }

    const response = await fetch(`${SPOONACULAR_API_URL}/${id}/information?apiKey=${SPOONACULAR_API_KEY}`);
    
    if (!response.ok) {
      if (response.status === 402) {
        return res.status(402).json({ error: 'Spoonacular API quota exceeded' });
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the data to match our Recipe interface
    const transformedData = {
      id: `spoonacular-${data.id}`,
      title: data.title,
      description: stripHtmlTags(data.summary),
      image_url: data.image,
      created_at: new Date().toISOString(),
      recipe_type: 'spoonacular' as const,
      user_id: SPOONACULAR_USER_ID,
      cuisine_type: data.cuisines?.[0] || null,
      cooking_time: data.readyInMinutes?.toString() || null,
      diet_type: data.diets?.[0] || null,
      ingredients: data.extendedIngredients?.map((ing: any) => ing.original) || [],
      instructions: data.analyzedInstructions?.[0]?.steps?.map((step: any) => stripHtmlTags(step.step)) || []
    };

    res.status(200).json(transformedData);
  } catch (error) {
    console.error('Error fetching from Spoonacular:', error);
    res.status(500).json({ error: 'Failed to fetch from Spoonacular API' });
  }
} 