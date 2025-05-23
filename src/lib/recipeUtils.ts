import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/client';

interface RecipeProperties {
  description: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: string;
    protein: string;
    fat: string;
    carbohydrates: string;
  };
  cuisine_type: string;
  diet_type: string;
  cooking_time: string;
  cooking_time_value?: number;
}

/**
 * Removes common "Step X" prefixes from recipe instructions
 * @param instruction The instruction text to clean
 * @returns The cleaned instruction without step prefixes
 */
export function cleanStepPrefix(instruction: string): string {
  // Remove patterns like "Step 1:", "Step 1.", "Step 1", "Step One:", etc.
  return instruction
    .replace(/^step\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[:\.;\s-]*/i, '')
    .trim();
}

export function extractRecipePropertiesFromMarkdown(markdown: string): RecipeProperties {
  // Normalize line endings and remove extra whitespace
  let text = markdown.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Initialize result object
  const result: RecipeProperties = {
    description: '',
    ingredients: [],
    instructions: [],
    nutrition: { calories: 'unknown', protein: 'unknown', fat: 'unknown', carbohydrates: 'unknown' },
    cuisine_type: 'unknown',
    diet_type: 'unknown',
    cooking_time: 'unknown',
    cooking_time_value: undefined
  };

  if (lines.length === 0) return result;

  // Helper function to extract section content
  const extractSection = (header: string): string[] => {
    const startIndex = lines.findIndex(line => line.toUpperCase().startsWith(header));
    if (startIndex === -1) return [];
    const sectionLines: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^[A-Z]+:/)) break; // Stop at next section
      if (line.trim()) sectionLines.push(line);
    }
    return sectionLines;
  };

  // Extract description (everything before the first field header)
  const firstFieldIdx = lines.findIndex(line => /^(CUISINE|DIET|COOKING TIME|NUTRITION|INGREDIENTS|INSTRUCTIONS):/i.test(line));
  if (firstFieldIdx > 0) {
    result.description = lines.slice(0, firstFieldIdx).join(' ');
  } else if (firstFieldIdx === -1) {
    result.description = lines.join(' ');
  }

  // Extract cuisine
  const cuisineLine = lines.find(line => /^CUISINE:/i.test(line));
  if (cuisineLine) {
    result.cuisine_type = cuisineLine.replace(/^CUISINE:/i, '').trim().toLowerCase();
  }

  // Extract diet
  const dietLine = lines.find(line => /^DIET:/i.test(line));
  if (dietLine) {
    result.diet_type = dietLine.replace(/^DIET:/i, '').trim().toLowerCase();
  }

  // Extract cooking time (accepts variations)
  const timeLine = lines.find(line => /^COOKING TIME:/i.test(line));
  if (timeLine) {
    const timeMatch = timeLine.match(/(\d+)/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      result.cooking_time_value = minutes;
      result.cooking_time = `${minutes} mins`;
    } else {
      // Try to convert other time formats to minutes
      const hoursMatch = timeLine.match(/(\d+)\s*hours?/i);
      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        result.cooking_time_value = hours * 60;
        result.cooking_time = `${hours * 60} mins`;
      }
    }
  }

  // Extract nutrition (accepts variations)
  const nutritionLine = lines.find(line => /^NUTRITION:/i.test(line));
  if (nutritionLine) {
    // Accepts: 400 calories, 30g protein, 10g fat, 50g carbohydrates (order can vary)
    const calMatch = nutritionLine.match(/(\d+)\s*(?:calories|kcal|cal)/i);
    const proteinMatch = nutritionLine.match(/(\d+)g\s*protein/i);
    const fatMatch = nutritionLine.match(/(\d+)g\s*fat/i);
    const carbMatch = nutritionLine.match(/(\d+)g\s*carbohydrates?/i);
    result.nutrition = {
      calories: calMatch ? calMatch[1] : 'unknown',
      protein: proteinMatch ? proteinMatch[1] : 'unknown',
      fat: fatMatch ? fatMatch[1] : 'unknown',
      carbohydrates: carbMatch ? carbMatch[1] : 'unknown',
    };
  }

  // Extract ingredients
  const ingredientLines = extractSection('INGREDIENTS:');
  result.ingredients = ingredientLines
    .map(line => line.replace(/^[-*]\s*/, ''))
    .filter(line => line.trim());

  // Extract instructions
  const instructionLines = extractSection('INSTRUCTIONS:');
  result.instructions = instructionLines
    .map(line => {
      // First remove numbering if present
      const withoutNumbering = line.replace(/^\d+\.\s*/, '').trim();
      // Then remove step prefixes
      return cleanStepPrefix(withoutNumbering);
    })
    .filter(line =>
      line &&
      !/^(notes?|tips?)$/i.test(line) && // filter out 'Note', 'Notes', 'Tip', 'Tips'
      !/^[0-9]+$/.test(line) // filter out lines that are just numbers
    );

  return result;
}

/**
 * Gets information about a recipe's creator
 * @param recipeId The UUID of the recipe
 * @param supabase The Supabase client instance
 * @returns The creator information or null if not found
 */
