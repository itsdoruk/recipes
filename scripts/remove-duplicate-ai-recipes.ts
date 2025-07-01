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

async function main() {
  console.log('Starting duplicate AI recipes cleanup...\n');

  // Step 1: Get initial counts
  console.log('1. Analyzing current AI recipes...');
  const { data: initialStats, error: statsError } = await supabase
    .from('recipes')
    .select('*')
    .eq('recipe_type', 'ai');

  if (statsError) {
    console.error('Error fetching initial stats:', statsError);
    process.exit(1);
  }

  const totalAI = initialStats.length;
  const uniqueTitles = new Set(initialStats.map(r => r.title)).size;
  const uniqueIngredients = new Set(initialStats.map(r => r.ingredients.join(','))).size;

  console.log(`   Total AI recipes: ${totalAI}`);
  console.log(`   Unique titles: ${uniqueTitles}`);
  console.log(`   Unique ingredient combinations: ${uniqueIngredients}\n`);

  // Step 2: Find duplicates by title
  console.log('2. Finding duplicates by title...');
  const titleDuplicates = new Map<string, any[]>();
  initialStats.forEach(recipe => {
    if (!titleDuplicates.has(recipe.title)) {
      titleDuplicates.set(recipe.title, []);
    }
    titleDuplicates.get(recipe.title)!.push(recipe);
  });

  const titleDuplicatesToRemove = Array.from(titleDuplicates.entries())
    .filter(([title, recipes]) => recipes.length > 1)
    .map(([title, recipes]) => ({
      title,
      recipes: recipes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }));

  console.log(`   Found ${titleDuplicatesToRemove.length} titles with duplicates`);

  // Step 3: Find duplicates by ingredients
  console.log('3. Finding duplicates by ingredients...');
  const ingredientDuplicates = new Map<string, any[]>();
  initialStats.forEach(recipe => {
    const ingredientKey = recipe.ingredients.join(',');
    if (!ingredientDuplicates.has(ingredientKey)) {
      ingredientDuplicates.set(ingredientKey, []);
    }
    ingredientDuplicates.get(ingredientKey)!.push(recipe);
  });

  const ingredientDuplicatesToRemove = Array.from(ingredientDuplicates.entries())
    .filter(([ingredients, recipes]) => recipes.length > 1)
    .map(([ingredients, recipes]) => ({
      ingredients,
      recipes: recipes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }));

  console.log(`   Found ${ingredientDuplicatesToRemove.length} ingredient combinations with duplicates\n`);

  // Step 4: Remove duplicates
  console.log('4. Removing duplicates...');
  
  // Remove title duplicates (keep oldest)
  let removedCount = 0;
  for (const { title, recipes } of titleDuplicatesToRemove) {
    const toRemove = recipes.slice(1); // Keep first (oldest), remove the rest
    const idsToRemove = toRemove.map(r => r.id);
    
    const { error } = await supabase
      .from('recipes')
      .delete()
      .in('id', idsToRemove);
    
    if (error) {
      console.error(`Error removing title duplicates for "${title}":`, error);
    } else {
      removedCount += idsToRemove.length;
      console.log(`   Removed ${idsToRemove.length} duplicates for title: "${title}"`);
    }
  }

  // Remove ingredient duplicates (keep oldest)
  for (const { ingredients, recipes } of ingredientDuplicatesToRemove) {
    const toRemove = recipes.slice(1); // Keep first (oldest), remove the rest
    const idsToRemove = toRemove.map(r => r.id);
    
    const { error } = await supabase
      .from('recipes')
      .delete()
      .in('id', idsToRemove);
    
    if (error) {
      console.error(`Error removing ingredient duplicates:`, error);
    } else {
      removedCount += idsToRemove.length;
      console.log(`   Removed ${idsToRemove.length} duplicates for ingredients: "${ingredients.substring(0, 50)}..."`);
    }
  }

  // Step 5: Verify results
  console.log('\n5. Verifying results...');
  const { data: finalStats, error: finalStatsError } = await supabase
    .from('recipes')
    .select('*')
    .eq('recipe_type', 'ai');

  if (finalStatsError) {
    console.error('Error fetching final stats:', finalStatsError);
    process.exit(1);
  }

  const finalTotal = finalStats.length;
  const finalUniqueTitles = new Set(finalStats.map(r => r.title)).size;
  const finalUniqueIngredients = new Set(finalStats.map(r => r.ingredients.join(','))).size;

  console.log(`   Final AI recipes: ${finalTotal}`);
  console.log(`   Final unique titles: ${finalUniqueTitles}`);
  console.log(`   Final unique ingredient combinations: ${finalUniqueIngredients}`);
  console.log(`   Total recipes removed: ${removedCount}`);

  console.log('\n✅ Duplicate AI recipes cleanup completed successfully!');
}

main().catch(console.error); 