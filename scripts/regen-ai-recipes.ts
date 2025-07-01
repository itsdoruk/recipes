import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { generateAIRecipe } from '../src/lib/aiRecipeGenerator';

// Load .env.local file explicitly
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
  console.error('Please add NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co to your .env.local file');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  console.error('Please add SUPABASE_SERVICE_ROLE_KEY=your-service-role-key to your .env.local file');
  process.exit(1);
}

console.log('Environment variables loaded successfully');
console.log('Supabase URL:', supabaseUrl);
console.log('Service role key:', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Delete all AI recipes
  console.log('Deleting all AI recipes...');
  const { error: deleteError } = await supabase.from('recipes').delete().eq('recipe_type', 'ai');
  if (deleteError) {
    console.error('Failed to delete AI recipes:', deleteError.message);
    process.exit(1);
  }
  console.log('Deleted all AI recipes.');

  // 2. Generate 15 new AI recipes using the shared utility
  for (let i = 0; i < 15; i++) {
    try {
      const recipe = await generateAIRecipe('Generate a creative, unique, and delicious recipe.');
      const { error: insertError } = await supabase.from('recipes').insert([recipe]);
      if (insertError) {
        console.error(`Failed to insert AI recipe ${i + 1}:`, insertError.message);
        continue;
      }
      console.log(`Inserted AI recipe ${i + 1}:`, recipe.title);
    } catch (err) {
      console.error(`Error generating/inserting AI recipe ${i + 1}:`, err);
    }
  }
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
}); 