export async function getRecipeCreator(recipeId: string, supabase: any) {
  if (!recipeId || !supabase) return null;
  
  try {
    // First, get the recipe to find the user_id
    const { data: recipeData, error: recipeError } = await supabase
      .from('recipes')
      .select('user_id')
      .eq('id', recipeId)
      .single();
    
    if (recipeError || !recipeData || !recipeData.user_id) {
      console.error('Error fetching recipe creator ID:', recipeError);
      return null;
    }
    
    // Now get the user profile information
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .eq('user_id', recipeData.user_id)
      .single();
    
    if (profileError) {
      console.error('Error fetching creator profile:', profileError);
      return {
        userId: recipeData.user_id,
        username: null,
        avatarUrl: null,
        hasProfile: false
      };
    }
    
    return {
      userId: recipeData.user_id,
      username: profileData?.username || null,
      avatarUrl: profileData?.avatar_url || null,
      hasProfile: true
    };
  } catch (error) {
    console.error('Error in getRecipeCreator:', error);
    return null;
  }
}

export const getStarredRecipes = async (
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId?: string,
  recipeType?: 'user' | 'spoonacular' | 'ai'
) => {
  let query = supabase
    .from('starred_recipes')
    .select('*')
    .eq('user_id', userId);

  if (recipeId) {
    query = query.eq('recipe_id', recipeId);
  }

  if (recipeType) {
    query = query.eq('recipe_type', recipeType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching starred recipes:', error);
    throw error;
  }

  return data || [];
};

export const toggleStar = async (
  supabase: SupabaseClient<Database>,
  recipeId: string,
  userId: string,
  recipeType: 'user' | 'spoonacular' | 'ai'
) => {
  // First check if the recipe is already starred
  const { data: existingStar, error: fetchError } = await supabase
    .from('starred_recipes')
    .select('*')
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .eq('recipe_type', recipeType)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('Error checking starred status:', fetchError);
    throw fetchError;
  }

  if (existingStar) {
    // If already starred, remove the star
    const { error: deleteError } = await supabase
      .from('starred_recipes')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .eq('recipe_type', recipeType);

    if (deleteError) {
      console.error('Error removing star:', deleteError);
      throw deleteError;
    }

    return false;
  } else {
    // If not starred, add the star
    const { error: insertError } = await supabase
      .from('starred_recipes')
      .insert({
        user_id: userId,
        recipe_id: recipeId,
        recipe_type: recipeType
      });

    if (insertError) {
      console.error('Error adding star:', insertError);
      throw insertError;
    }

    return true;
  }
};

export const getAIRecipes = async (): Promise<{ recipes: any[]; error: Error | null }> => {
  let retryCount = 0;
  const maxRetries = 3;
  const seenTitles = new Set<string>();

  while (retryCount < maxRetries) {
    try {
      console.debug('[Recipe Debug] Fetching AI recipes from TheMealDB, attempt:', retryCount + 1);
      
      // Fetch random recipes from TheMealDB
      const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
      if (!response.ok) {
        throw new Error(`Failed to fetch AI recipes: ${response.statusText}`);
      }

      const data = await response.json();
      console.debug('[Recipe Debug] TheMealDB API response:', data);

      if (!data.meals || !Array.isArray(data.meals)) {
        throw new Error('Invalid response format from TheMealDB API');
      }

      // Convert TheMealDB recipes to our format
      const recipes = data.meals.map((meal: any) => {
        // Extract ingredients
        const ingredients = Object.keys(meal)
          .filter(k => k.startsWith('strIngredient') && meal[k])
          .map(k => meal[k]);

        // Extract instructions
        const instructions = meal.strInstructions
          ? meal.strInstructions.split(/\r?\n|\.\s+/).filter(Boolean)
          : [];

        return {
          id: `random-internet-${meal.idMeal}`,
          title: meal.strMeal,
          description: meal.strInstructions,
          image_url: meal.strMealThumb,
          user_id: '00000000-0000-0000-0000-000000000000',
          created_at: new Date().toISOString(),
          ingredients,
          instructions,
          cuisine_type: meal.strArea?.toLowerCase() || 'unknown',
          diet_type: 'unknown',
          cooking_time: '30 mins',
          cooking_time_value: 30,
          recipe_type: 'ai'
        };
      });

      // Filter out duplicates based on title
      const filteredRecipes = recipes.filter((recipe: any) => {
        if (!recipe || typeof recipe !== 'object') return false;

        // Skip test recipes
        if (recipe.title?.toLowerCase().includes('test') || 
            recipe.description?.toLowerCase().includes('test')) {
          return false;
        }

        // Skip duplicates based on title
        const normalizedTitle = recipe.title?.toLowerCase().trim();
        if (!normalizedTitle || seenTitles.has(normalizedTitle)) {
          return false;
        }
        seenTitles.add(normalizedTitle);

        return true;
      });

      console.debug('[Recipe Debug] Successfully fetched AI recipes:', filteredRecipes.length);
      return { recipes: filteredRecipes, error: null };
    } catch (error) {
      console.error('[Recipe Debug] Error fetching AI recipes:', error);
      retryCount++;
      
      if (retryCount === maxRetries) {
        return {
          recipes: [],
          error: error instanceof Error ? error : new Error('Failed to fetch AI recipes')
        };
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  return {
    recipes: [],
    error: new Error('Failed to fetch AI recipes after multiple attempts')
  };
}; 