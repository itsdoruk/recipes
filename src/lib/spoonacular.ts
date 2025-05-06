import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes';

export interface Recipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  summary?: string;
  instructions?: string;
  dateAdded?: string;
  extendedIngredients?: {
    id: number;
    original: string;
    amount: number;
    unit: string;
  }[];
}

interface SearchOptions {
  cuisine?: string;
  diet?: string;
  maxReadyTime?: number;
}

export async function searchRecipes(query: string, options: SearchOptions = {}): Promise<Recipe[]> {
  if (!SPOONACULAR_API_KEY) {
    console.warn('No Spoonacular API key found');
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: SPOONACULAR_API_KEY,
      query,
      number: '10',
      addRecipeInformation: 'true',
    });

    // Add optional filters
    if (options.cuisine) {
      params.append('cuisine', options.cuisine);
    }
    if (options.diet) {
      params.append('diet', options.diet);
    }
    if (options.maxReadyTime) {
      params.append('maxReadyTime', options.maxReadyTime.toString());
    }

    const response = await fetch(`${SPOONACULAR_API_URL}/complexSearch?${params}`);
    if (!response.ok) {
      console.error('Spoonacular API error:', {
        status: response.status,
        statusText: response.statusText
      });
      return [];
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      console.error('Invalid response format from Spoonacular:', data);
      return [];
    }

    return data.results.map((recipe: any) => ({
      ...recipe,
      dateAdded: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error searching Spoonacular recipes:', error);
    return [];
  }
}

function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function getRecipeById(id: number | string): Promise<Recipe | null> {
  const idStr = String(id);
  // Only query Supabase if the id is a valid UUID string
  if (isUUID(idStr)) {
    try {
      const { data: supabaseRecipe, error: supabaseError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', idStr)
        .single();

      if (supabaseRecipe) {
        return {
          id: supabaseRecipe.id,
          title: supabaseRecipe.title,
          image: supabaseRecipe.image_url,
          instructions: supabaseRecipe.instructions.join('\n'),
          extendedIngredients: supabaseRecipe.ingredients.map((ing: string) => ({
            id: Math.random(),
            original: ing,
            amount: 0,
            unit: ''
          })),
          dateAdded: supabaseRecipe.created_at
        };
      }
    } catch (error) {
      console.error('Error fetching recipe from Supabase:', error);
    }
  }

  // If not found in Supabase, try Spoonacular
  if (!SPOONACULAR_API_KEY) {
    console.error('Spoonacular API key is not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${SPOONACULAR_API_URL}/${id}/information?apiKey=${SPOONACULAR_API_KEY}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spoonacular API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return null;
    }

    const data = await response.json();
    return {
      ...data,
      dateAdded: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching recipe from Spoonacular:', error);
    return null;
  }
}

export async function getPopularRecipes(): Promise<Recipe[]> {
  if (!SPOONACULAR_API_KEY) {
    console.error('Spoonacular API key is not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: SPOONACULAR_API_KEY,
      number: '6',
      sort: 'popularity',
      addRecipeInformation: 'true'
    });

    console.log('Fetching popular recipes from Spoonacular');

    const response = await fetch(`${SPOONACULAR_API_URL}/complexSearch?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spoonacular API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return [];
    }

    const data = await response.json();
    console.log('Spoonacular API response:', data);

    if (!data.results || !Array.isArray(data.results)) {
      console.error('Invalid response format from Spoonacular:', data);
      return [];
    }

    return data.results.map((recipe: Recipe) => ({
      ...recipe,
      dateAdded: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching popular recipes from Spoonacular:', error);
    return [];
  }
}

// Example usage:
// const recipes = await searchRecipes('pasta');
// const recipeDetails = await getRecipeById(716429);