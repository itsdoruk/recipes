import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!SPOONACULAR_API_KEY) {
  console.error('Missing Spoonacular API key:');
  console.error('- NEXT_PUBLIC_SPOONACULAR_API_KEY');
  console.error('Spoonacular recipes will not be available without this key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const SPOONACULAR_USER_ID = '00000000-0000-0000-0000-000000000001';

// Sample Spoonacular recipes to populate
const SAMPLE_SPOONACULAR_RECIPES = [
  {
    id: '716429',
    title: 'Pasta with Garlic, Scallions, Cauliflower & Breadcrumbs',
    description: 'A delicious pasta dish with roasted cauliflower, garlic, and crispy breadcrumbs.',
    image_url: 'https://spoonacular.com/recipeImages/716429-556x370.jpg',
    cuisine_type: 'italian',
    diet_type: 'vegetarian',
    cooking_time: '45 mins',
    cooking_time_value: 45,
    ingredients: [
      '1 pound pasta',
      '1 head cauliflower',
      '4 cloves garlic',
      '4 scallions',
      '1 cup breadcrumbs',
      'Olive oil',
      'Salt and pepper'
    ],
    instructions: [
      'Preheat oven to 400°F',
      'Cut cauliflower into florets and roast with olive oil',
      'Cook pasta according to package directions',
      'Sauté garlic and scallions',
      'Combine all ingredients and top with breadcrumbs'
    ]
  },
  {
    id: '715538',
    title: 'What to make for dinner tonight??',
    description: 'A quick and easy dinner recipe that you can make tonight.',
    image_url: 'https://spoonacular.com/recipeImages/715538-556x370.jpg',
    cuisine_type: 'american',
    diet_type: 'omnivore',
    cooking_time: '30 mins',
    cooking_time_value: 30,
    ingredients: [
      '2 chicken breasts',
      '1 cup rice',
      '2 cups vegetables',
      'Soy sauce',
      'Garlic',
      'Ginger'
    ],
    instructions: [
      'Cook rice according to package directions',
      'Season chicken with salt and pepper',
      'Cook chicken in a pan until golden',
      'Add vegetables and stir-fry',
      'Combine with rice and season with soy sauce'
    ]
  },
  {
    id: '716408',
    title: 'Greek-Style Baked Fish: Fresh, Simple, and Irresistible',
    description: 'A Mediterranean-inspired baked fish dish with fresh herbs and lemon.',
    image_url: 'https://spoonacular.com/recipeImages/716408-556x370.jpg',
    cuisine_type: 'greek',
    diet_type: 'pescatarian',
    cooking_time: '25 mins',
    cooking_time_value: 25,
    ingredients: [
      '4 fish fillets',
      '2 lemons',
      '4 cloves garlic',
      'Fresh oregano',
      'Olive oil',
      'Salt and pepper'
    ],
    instructions: [
      'Preheat oven to 400°F',
      'Place fish in a baking dish',
      'Drizzle with olive oil and lemon juice',
      'Add garlic and herbs',
      'Bake for 20-25 minutes'
    ]
  },
  {
    id: '716268',
    title: 'African Chicken Peanut Stew',
    description: 'A rich and flavorful stew with chicken, peanuts, and African spices.',
    image_url: 'https://spoonacular.com/recipeImages/716268-556x370.jpg',
    cuisine_type: 'african',
    diet_type: 'omnivore',
    cooking_time: '60 mins',
    cooking_time_value: 60,
    ingredients: [
      '2 pounds chicken',
      '1 cup peanut butter',
      '2 onions',
      '4 tomatoes',
      'African spices',
      'Rice for serving'
    ],
    instructions: [
      'Brown chicken in a large pot',
      'Add onions and cook until soft',
      'Add tomatoes and spices',
      'Stir in peanut butter',
      'Simmer for 45 minutes'
    ]
  },
  {
    id: '715446',
    title: 'Slow Cooker Beef Stew',
    description: 'A hearty beef stew made in the slow cooker for maximum flavor.',
    image_url: 'https://spoonacular.com/recipeImages/715446-556x370.jpg',
    cuisine_type: 'american',
    diet_type: 'omnivore',
    cooking_time: '480 mins',
    cooking_time_value: 480,
    ingredients: [
      '2 pounds beef chuck',
      '4 carrots',
      '4 potatoes',
      '2 onions',
      'Beef broth',
      'Worcestershire sauce'
    ],
    instructions: [
      'Cut beef into cubes',
      'Place all ingredients in slow cooker',
      'Cook on low for 8 hours',
      'Season to taste',
      'Serve hot'
    ]
  },
  {
    id: '716381',
    title: 'Nigerian Snail Stew',
    description: 'A traditional Nigerian dish featuring snails in a rich tomato sauce.',
    image_url: 'https://spoonacular.com/recipeImages/716381-556x370.jpg',
    cuisine_type: 'african',
    diet_type: 'omnivore',
    cooking_time: '90 mins',
    cooking_time_value: 90,
    ingredients: [
      '2 pounds snails',
      '4 tomatoes',
      '2 onions',
      'Nigerian spices',
      'Palm oil',
      'Salt and pepper'
    ],
    instructions: [
      'Clean and prepare snails',
      'Sauté onions in palm oil',
      'Add tomatoes and spices',
      'Add snails and simmer',
      'Cook until tender'
    ]
  }
];

async function main() {
  console.log('Starting Spoonacular recipes population...\n');

  // Step 1: Check if spoonacular_mappings table exists
  console.log('1. Checking database schema...');
  try {
    const { error: checkError } = await supabase
      .from('spoonacular_mappings')
      .select('*')
      .limit(1);
    
    if (checkError) {
      console.log('   Creating spoonacular_mappings table...');
      // Create the table if it doesn't exist
      const { error: createError } = await supabase.rpc('create_spoonacular_mappings_table');
      if (createError) {
        console.error('   Error creating table:', createError);
        console.log('   Please create the table manually or check your database permissions.');
        return;
      }
    }
    console.log('   ✓ Database schema is ready');
  } catch (error) {
    console.error('   Error checking schema:', error);
    return;
  }

  // Step 2: Insert sample Spoonacular recipes
  console.log('\n2. Inserting sample Spoonacular recipes...');
  let insertedCount = 0;
  let skippedCount = 0;

  for (const recipe of SAMPLE_SPOONACULAR_RECIPES) {
    try {
      // Check if recipe already exists
      const { data: existingRecipe } = await supabase
        .from('recipes')
        .select('id')
        .eq('recipe_type', 'spoonacular')
        .eq('spoonacular_id', recipe.id)
        .maybeSingle();

      if (existingRecipe) {
        console.log(`   Skipping ${recipe.title} (already exists)`);
        skippedCount++;
        continue;
      }

      // Generate UUID for the recipe
      const recipeId = uuidv4();

      // Insert the recipe
      const { error: insertError } = await supabase
        .from('recipes')
        .insert({
          id: recipeId,
          title: recipe.title,
          description: recipe.description,
          image_url: recipe.image_url,
          user_id: SPOONACULAR_USER_ID,
          created_at: new Date().toISOString(),
          cuisine_type: recipe.cuisine_type,
          cooking_time: recipe.cooking_time,
          diet_type: recipe.diet_type,
          cooking_time_value: recipe.cooking_time_value,
          recipe_type: 'spoonacular',
          spoonacular_id: recipe.id,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions
        });

      if (insertError) {
        console.error(`   Error inserting ${recipe.title}:`, insertError);
        continue;
      }

      // Insert the mapping
      const { error: mappingError } = await supabase
        .from('spoonacular_mappings')
        .insert({
          recipe_id: recipeId,
          spoonacular_id: recipe.id,
          created_at: new Date().toISOString()
        });

      if (mappingError) {
        console.error(`   Error creating mapping for ${recipe.title}:`, mappingError);
        // Clean up the recipe if mapping fails
        await supabase
          .from('recipes')
          .delete()
          .eq('id', recipeId);
        continue;
      }

      console.log(`   ✓ Inserted: ${recipe.title}`);
      insertedCount++;
    } catch (error) {
      console.error(`   Error processing ${recipe.title}:`, error);
    }
  }

  // Step 3: Summary
  console.log('\n3. Summary:');
  console.log(`   Recipes inserted: ${insertedCount}`);
  console.log(`   Recipes skipped (already exist): ${skippedCount}`);
  console.log(`   Total sample recipes: ${SAMPLE_SPOONACULAR_RECIPES.length}`);

  if (insertedCount > 0) {
    console.log('\n✅ Spoonacular recipes populated successfully!');
    console.log('   They should now appear on your homepage.');
  } else {
    console.log('\nℹ️ No new recipes were inserted (they may already exist).');
  }
}

main().catch(console.error); 