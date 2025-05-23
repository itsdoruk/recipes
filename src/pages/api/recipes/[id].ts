import { NextApiRequest, NextApiResponse } from 'next';
import { getRecipeById, searchRecipes } from '@/lib/spoonacular';
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
      id: `random-internet-${meal.idMeal}`,
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
      // If it's a Spoonacular ID
      if (id.toString().startsWith('spoonacular-')) {
        const recipeId = id.toString().replace('spoonacular-', '');
        const recipe = await getRecipeById(recipeId);
        if (!recipe) {
          return res.status(404).json({ message: 'Recipe not found' });
        }
        return res.status(200).json({
          ...recipe,
          id: `spoonacular-${recipe.id}`,
          recipe_type: 'spoonacular'
        });
      }

      // If it's an AI recipe ID
      if (id.toString().startsWith('random-internet-')) {
        const mealId = id.toString().replace('random-internet-', '').split('-')[0];
        const recipeRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`);
        const recipeData = await recipeRes.json();
        const meal = recipeData.meals?.[0];
        
        if (!meal) {
          return res.status(404).json({ message: 'AI Recipe not found' });
        }

        // Generate AI recipe description
        const improvisePrompt = `Start with a fun, appetizing, and engaging internet-style introduction for this recipe (at least 2 sentences, do not use the title as the description). Then, on new lines, provide:
CUISINE: [guess the cuisine, e.g. british, italian, etc.]
DIET: [guess the diet, e.g. vegetarian, gluten-free, etc.]
COOKING TIME: [guess the total time in minutes, e.g. 30]
NUTRITION: [guess as: 400 calories, 30g protein, 10g fat, 50g carbohydrates]
Only provide these fields after the description, each on a new line, and nothing else.

Title: ${meal.strMeal}
Category: ${meal.strCategory}
Area: ${meal.strArea}
Instructions: ${meal.strInstructions}
Ingredients: ${Object.keys(meal).filter(k => k.startsWith('strIngredient') && meal[k]).map(k => meal[k]).join(', ')}`;

        const aiRes = await fetch('https://ai.hackclub.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are a recipe formatter. Always format recipes with these exact section headers in this order: DESCRIPTION, CUISINE, DIET, COOKING TIME, NUTRITION, INGREDIENTS, INSTRUCTIONS. Each section should start on a new line with its header in uppercase followed by a colon. Ingredients should be bullet points starting with "-". Instructions should be numbered steps starting with "1."' },
              { role: 'user', content: improvisePrompt }
            ]
          })
        });

        if (!aiRes.ok) {
          throw new Error('Failed to generate AI description');
        }

        const aiData = await aiRes.json();
        let aiContent = aiData.choices[0].message.content;
        if (aiContent instanceof Promise) {
          aiContent = await aiContent;
        }

        // Extract properties from AI markdown
        const lines = aiContent.split('\n').map((line: string) => line.trim());
        let description = '';
        let cuisine_type = '';
        let diet_type = '';
        let cooking_time = '';
        let currentSection = '';

        for (const line of lines as string[]) {
          if (line.toUpperCase().startsWith('DESCRIPTION:')) {
            currentSection = 'description';
            description = line.substring(12).trim();
          } else if (line.toUpperCase().startsWith('CUISINE:')) {
            currentSection = '';
            cuisine_type = line.substring(8).trim().toLowerCase();
          } else if (line.toUpperCase().startsWith('DIET:')) {
            currentSection = '';
            diet_type = line.substring(5).trim().toLowerCase();
          } else if (line.toUpperCase().startsWith('COOKING TIME:')) {
            currentSection = '';
            cooking_time = line.substring(13).trim();
          } else if (currentSection === 'description') {
            description += ' ' + line;
          }
        }

        // Clean up description
        description = description.trim();
        if (!description || description === 'unknown') {
          description = "A delicious dish you'll love!";
        }

        // Extract ingredients and instructions
        const ingredients = Object.keys(meal)
          .filter(k => k.startsWith('strIngredient') && meal[k] && meal[k].trim() && meal[k].toLowerCase() !== 'null')
          .map(k => meal[k].trim());

        const instructions = meal.strInstructions
          ? meal.strInstructions.split(/\r?\n|\.\s+/).map((s: string) => s.trim()).filter(Boolean)
          : [];

        // Get existing AI recipes to check for duplicates and limit
        const { data: existingRecipes, error: fetchError } = await supabase
          .from('recipes')
          .select('*')
          .eq('recipe_type', 'ai')
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching existing AI recipes:', fetchError);
        }

        // Check if this recipe would be a duplicate
        const isDuplicate = existingRecipes?.some(
          (recipe: Recipe) => recipe.title?.toLowerCase().trim() === meal.strMeal.toLowerCase().trim()
        );

        if (isDuplicate) {
          return res.status(409).json({ message: 'This recipe already exists' });
        }

        // Check if we already have 5 AI recipes
        if (existingRecipes && existingRecipes.length >= 5) {
          // Delete the oldest AI recipe
          const oldestRecipe = existingRecipes[existingRecipes.length - 1];
          const { error: deleteError } = await supabase
            .from('recipes')
            .delete()
            .eq('id', oldestRecipe.id);

          if (deleteError) {
            console.error('Error deleting oldest AI recipe:', deleteError);
          }
        }

        // Save the new AI recipe to the database
        const aiRecipeId = uuidv4();
        const aiUserId = '00000000-0000-0000-0000-000000000000';
        const { error: insertError } = await supabase
          .from('recipes')
          .insert({
            id: aiRecipeId,
            title: meal.strMeal,
            description,
            image_url: meal.strMealThumb,
            user_id: aiUserId,
            created_at: new Date().toISOString(),
            ingredients,
            instructions,
            cuisine_type: cuisine_type || meal.strArea || 'unknown',
            diet_type: diet_type || 'unknown',
            cooking_time: cooking_time || '30 mins',
            recipe_type: 'ai'
          });

        if (insertError) {
          console.error('Error saving AI recipe to database:', insertError);
        }

        return res.status(200).json({
          id: aiRecipeId,
          title: meal.strMeal,
          description,
          image_url: meal.strMealThumb,
          user_id: aiUserId,
          created_at: new Date().toISOString(),
          ingredients,
          instructions,
          cuisine_type: cuisine_type || meal.strArea || 'unknown',
          diet_type: diet_type || 'unknown',
          cooking_time: cooking_time || '30 mins',
          recipe_type: 'ai'
        });
      }

      // For user recipes, query Supabase
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching recipe from Supabase:', error);
        return res.status(500).json({ message: 'Failed to fetch recipe from database' });
      }

      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      return res.status(200).json(recipe);
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return res.status(500).json({ message: 'Failed to fetch recipe' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 