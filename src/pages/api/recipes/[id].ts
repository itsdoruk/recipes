import { NextApiRequest, NextApiResponse } from 'next';
import { getRecipeById, searchRecipes, SPOONACULAR_USER_ID } from '@/lib/spoonacular';
import { getServerClient } from '@/lib/supabase/serverClient';
import { v4 as uuidv4 } from 'uuid';

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
  cooking_time_value?: number;
  recipe_type: 'user' | 'spoonacular' | 'ai';
  ingredients?: string[];
  instructions?: string[];
}

interface SearchFilters {
  diet?: string;
  cuisine?: string;
  maxReadyTime?: number;
}

// Helper to deduplicate recipes by title (case-insensitive)
function dedupeRecipes(recipes: Recipe[]): Recipe[] {
  const seen = new Set<string>();
  return recipes.filter(recipe => {
    const title = recipe.title ? recipe.title.toLowerCase().trim() : '';
    if (!title || seen.has(title)) return false;
    seen.add(title);
    return true;
  });
}

// Helper to apply filters to recipes
function applyFilters(recipe: Recipe, filters: SearchFilters): boolean {
  // Apply cuisine filter
  if (filters.cuisine && recipe.cuisine_type?.toLowerCase() !== filters.cuisine.toLowerCase()) {
    return false;
  }

  // Apply diet filter
  if (filters.diet && recipe.diet_type?.toLowerCase() !== filters.diet.toLowerCase()) {
    return false;
  }

  // Apply time filter
  if (filters.maxReadyTime && filters.maxReadyTime > 0) {
    let recipeTime: number | null = null;
    if (recipe.cooking_time) {
      const timeMatch = recipe.cooking_time.match(/(\d+)\s*mins?/i);
      if (timeMatch) {
        recipeTime = parseInt(timeMatch[1], 10);
      }
    }
    if (!recipeTime && recipe.cooking_time_value) {
      recipeTime = recipe.cooking_time_value;
    }
    if (!recipeTime || recipeTime > filters.maxReadyTime) return false;
  }
  return true;
}

// Helper to search recipes in Supabase
async function searchSupabaseRecipes(supabase: any, searchQuery: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error searching Supabase recipes:', error);
    return [];
  }

  return data || [];
}

