import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { generateRecipeId, parseRecipeId } from './recipeIdUtils';

const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;

// Log API key status on load
console.log('Spoonacular API key available:', !!SPOONACULAR_API_KEY);
if (!SPOONACULAR_API_KEY) {
  console.warn('Spoonacular API key is not configured. Recipes from Spoonacular will not be available.');
}

// Basic recipe interface
export interface Recipe {
  id: number | string;
  title: string;
  image: string;
  readyInMinutes?: number;
  servings?: number;
  summary?: string;
  instructions?: string;
  dateAdded?: string;
  extendedIngredients?: {
    id: number;
    original: string;
    amount: number;
    unit: string;
  }[];
  cuisines?: string[];
  diets?: string[];
  nutrition?: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

export type SpoonacularRecipe = Recipe;

interface SearchOptions {
  cuisine?: string;
  diet?: string;
  maxReadyTime?: number;
}

// Simple API key validation
function validateApiKey(): string | null {
  const apiKey = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
  if (!apiKey) {
    console.error('Spoonacular API key not found');
    return null;
  }
  return apiKey;
}

// Simple fetch wrapper with error handling
async function fetchFromSpoonacular(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = validateApiKey();
  if (!apiKey) return null;

  try {
    // Determine if we're on the server or client
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer ? process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000' : window.location.origin;
    
    const response = await fetch(`${baseUrl}/api/spoonacular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        params
      })
    });
    
    if (!response.ok) {
      if (response.status === 402) {
        console.error('Spoonacular API quota exceeded');
        return null;
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching from Spoonacular:', error);
    return null;
  }
}

// Search recipes with simplified parameters
export async function searchRecipes(query: string, options: SearchOptions = {}): Promise<SpoonacularRecipe[]> {
  const params: Record<string, string> = {
    number: '10',
    addRecipeInformation: 'true',
    fillIngredients: 'true',
    instructionsRequired: 'true',
    addRecipeNutrition: 'true'
  };

  // Add search query if provided
  if (query?.trim()) {
    params.query = query.trim();
  } else {
    params.sort = 'random';
  }

  // Add filters if provided
  if (options.cuisine?.trim()) {
    params.cuisine = options.cuisine.trim().toLowerCase();
  }
  if (options.diet?.trim()) {
    params.diet = options.diet.trim().toLowerCase();
  }
  if (options.maxReadyTime && options.maxReadyTime > 0) {
    params.maxReadyTime = options.maxReadyTime.toString();
  }

  const data = await fetchFromSpoonacular('complexSearch', params);
  if (!data?.results) return [];

  return data.results.map((recipe: any) => ({
    ...recipe,
    id: recipe.id.toString(),
    dateAdded: new Date().toISOString(),
    title: recipe.title || 'Untitled Recipe',
    image: recipe.image || '',
    summary: recipe.summary || recipe.instructions || 'No description available',
    nutrition: recipe.nutrition || null
  }));
}

// Get recipe by ID
export async function getRecipeById(id: string): Promise<Recipe | null> {
  const { source, id: originalId } = parseRecipeId(id);
  
  // Handle Spoonacular IDs
  if (source === 'spoonacular') {
    const data = await fetchFromSpoonacular(`${originalId}/information`, {
      addRecipeInformation: 'true',
      fillIngredients: 'true'
    });

    if (!data) return null;

    return {
      ...data,
      id: id, // Keep the original ID with prefix
      dateAdded: new Date().toISOString(),
      image: data.image || '',
      nutrition: data.nutrition || null
    };
  }

  // Handle local recipe IDs
  try {
    const supabase = getSupabaseClient();
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !recipe) return null;

    return {
      id: recipe.id,
      title: recipe.title,
      image: recipe.image_url || '',
      instructions: recipe.instructions.join('\n'),
      extendedIngredients: recipe.ingredients.map((ing: string) => ({
        id: Math.random(),
        original: ing,
        amount: 0,
        unit: ''
      })),
      dateAdded: recipe.created_at
    };
  } catch (error) {
    console.error('Error fetching local recipe:', error);
    return null;
  }
}

// Get random recipes
export async function getPopularRecipes(): Promise<Recipe[]> {
  const data = await fetchFromSpoonacular('complexSearch', {
    number: '6',
    sort: 'random',
    addRecipeInformation: 'true'
  });

  if (!data?.results) return [];

  return data.results.map((recipe: any) => ({
    ...recipe,
    id: recipe.id.toString(),
    dateAdded: new Date().toISOString(),
    title: recipe.title || 'Untitled Recipe',
    image: recipe.image || '',
    summary: recipe.summary || recipe.instructions || 'No description available'
  }));
}

// Example usage:
// const recipes = await searchRecipes('pasta');
// const recipeDetails = await getRecipeById(716429);

// Fix the API key in the .env.local file
function fixEnvFile() {
  // This function can only run on the server
  if (typeof window !== 'undefined') {
    console.log('⚠️ Running in browser environment, cannot fix .env.local file');
    return;
  }
  
  // For server-side only, we'll use dynamic imports
  try {
    console.log('📝 Server-side environment detected');
    // Don't attempt to fix the file automatically
    console.log('✓ To fix API key issues, check your .env.local file manually');
  } catch (error) {
    console.error('❌ Error in fixEnvFile:', error);
  }
}

// Try to fix the .env.local file on server-side
if (typeof window === 'undefined') {
  fixEnvFile();
}