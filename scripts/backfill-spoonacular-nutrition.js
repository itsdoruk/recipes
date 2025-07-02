const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchSpoonacularNutrition(spoonacularId) {
  const apiKey = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
  const url = `https://api.spoonacular.com/recipes/${spoonacularId}/nutritionWidget.json?apiKey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch nutrition for ID ${spoonacularId}:`, res.statusText);
      return null;
    }
    const data = await res.json();
    // Helper to find nutrient by name
    const getNutrient = (name) => {
      const n = data.nutrients.find(n => n.name.toLowerCase() === name.toLowerCase());
      return n ? Math.round(n.amount) : null;
    };
    return {
      calories: getNutrient('Calories'),
      protein: getNutrient('Protein'),
      fat: getNutrient('Fat'),
      carbohydrates: getNutrient('Carbohydrates')
    };
  } catch (err) {
    console.error(`Error fetching nutrition for ID ${spoonacularId}:`, err);
    return null;
  }
}

async function main() {
  // Find all spoonacular recipes with missing or zero nutrition
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, description, calories, protein, fat, carbohydrates, spoonacular_id')
    .eq('recipe_type', 'spoonacular')
    .or('calories.is.null,calories.eq.0,protein.is.null,protein.eq.0,fat.is.null,fat.eq.0,carbohydrates.is.null,carbohydrates.eq.0');

  if (error) {
    console.error('Error fetching recipes:', error);
    process.exit(1);
  }

  let updated = 0;
  for (const recipe of recipes) {
    if (!recipe.spoonacular_id) {
      console.warn(`Recipe ${recipe.id} is missing spoonacular_id, skipping.`);
      continue;
    }
    const nutrition = await fetchSpoonacularNutrition(recipe.spoonacular_id);
    if (!nutrition) {
      console.warn(`Could not fetch nutrition for recipe ${recipe.id}`);
      continue;
    }
    const updateData = {};
    ['calories', 'protein', 'fat', 'carbohydrates'].forEach((key) => {
      const val = recipe[key];
      if (
        val === null ||
        val === 0 ||
        val === '0'
      ) {
        if (nutrition[key] !== null) updateData[key] = nutrition[key];
      }
    });
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', recipe.id);
      if (updateError) {
        console.error(`Failed to update recipe ${recipe.id}:`, updateError);
      } else {
        console.log(`Updated recipe ${recipe.id}:`, updateData);
        updated++;
      }
    }
  }
  console.log(`Done! Updated ${updated} recipes.`);
}

main();