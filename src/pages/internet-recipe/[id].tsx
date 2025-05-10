import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import StarButton from '@/components/StarButton';
import { RANDOM_CARD_IMG } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { toLowerCaseObject } from '@/lib/utils';
import { extractRecipePropertiesFromMarkdown } from '@/lib/recipeUtils';

const CUISINE_TYPES = [
  'italian', 'mexican', 'asian', 'american', 'mediterranean',
  'french', 'chinese', 'japanese', 'indian', 'thai', 'greek',
  'spanish', 'british', 'turkish', 'korean', 'vietnamese', 'german', 'caribbean', 'african', 'middle eastern', 'russian', 'brazilian'
];

const DIET_TYPES = [
  'vegetarian', 'vegan', 'gluten-free', 'ketogenic', 'paleo',
  'pescatarian', 'lacto-vegetarian', 'ovo-vegetarian', 'whole30', 'low-fodmap', 'dairy-free', 'nut-free', 'halal', 'kosher'
];

function mapToAllowedCuisine(cuisine: string) {
  if (!cuisine) return 'unknown';
  cuisine = cuisine.toLowerCase();
  return CUISINE_TYPES.find(type => cuisine.includes(type)) || 'unknown';
}

function mapToAllowedDiet(diet: string) {
  if (!diet) return 'unknown';
  diet = diet.toLowerCase();
  return DIET_TYPES.find(type => diet.includes(type)) || 'unknown';
}

function splitInstructions(instructions: string): string[] {
  return instructions
    .split(/\.|;|\n/)
    .map(step => step.trim())
    .filter(Boolean);
}

