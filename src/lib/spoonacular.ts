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
  diet?: string;
  cuisine?: string;
  maxReadyTime?: number;
}

export async function searchRecipes(query: string, options: SearchOptions = {}): Promise<Recipe[]> {
  if (!SPOONACULAR_API_KEY) {
    throw new Error('Spoonacular API key is not configured');
  }

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    query,
    addRecipeInformation: 'true',
    number: '12',
    ...(options.diet && { diet: options.diet }),
    ...(options.cuisine && { cuisine: options.cuisine }),
    ...(options.maxReadyTime && { maxReadyTime: options.maxReadyTime.toString() })
  });

  const response = await fetch(`${SPOONACULAR_API_URL}/complexSearch?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }

  const data = await response.json();
  return data.results;
}

export async function getRecipeById(id: number | string): Promise<Recipe> {
  // First try to get the recipe from Supabase
  try {
    const { data: supabaseRecipe, error: supabaseError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (supabaseRecipe) {
      return {
        id: supabaseRecipe.id,
        title: supabaseRecipe.title,
        image: supabaseRecipe.image_url,
        instructions: supabaseRecipe.instructions.join('\n'),
        extendedIngredients: supabaseRecipe.ingredients.map((ing: string) => ({
          id: Math.random(), // Generate a random ID since we don't have one
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

  // If not found in Supabase, try Spoonacular
  if (!SPOONACULAR_API_KEY) {
    throw new Error('Spoonacular API key is not configured');
  }

  try {
    const response = await fetch(
      `${SPOONACULAR_API_URL}/${id}/information?apiKey=${SPOONACULAR_API_KEY}`
    );

    if (!response.ok) {
      let errorMessage = `Failed to fetch recipe (Status: ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If response is not JSON, use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return {
      ...data,
      dateAdded: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to fetch recipe');
  }
}

export async function getPopularRecipes(): Promise<Recipe[]> {
  if (!SPOONACULAR_API_KEY) {
    throw new Error('Spoonacular API key is not configured');
  }

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    number: '6',
    sort: 'popularity',
    addRecipeInformation: 'true'
  });

  const response = await fetch(`${SPOONACULAR_API_URL}/complexSearch?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch popular recipes');
  }

  const data = await response.json();
  return data.results.map((recipe: Recipe) => ({
    ...recipe,
    dateAdded: new Date().toISOString()
  }));
}

// Example usage:
// const recipes = await searchRecipes('pasta');
// const recipeDetails = await getRecipeById(716429);