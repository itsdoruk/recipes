import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes';

// Extract nutrition data from Spoonacular API response
function extractNutritionFromSpoonacular(nutrition: any): { calories: string; protein: string; fat: string; carbohydrates: string } {
  if (!nutrition?.nutrients) {
    return { calories: 'unknown', protein: 'unknown', fat: 'unknown', carbohydrates: 'unknown' };
  }

  const nutrients = nutrition.nutrients;
  
  // Find the required nutrients
  const calories = nutrients.find((n: any) => n.name === 'Calories');
  const protein = nutrients.find((n: any) => n.name === 'Protein');
  const fat = nutrients.find((n: any) => n.name === 'Fat');
  const carbohydrates = nutrients.find((n: any) => n.name === 'Carbohydrates');

  return {
    calories: calories ? `${Math.round(calories.amount)} ${calories.unit}` : 'unknown',
    protein: protein ? `${Math.round(protein.amount)} ${protein.unit}` : 'unknown',
    fat: fat ? `${Math.round(fat.amount)} ${fat.unit}` : 'unknown',
    carbohydrates: carbohydrates ? `${Math.round(carbohydrates.amount)} ${carbohydrates.unit}` : 'unknown'
  };
}

async function fetchRecipeNutrition(spoonacularId: string) {
  if (!SPOONACULAR_API_KEY) {
    throw new Error('Spoonacular API key not configured');
  }

  const response = await fetch(`${SPOONACULAR_API_URL}/${spoonacularId}/information?apiKey=${SPOONACULAR_API_KEY}&addRecipeNutrition=true`);
  
  if (!response.ok) {
    if (response.status === 402) {
      throw new Error('Spoonacular API quota exceeded');
    }
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.nutrition;
}

async function updateSpoonacularNutrition() {
  console.log('🔍 Fetching Spoonacular recipes without nutrition data...');

  // Get all Spoonacular recipes that don't have nutrition data
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('recipe_type', 'spoonacular')
    .not('spoonacular_id', 'is', null);

  if (error) {
    console.error('❌ Error fetching recipes:', error);
    return;
  }

  console.log(`📊 Found ${recipes.length} Spoonacular recipes to update`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const recipe of recipes) {
    try {
      console.log(`🔄 Updating nutrition for recipe: ${recipe.title} (ID: ${recipe.id})`);

      // Fetch nutrition data from Spoonacular API
      const nutrition = await fetchRecipeNutrition(recipe.spoonacular_id!);
      
      if (!nutrition) {
        console.log(`⚠️ No nutrition data found for recipe: ${recipe.title}`);
        continue;
      }

      // Extract nutrition values
      const nutritionData = extractNutritionFromSpoonacular(nutrition);

      // Update the recipe in the database
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ nutrition: nutritionData })
        .eq('id', recipe.id);

      if (updateError) {
        console.error(`❌ Error updating recipe ${recipe.id}:`, updateError);
        errorCount++;
      } else {
        console.log(`✅ Updated nutrition for: ${recipe.title}`);
        console.log(`   Calories: ${nutritionData.calories}`);
        console.log(`   Protein: ${nutritionData.protein}`);
        console.log(`   Fat: ${nutritionData.fat}`);
        console.log(`   Carbohydrates: ${nutritionData.carbohydrates}`);
        updatedCount++;
      }

      // Add a small delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error processing recipe ${recipe.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n🎉 Update complete!`);
  console.log(`✅ Successfully updated: ${updatedCount} recipes`);
  console.log(`❌ Errors: ${errorCount} recipes`);
}

// Run the update
updateSpoonacularNutrition()
  .then(() => {
    console.log('✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 