export default function InternetRecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const [recipe, setRecipe] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id || typeof id !== 'string') {
        setError('Invalid recipe ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // First try to get from localStorage
        const storedRecipe = localStorage.getItem(id);
        if (storedRecipe) {
          setRecipe(JSON.parse(storedRecipe));
          setIsLoading(false);
          return;
        }

        // If not in localStorage, check if it's a starred recipe
        const parts = id.split('-');
        if (parts[0] === 'random' && parts[1] === 'internet') {
          const mealId = parts[2];
          const { data: starredRecipe, error: starredError } = await supabase
            .from('starred_recipes')
            .select('*')
            .eq('recipe_id', id)
            .single();

          if (starredRecipe) {
            setRecipe(starredRecipe);
            setIsLoading(false);
            return;
          }

          // If not starred, fetch from TheMealDB
          const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`);
          const data = await response.json();
          const meal = data.meals?.[0];

          if (!meal) {
            throw new Error('Recipe not found');
          }

          // Generate AI content for the recipe
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

          const aiData = await aiRes.json();
          let aiContent = aiData.choices[0].message.content;
          if (aiContent instanceof Promise) {
            aiContent = await aiContent;
          }

          // Extract properties from AI markdown
          const extracted = extractRecipePropertiesFromMarkdown(aiContent);

          // Helper to check if description is just the title
          const isDescriptionJustTitle = (desc: string, title: string) => {
            if (!desc || !title) return true;
            const d = desc.trim().toLowerCase();
            const t = title.trim().toLowerCase();
            return d === t || d.startsWith(t) || t.startsWith(d);
          };

          // Fallbacks: use AI's value if present, else use a friendly default
          const description =
            extracted.description &&
            extracted.description !== 'unknown' &&
            !isDescriptionJustTitle(extracted.description, meal.strMeal)
              ? extracted.description
              : "A delicious dish you'll love!";

          const ingredients = extracted.ingredients && extracted.ingredients.length > 0 ? extracted.ingredients : Object.keys(meal)
            .filter(k => k.startsWith('strIngredient') && meal[k] && meal[k].trim() && meal[k].toLowerCase() !== 'null')
            .map(k => meal[k].trim());

          const instructions = extracted.instructions && extracted.instructions.length > 0 ? extracted.instructions : (meal.strInstructions
            ? meal.strInstructions.split(/\r?\n|\.\s+/).map((s: string) => s.trim()).filter(Boolean)
            : []);

          const nutrition = (extracted.nutrition && extracted.nutrition.calories !== 'unknown') ? extracted.nutrition : { calories: 'unknown', protein: 'unknown', fat: 'unknown', carbohydrates: 'unknown' };

          // Normalize cuisine_type and diet_type for AI recipes to match filter options
          const cuisine_type = mapToAllowedCuisine(
            extracted.cuisine_type && extracted.cuisine_type !== 'unknown'
              ? extracted.cuisine_type
              : meal.strArea || meal.strCategory || ''
          );

          const diet_type = mapToAllowedDiet(
            extracted.diet_type && extracted.diet_type !== 'unknown'
              ? extracted.diet_type
              : meal.strCategory || ''
          );

          const mappedTime = extracted.cooking_time_value || 0;
          const cooking_time = extracted.cooking_time && extracted.cooking_time !== 'unknown' ? extracted.cooking_time : (mappedTime ? `${mappedTime} mins` : 'unknown');

          // Clean up instructions: remove duplicate number bullets if present
          const cleanedInstructions = instructions.map((step: string) => step.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);

          const recipe = {
            id,
            title: meal.strMeal,
            description,
            image_url: meal.strMealThumb || RANDOM_CARD_IMG,
            user_id: 'internet',
            created_at: new Date().toISOString(),
            ingredients,
            instructions: cleanedInstructions,
            nutrition,
            cuisine_type,
            diet_type,
            cooking_time,
            cooking_time_value: mappedTime
          };

          // Store in localStorage for future use
          localStorage.setItem(id, JSON.stringify(recipe));
          setRecipe(recipe);
        } else {
          throw new Error('Invalid recipe ID format');
        }
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="block p-4 border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900 transition-opacity rounded-xl">
          <div className="relative w-full h-48 mb-4">
            <Image src={RANDOM_CARD_IMG} alt="random recipe" fill className="object-cover rounded-xl" />
          </div>
          <h3 className="text-lg mb-2">discovering a random internet recipe...</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            please wait while ai improvises a surprise recipe for you!
          </div>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4">
          <p className="text-red-500">{error || 'Recipe not found'}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-xl"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8 rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          {recipe.image_url && (
            <div className="relative w-full h-96 rounded-xl overflow-hidden">
              <Image
                src={recipe.image_url}
                alt={recipe.title}
                fill
                className="object-cover rounded-xl"
              />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl">{recipe.title}</h1>
              <StarButton recipeId={recipe.id} recipeType="ai" />
            </div>
            <span className="text-gray-500 dark:text-gray-400 block mt-2">
              {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ''}
            </span>
          </div>
          <div>
            <h2 className="text-xl mb-4">description</h2>
            <div className="text-blue-600 dark:text-blue-400 mb-2">{recipe.funDescription}</div>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: recipe.description }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Cuisine */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">cuisine</h3>
              <p className="">{recipe.cuisine_type || 'N/A'}</p>
            </div>
            {/* Cooking Time */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">cooking time</h3>
              <p className="">{recipe.cooking_time || 'N/A'}</p>
            </div>
            {/* Diet */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">diet</h3>
              <p className="">{recipe.diet_type || 'N/A'}</p>
            </div>
          </div>
          {/* Nutrition Section */}
          <div>
            <h2 className="text-xl mb-4 mt-8">nutrition</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Calories', 'Protein', 'Fat', 'Carbohydrates'].map((nutrient) => {
                let value = 'N/A';
                if (recipe.nutrition && Array.isArray(recipe.nutrition.nutrients)) {
                  const n = recipe.nutrition.nutrients.find((x: any) => x.name === nutrient);
                  if (n) value = `${n.amount} ${n.unit}`;
                } else if (recipe[nutrient.toLowerCase()]) {
                  value = recipe[nutrient.toLowerCase()];
                }
                return (
                  <div key={nutrient} className="text-center">
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">{nutrient.toLowerCase()}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {recipe.ingredients && (
            <div>
              <h2 className="text-xl mb-4">ingredients</h2>
              <ul className="list-disc list-inside space-y-2">
                {Array.isArray(recipe.ingredients)
                  ? recipe.ingredients.map((ingredient: string, index: number) => (
                      <li key={index} className="">
                        {ingredient}
                      </li>
                    ))
                  : null}
              </ul>
            </div>
          )}
          {recipe.instructions && (
            <div>
              <h2 className="text-xl mb-4">instructions</h2>
              {Array.isArray(recipe.instructions) ? (
                <ol className="list-decimal list-inside space-y-4">
                  {recipe.instructions.map((instruction: string, index: number) => (
                    <li key={index} className="">
                      {instruction}
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-4">
                  {splitInstructions(recipe.instructions).map((step, idx) => (
                    <li key={idx} className="">{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}