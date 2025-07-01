import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Load .env.local file explicitly
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
  process.exit(1);
}
if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to guess diet type from ingredients
function guessDietType(ingredients: string[]): string {
  const meat = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'shrimp', 'bacon', 'ham', 'turkey', 'duck', 'anchovy', 'salmon', 'tuna', 'crab', 'lobster', 'clam', 'mussel', 'octopus', 'squid', 'veal', 'goat', 'mutton', 'sausage', 'prosciutto', 'anchovies', 'trout', 'snapper', 'sardine', 'steak', 'mince', 'meat', 'ox', 'rabbit', 'venison', 'quail', 'goose', 'pheasant', 'snail', 'escargot', 'frog', 'eel', 'caviar', 'roe', 'shellfish', 'scallop', 'calamari', 'conch', 'grouper', 'herring', 'perch', 'pollock', 'tilapia', 'walleye', 'catfish', 'carp', 'bass', 'cod', 'haddock', 'halibut', 'mackerel', 'mahi', 'marlin', 'monkfish', 'orange roughy', 'pike', 'sablefish', 'shad', 'skate', 'smelt', 'sole', 'sturgeon', 'swordfish', 'whitefish', 'whiting'];
  
  const lowerIngredients = ingredients
    .map(i => i && i.toLowerCase().trim())
    .filter(i => i && i.length > 0);

  for (const ing of lowerIngredients) {
    for (const m of meat) {
      if (ing.includes(m)) {
        return 'omnivore';
      }
    }
  }
  return 'vegetarian';
}

// Helper function to guess cooking time from instructions
function guessCookingTime(instructions: string[]): { label: string, value: number } {
  const steps = instructions.length;
  if (steps <= 3) return { label: '15 mins', value: 15 };
  if (steps <= 6) return { label: '30 mins', value: 30 };
  return { label: '45 mins', value: 45 };
}

// Helper function to generate random nutrition values
function generateRandomNutrition(): { calories: number, protein: number, fat: number, carbohydrates: number } {
  return {
    calories: Math.floor(Math.random() * 400) + 200, // 200-600 calories
    protein: Math.floor(Math.random() * 30) + 10,    // 10-40g protein
    fat: Math.floor(Math.random() * 25) + 5,         // 5-30g fat
    carbohydrates: Math.floor(Math.random() * 50) + 20 // 20-70g carbs
  };
}

async function generateAIRecipeFromTheMealDB() {
  try {
    // Fetch a random meal from TheMealDB
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
    if (!response.ok) {
      throw new Error('Failed to fetch from TheMealDB');
    }
    
    const data = await response.json();
    const meal = data.meals[0];
    
    if (!meal) {
      throw new Error('No meal data received');
    }

    // Extract ingredients (TheMealDB has ingredients in strIngredient1, strIngredient2, etc.)
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ingredient && ingredient.trim()) {
        const fullIngredient = measure ? `${measure} ${ingredient}`.trim() : ingredient;
        ingredients.push(fullIngredient);
      }
    }

    // Extract instructions
    const instructions = meal.strInstructions
      ? meal.strInstructions
          .split(/\.\s+/)
          .map((step: string) => step.trim())
          .filter((step: string) => step.length > 10)
      : ['Mix all ingredients together.', 'Cook until done.', 'Serve hot.'];

    // Create a proper description (not just truncated instructions)
    const description = `${meal.strMeal} is a delicious ${meal.strArea || 'international'} dish. ${meal.strCategory ? `This ${meal.strCategory.toLowerCase()} recipe` : 'This recipe'} features fresh ingredients and traditional cooking methods to create a flavorful and satisfying meal.`;

    // Guess diet type from ingredients
    const dietType = guessDietType(ingredients);
    
    // Guess cooking time
    const cookingTime = guessCookingTime(instructions);
    
    // Generate random nutrition
    const nutrition = generateRandomNutrition();

    // Create a new recipe object with a UUID
    const newRecipe = {
      id: uuidv4(),
      title: meal.strMeal || 'Delicious Recipe',
      description: description,
      ingredients,
      instructions,
      image_url: meal.strMealThumb || 'https://via.placeholder.com/400x300?text=Recipe',
      cooking_time: cookingTime.label,
      cooking_time_value: cookingTime.value,
      cooking_time_unit: 'mins',
      user_id: '00000000-0000-0000-0000-000000000000',
      cuisine_type: meal.strArea?.toLowerCase() || 'international',
      diet_type: dietType,
      recipe_type: 'ai',
      calories: nutrition.calories.toString(),
      protein: nutrition.protein.toString(),
      fat: nutrition.fat.toString(),
      carbohydrates: nutrition.carbohydrates.toString(),
    };

    return newRecipe;
  } catch (error) {
    throw new Error(`Failed to generate recipe from TheMealDB: ${error}`);
  }
}

async function main() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting daily AI recipe generation...`);

  // Check how many AI recipes we currently have
  const { data: existingRecipes, error: countError } = await supabase
    .from('recipes')
    .select('id', { count: 'exact' })
    .eq('recipe_type', 'ai');

  if (countError) {
    console.error('Failed to count existing AI recipes:', countError.message);
    process.exit(1);
  }

  const currentCount = existingRecipes?.length || 0;
  console.log(`Current AI recipes in database: ${currentCount}`);

  // Generate 100 new AI recipes from TheMealDB
  console.log('Generating 100 new AI recipes from TheMealDB...');
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < 100; i++) {
    try {
      const recipe = await generateAIRecipeFromTheMealDB();
      const { error: insertError } = await supabase.from('recipes').insert([recipe]);
      if (insertError) {
        console.error(`Failed to insert AI recipe ${i + 1}:`, insertError.message);
        errorCount++;
        continue;
      }
      successCount++;
      console.log(`Inserted AI recipe ${i + 1}/100:`, recipe.title);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Error generating/inserting AI recipe ${i + 1}:`, err);
      errorCount++;
    }
  }

  const endTime = new Date();
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
  
  console.log(`[${endTime.toISOString()}] Daily AI recipe generation complete!`);
  console.log(`✅ Successfully added: ${successCount} recipes`);
  console.log(`❌ Errors: ${errorCount} recipes`);
  console.log(`⏱️ Duration: ${duration} seconds`);
  console.log(`📊 Total AI recipes now: ${currentCount + successCount}`);
}

main().catch((err) => {
  console.error('Daily AI recipe generation failed:', err);
  process.exit(1);
}); 