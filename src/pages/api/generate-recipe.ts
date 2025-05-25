import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '@/lib/supabase/serverClient';
import { v4 as uuidv4 } from 'uuid';

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
    // Call Hack Club AI API to generate recipe details
    const aiRes = await fetch('https://ai.hackclub.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful recipe assistant that generates detailed recipes in JSON format.' },
          { role: 'user', content: `Generate a recipe based on the following prompt.\n\nIMPORTANT: Your response must be a valid JSON object with these exact keys:\n- title (string): The name of the recipe\n- description (string): A brief description\n- ingredients (array of strings): List of ingredients\n- instructions (array of strings): Step-by-step instructions\n- cuisine_type (string): One of: italian, mexican, chinese, indian, japanese, thai, american, mediterranean, french, etc.\n- diet_type (string): MUST be one of: vegetarian, vegan, gluten-free, dairy-free, keto, paleo, omnivore, pescatarian, none\n- cooking_time (string): Format as "X mins" or "X hours" or "X hours Y mins"\n\nPrompt: ${prompt}\n\nRespond ONLY with the JSON object, no other text.` }
        ]
      })
    });

    if (!aiRes.ok) {
      throw new Error('Failed to generate recipe from AI');
    }

    const aiData = await aiRes.json();
    const aiResponse = aiData.choices?.[0]?.message?.content?.trim();
    console.log('Raw AI response:', aiResponse);
    if (!aiResponse) {
      throw new Error('Empty response from AI');
    }

    // Parse the AI response as JSON
    let recipeData;
    try {
      recipeData = JSON.parse(aiResponse);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      throw new Error('Invalid JSON response from AI');
    }

    // Ensure required fields are present
    const { title, description, ingredients, instructions, cuisine_type, diet_type, cooking_time } = recipeData;
    if (!title || !description || !ingredients || !instructions) {
      throw new Error('Missing required recipe fields');
    }

    // Validate and normalize diet type
    const normalizedDietType = diet_type?.toLowerCase().trim();
    if (!normalizedDietType || !VALID_DIET_TYPES.includes(normalizedDietType)) {
      throw new Error(`Invalid diet type: ${diet_type}. Must be one of: ${VALID_DIET_TYPES.join(', ')}`);
    }

    // Extract cooking time in minutes
    const cookingTimeMinutes = extractCookingTimeMinutes(cooking_time);
    if (!cookingTimeMinutes) {
      throw new Error(`Invalid cooking time format: ${cooking_time}. Must be in format "X mins" or "X hours" or "X hours Y mins"`);
    }

    // Create a new recipe object with a UUID
    const newRecipe = {
      id: uuidv4(),
      title,
      description,
      ingredients,
      instructions,
      image_url: '/placeholder-recipe.jpg', // Default image
      cooking_time,
      cooking_time_value: cookingTimeMinutes,
      user_id: '00000000-0000-0000-0000-000000000000', // AI user ID
      cuisine_type: cuisine_type?.toLowerCase().trim(),
      diet_type: normalizedDietType,
      recipe_type: 'ai'
    };

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