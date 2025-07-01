import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local file explicitly
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAIRecipes() {
  console.log('Checking AI recipes in database...');
  
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('recipe_type', 'ai')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching AI recipes:', error);
    return;
  }

  console.log(`Found ${recipes?.length || 0} AI recipes:`);
  
  if (recipes && recipes.length > 0) {
    recipes.forEach((recipe, index) => {
      console.log(`${index + 1}. ${recipe.title}`);
      console.log(`   - ID: ${recipe.id}`);
      console.log(`   - Created: ${recipe.created_at}`);
      console.log(`   - Has nutrition: ${!!recipe.nutrition}`);
      if (recipe.nutrition) {
        console.log(`   - Calories: ${recipe.nutrition.calories}`);
        console.log(`   - Protein: ${recipe.nutrition.protein}`);
        console.log(`   - Fat: ${recipe.nutrition.fat}`);
        console.log(`   - Carbs: ${recipe.nutrition.carbohydrates}`);
      }
      console.log('');
    });
  } else {
    console.log('No AI recipes found in database.');
  }
}

checkAIRecipes().catch(console.error); 