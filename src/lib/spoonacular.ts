import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { generateRecipeId, parseRecipeId } from './recipeIdUtils';
import { stripHtmlTags } from './recipeUtils';

const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes';
export const SPOONACULAR_USER_ID = '00000000-0000-0000-0000-000000000001'; // Special UUID for Spoonacular recipes

// Log API key status on load
console.log('Spoonacular API key available:', !!SPOONACULAR_API_KEY);
if (!SPOONACULAR_API_KEY) {
  console.warn('Spoonacular API key is not configured. Recipes from Spoonacular will not be available.');
}

// Basic recipe interface
export interface Recipe {
  id: string; // Now always a UUID
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
  analyzedInstructions?: Array<{
    steps: Array<{
      step: string;
    }>;
  }>;
}

export type SpoonacularRecipe = Recipe;

interface SearchOptions {
  cuisine?: string;
  diet?: string;
  maxReadyTime?: number;
}

// Helper function to fetch from Spoonacular API
async function fetchFromSpoonacular(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  if (!SPOONACULAR_API_KEY) {
    throw new Error('Spoonacular API key not configured');
  }

  const queryParams = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    ...params
  });

  const response = await fetch(`${SPOONACULAR_API_URL}/${endpoint}?${queryParams}`);
  
  if (!response.ok) {
    if (response.status === 402) {
      throw new Error('Spoonacular API quota exceeded');
    }
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

// Get recipe by ID
export async function getRecipeById(id: string): Promise<Recipe | null> {
  try {
    const supabase = getSupabaseClient();
    
    // First, check if we have a mapping for this UUID
    const { data: mapping, error: mappingError } = await supabase
      .from('spoonacular_mappings')
      .select('spoonacular_id')
      .eq('recipe_id', id)
      .single();

    if (mappingError) {
      console.error('Error fetching Spoonacular mapping:', mappingError);
      return null;
    }

    if (!mapping) {
      return null;
    }

    // Fetch the recipe from Spoonacular
    const data = await fetchFromSpoonacular(`${mapping.spoonacular_id}/information`, {
      addRecipeInformation: 'true',
      fillIngredients: 'true'
    });

    if (!data) return null;

    return {
      ...data,
      id: id, // Use our UUID
      dateAdded: new Date().toISOString(),
      image: data.image || '',
      nutrition: data.nutrition || null
    };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return null;
  }
}

// Search recipes with simplified parameters
export async function searchRecipes(query: string, options: SearchOptions = {}): Promise<Recipe[]> {
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

  try {
    const data = await fetchFromSpoonacular('complexSearch', params);
    if (!data?.results) return [];

    const supabase = getSupabaseClient();
    const recipes: Recipe[] = [];

    for (const recipe of data.results) {
      try {
        // First, check if we already have this recipe in our database
        const { data: existingRecipe } = await supabase
          .from('recipes')
          .select('*')
          .eq('recipe_type', 'spoonacular')
          .eq('spoonacular_id', recipe.id.toString())
          .maybeSingle();

        if (existingRecipe) {
          // If recipe exists, use it
          recipes.push({
            ...recipe,
            id: existingRecipe.id,
            dateAdded: existingRecipe.created_at,
            title: existingRecipe.title,
            image: existingRecipe.image_url || '',
            summary: stripHtmlTags(existingRecipe.description),
            nutrition: null
          });
          continue;
        }

        // Generate a new UUID for this recipe
        const recipeId = generateRecipeId('spoonacular');

        // Create the recipe entry first
        const recipeData = {
          id: recipeId,
          title: recipe.title || 'Untitled Recipe',
          description: stripHtmlTags(recipe.summary || recipe.instructions || 'No description available'),
          image_url: recipe.image || '',
          user_id: SPOONACULAR_USER_ID,
          created_at: new Date().toISOString(),
          cuisine_type: recipe.cuisines?.[0] || null,
          cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
          diet_type: recipe.diets?.[0] || null,
          cooking_time_value: recipe.readyInMinutes,
          recipe_type: 'spoonacular',
          spoonacular_id: recipe.id.toString(),
          ingredients: recipe.extendedIngredients?.map((ing: any) => ing.original) || [],
          instructions: recipe.analyzedInstructions?.[0]?.steps?.map((step: any) => stripHtmlTags(step.step)) || []
        };

        // Insert the recipe
        const { error: insertError } = await supabase
          .from('recipes')
          .insert(recipeData);

        if (insertError) {
          console.error('Error inserting Spoonacular recipe:', insertError);
          continue;
        }

        // Now create the mapping
        const { error: mappingError } = await supabase
          .from('spoonacular_mappings')
          .insert({
            recipe_id: recipeId,
            spoonacular_id: recipe.id.toString(),
            created_at: new Date().toISOString()
          });

        if (mappingError) {
          console.error('Error storing Spoonacular mapping:', mappingError);
          // If mapping fails, we should probably delete the recipe to maintain consistency
          await supabase
            .from('recipes')
            .delete()
            .eq('id', recipeId);
          continue;
        }

        recipes.push({
          ...recipe,
          id: recipeId,
          dateAdded: recipeData.created_at,
          title: recipeData.title,
          image: recipeData.image_url,
          summary: recipeData.description,
          nutrition: recipe.nutrition || null
        });
      } catch (error) {
        console.error('Error processing Spoonacular recipe:', error);
        continue;
      }
    }

    return recipes;
  } catch (error) {
    console.error('Error searching recipes:', error);
    return [];
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

  const supabase = getSupabaseClient();
  const recipes: Recipe[] = [];

  for (const recipe of data.results) {
    // Generate a new UUID for this recipe
    const recipeId = generateRecipeId('spoonacular', recipe.id.toString());

    // Store the mapping
    const { error: mappingError } = await supabase
      .from('spoonacular_mappings')
      .upsert({
        recipe_id: recipeId,
        spoonacular_id: recipe.id.toString(),
        created_at: new Date().toISOString()
      });

    if (mappingError) {
      console.error('Error storing Spoonacular mapping:', mappingError);
      continue;
    }

    recipes.push({
      ...recipe,
      id: recipeId,
      dateAdded: new Date().toISOString(),
      title: recipe.title || 'Untitled Recipe',
      image: recipe.image || '',
      summary: stripHtmlTags(recipe.summary || recipe.instructions || 'No description available'),
      nutrition: recipe.nutrition || null
    });
  }

  return recipes;
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