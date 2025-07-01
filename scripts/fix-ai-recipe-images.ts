import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to search for a meal in TheMealDB by name
async function searchMealByName(recipeTitle: string): Promise<string | null> {
  try {
    // Clean the recipe title for better search results
    const searchTerm = recipeTitle
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .trim()
      .split(' ')[0]; // Use first word for search

    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${searchTerm}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.meals && data.meals.length > 0) {
      // Find the best match by comparing titles
      const bestMatch = data.meals.find((meal: any) => 
        meal.strMeal.toLowerCase().includes(searchTerm) ||
        recipeTitle.toLowerCase().includes(meal.strMeal.toLowerCase())
      );
      
      return bestMatch ? bestMatch.strMealThumb : data.meals[0].strMealThumb;
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching for meal "${recipeTitle}":`, error);
    return null;
  }
}

// Function to get a random meal image from TheMealDB
async function getRandomMealImage(): Promise<string> {
  try {
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
    if (!response.ok) {
      throw new Error('Failed to fetch random meal');
    }

    const data = await response.json();
    if (data.meals && data.meals.length > 0) {
      return data.meals[0].strMealThumb;
    }
    
    throw new Error('No meal data received');
  } catch (error) {
    console.error('Error fetching random meal image:', error);
    // Fallback to a default TheMealDB image
    return 'https://www.themealdb.com/images/media/meals/wxywrq1468235067.jpg';
  }
}

// Function to check if an image URL is valid
async function isImageValid(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return response.ok && contentType !== null && contentType.startsWith('image/');
  } catch {
    return false;
  }
}

async function main() {
  console.log('Starting AI recipe image fix...\n');

  // Step 1: Get all AI recipes
  console.log('1. Fetching AI recipes...');
  const { data: aiRecipes, error: fetchError } = await supabase
    .from('recipes')
    .select('*')
    .eq('recipe_type', 'ai');

  if (fetchError) {
    console.error('Error fetching AI recipes:', fetchError);
    process.exit(1);
  }

  console.log(`   Found ${aiRecipes.length} AI recipes\n`);

  // Step 2: Check current images and fix only broken/missing ones
  console.log('2. Checking and fixing broken/missing images...');
  let fixedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < aiRecipes.length; i++) {
    const recipe = aiRecipes[i];
    console.log(`   Processing ${i + 1}/${aiRecipes.length}: ${recipe.title}`);

    let needsUpdate = false;
    let newImageUrl = recipe.image_url;

    // Only fix if image is missing, placeholder, or broken
    if (!recipe.image_url || 
        recipe.image_url === 'https://via.placeholder.com/400x300?text=Recipe' ||
        recipe.image_url.includes('placeholder')) {
      needsUpdate = true;
      newImageUrl = await getRandomMealImage();
      console.log(`     → Replacing placeholder with TheMealDB image`);
    } else {
      // Check if the current image is valid
      const isValid = await isImageValid(recipe.image_url);
      if (!isValid) {
        needsUpdate = true;
        newImageUrl = await getRandomMealImage();
        console.log(`     → Replacing broken image with TheMealDB image`);
      } else {
        console.log(`     → Image is valid, keeping current (${recipe.image_url})`);
        skippedCount++;
        continue;
      }
    }

    // Update the recipe with the new image
    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ image_url: newImageUrl })
        .eq('id', recipe.id);

      if (updateError) {
        console.error(`     → Error updating image for "${recipe.title}":`, updateError);
      } else {
        fixedCount++;
        console.log(`     → Updated image successfully`);
      }
    }

    // Add a delay to avoid overwhelming TheMealDB API
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Step 3: Summary
  console.log('\n3. Summary:');
  console.log(`   Total AI recipes: ${aiRecipes.length}`);
  console.log(`   Images fixed: ${fixedCount}`);
  console.log(`   Images skipped (already valid): ${skippedCount}`);

  console.log('\n✅ AI recipe image fix completed successfully!');
}

main().catch(console.error); 