// Helper to search TheMealDB recipes
async function searchTheMealDBRecipes(searchQuery: string): Promise<Recipe[]> {
  try {
    const mealDbRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${searchQuery}`);
    const mealDbData = await mealDbRes.json();
    const mealDbRecipes = mealDbData.meals || [];

    return mealDbRecipes.map((meal: any) => ({
      id: uuidv4(),
      title: meal.strMeal,
      description: meal.strInstructions,
      image_url: meal.strMealThumb,
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(),
      ingredients: Object.keys(meal)
        .filter(k => k.startsWith('strIngredient') && meal[k])
        .map(k => meal[k]),
      instructions: meal.strInstructions.split(/\r?\n|\.\s+/).filter(Boolean),
      cuisine_type: meal.strArea?.toLowerCase() || 'unknown',
      diet_type: 'unknown',
      cooking_time: '30 mins',
      recipe_type: 'ai' as const
    }));
  } catch (error) {
    console.error('Error searching TheMealDB recipes:', error);
    return [];
  }
}

// Helper to search Spoonacular recipes
async function searchSpoonacularRecipes(searchQuery: string, filters: SearchFilters): Promise<Recipe[]> {
  try {
    const recipes = await searchRecipes(searchQuery, {
      diet: filters.diet,
      cuisine: filters.cuisine,
      maxReadyTime: filters.maxReadyTime
    });

    return recipes.map(recipe => ({
      id: `spoonacular-${recipe.id}`,
      title: recipe.title,
      description: recipe.summary || 'A delicious recipe to try!',
      image_url: recipe.image,
      user_id: 'spoonacular',
      created_at: recipe.dateAdded || new Date().toISOString(),
      cuisine_type: recipe.cuisines?.[0] || null,
      cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
      diet_type: recipe.diets?.[0] || null,
      cooking_time_value: recipe.readyInMinutes,
      recipe_type: 'spoonacular' as const
    }));
  } catch (error) {
    console.error('Error searching Spoonacular recipes:', error);
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, search, filters } = req.query;
  const supabase = getServerClient();

  // Handle search requests
  if (req.method === 'GET' && search) {
    try {
      const searchQuery = search as string;
      const filterParams: SearchFilters = filters ? JSON.parse(filters as string) : {};

      // Search all sources in parallel
      const [localRecipes, mealDbRecipes, spoonacularRecipes] = await Promise.all([
        searchSupabaseRecipes(supabase, searchQuery),
        searchTheMealDBRecipes(searchQuery),
        searchSpoonacularRecipes(searchQuery, filterParams)
      ]);

      // Get existing AI recipes to check for duplicates
      const { data: existingAiRecipes } = await supabase
        .from('recipes')
        .select('*')
        .eq('recipe_type', 'ai')
        .order('created_at', { ascending: false });

      // Filter out duplicates from TheMealDB recipes
      const existingTitles = new Set(
        (existingAiRecipes || [])
          .map((r: Recipe) => (r.title ? r.title.toLowerCase().trim() : ''))
          .filter(Boolean)
      );
      const newAiRecipes = mealDbRecipes.filter(
        (recipe: Recipe) => recipe.title && !existingTitles.has(recipe.title.toLowerCase().trim())
      );

      // If we have new AI recipes, save them (up to 5 total)
      if (newAiRecipes.length > 0) {
        const recipesToSave = newAiRecipes.slice(0, 5 - (existingAiRecipes?.length || 0));
        
        if (recipesToSave.length > 0) {
          // If we need to make room, delete oldest recipes
          if (existingAiRecipes && existingAiRecipes.length + recipesToSave.length > 5) {
            const recipesToDelete = existingAiRecipes.slice(5 - recipesToSave.length);
            for (const recipe of recipesToDelete) {
              await supabase
                .from('recipes')
                .delete()
                .eq('id', recipe.id);
            }
          }

          // Save new recipes
          const { error: insertError } = await supabase
            .from('recipes')
            .insert(recipesToSave);

          if (insertError) {
            console.error('Error saving new AI recipes:', insertError);
          }
        }
      }

      // Combine all recipes
      const allRecipes = [
        ...localRecipes,
        ...newAiRecipes,
        ...spoonacularRecipes
      ];

      // Apply filters and deduplicate
      const filteredRecipes = dedupeRecipes(allRecipes.filter(recipe => applyFilters(recipe, filterParams)));

      // For AI recipes, ensure we only return 5
      const aiRecipes = filteredRecipes.filter(r => r.recipe_type === 'ai').slice(0, 5);
      const nonAiRecipes = filteredRecipes.filter(r => r.recipe_type !== 'ai');

      return res.status(200).json([...aiRecipes, ...nonAiRecipes]);
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({ message: 'Failed to search recipes' });
    }
  }

  // Handle single recipe requests
  if (req.method === 'GET' && id) {
    try {
      console.log('Fetching recipe with ID:', id);

      // First, try to fetch from Supabase for user recipes
      console.log('Querying Supabase for recipe:', id);
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching recipe from Supabase:', error);
        return res.status(500).json({ message: 'Failed to fetch recipe from database' });
      }

      if (recipe) {
        console.log('Found recipe in Supabase:', recipe);
        return res.status(200).json(recipe);
      }

      // If not found in Supabase, check if it's a Spoonacular ID
      if (id.toString().startsWith('spoonacular-')) {
        const recipeId = id.toString().replace('spoonacular-', '');
        const spoonacularRecipe = await getRecipeById(recipeId);
        if (!spoonacularRecipe) {
          console.log('Spoonacular recipe not found');
          return res.status(404).json({ message: 'Recipe not found' });
        }

        // First, check if we already have this recipe in our database
        const { data: existingRecipe } = await supabase
          .from('recipes')
          .select('*')
          .eq('recipe_type', 'spoonacular')
          .eq('spoonacular_id', recipeId)
          .maybeSingle();

        if (existingRecipe) {
          console.log('Found existing Spoonacular recipe in database:', existingRecipe);
          return res.status(200).json(existingRecipe);
        }

        // If not found, create a new recipe entry
        const recipeData = {
          title: spoonacularRecipe.title,
          description: spoonacularRecipe.summary || 'A delicious recipe to try!',
          image_url: spoonacularRecipe.image,
          user_id: SPOONACULAR_USER_ID,
          created_at: new Date().toISOString(),
          cuisine_type: spoonacularRecipe.cuisines?.[0] || null,
          cooking_time: spoonacularRecipe.readyInMinutes ? `${spoonacularRecipe.readyInMinutes} mins` : null,
          diet_type: spoonacularRecipe.diets?.[0] || null,
          cooking_time_value: spoonacularRecipe.readyInMinutes,
          recipe_type: 'spoonacular',
          spoonacular_id: recipeId,
          ingredients: spoonacularRecipe.extendedIngredients?.map((ing: any) => ing.original) || [],
          instructions: spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map((step: any) => step.step) || []
        };

        // Insert the recipe into our database
        const { data: newRecipe, error: insertError } = await supabase
          .from('recipes')
          .insert(recipeData)
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting Spoonacular recipe:', insertError);
          return res.status(500).json({ message: 'Failed to store recipe' });
        }

        console.log('Successfully stored Spoonacular recipe:', newRecipe);
        return res.status(200).json(newRecipe);
      }

      // Finally, check for AI recipes
      const { data: aiRecipe, error: aiError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .eq('recipe_type', 'ai')
        .maybeSingle();

      if (aiRecipe) {
        return res.status(200).json(aiRecipe);
      }

      // If we get here, the recipe was not found
      console.log('Recipe not found in any source');
      return res.status(404).json({ message: 'Recipe not found' });
    } catch (error) {
      console.error('Error in recipe fetch handler:', error);
      return res.status(500).json({ message: 'Failed to fetch recipe' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 