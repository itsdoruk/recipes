import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import Image from 'next/image';
import Link from 'next/link';
import { getRecipeById } from '../../lib/spoonacular';
import { getSupabaseClient } from '../../lib/supabase';
import Comments from '../../components/Comments';
import { GetServerSideProps } from 'next';
import { marked } from 'marked';
import StarButton from '../../components/StarButton';
import ReportButton from '../../components/ReportButton';
import { useProfile } from '../../hooks/useProfile';
import ShareButton from '@/components/ShareButton';
import { cleanStepPrefix, extractRecipePropertiesFromMarkdown } from '@/lib/recipeUtils';
import { parseRecipeId } from '@/lib/recipeIdUtils';
import { RANDOM_CARD_IMG } from '@/lib/constants';
import { generateRecipeId } from '@/lib/recipeIdUtils';

function hasUserId(recipe: any): recipe is { user_id: string } {
  return recipe && typeof recipe.user_id === 'string';
}

export function hasId(recipe: any): recipe is { id: string | number } {
  return recipe && (typeof recipe.id === 'string' || typeof recipe.id === 'number');
}

function splitInstructions(instructions: string): string[] {
  // Split by period, semicolon, or newline, and trim whitespace
  return instructions
    .split(/\.|;|\n/)
    .map(step => step.trim())
    .filter(Boolean)
    .map(step => cleanStepPrefix(step)); // Apply step prefix cleaning
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  image?: string;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: string;
    protein: string;
    fat: string;
    carbohydrates: string;
    nutrients?: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
  summary?: string;
  cuisines?: string[];
  diets?: string[];
  cooking_time_value?: number;
  cooking_time_unit?: string;
  readyInMinutes?: number;
  extendedIngredients?: Array<{
    original: string;
  }>;
  [key: string]: any; // Allow additional properties
}

interface RecipePageProps {
  recipe: Recipe | null;
  lastUpdated: string;
  error?: string;
}

// Utility function to extract nutrition from text
function extractNutritionFromText(text: string) {
  const result = { calories: 'N/A', protein: 'N/A', fat: 'N/A', carbohydrates: 'N/A' };
  if (!text) return result;
  const calMatch = text.match(/(\d+)\s*(?:calories|kcal|cal)/i);
  // Match '10g protein', '10 grams protein', 'protein: 10g', 'protein: 10 grams'
  const proteinMatch = text.match(/(?:protein\s*[:\-]?\s*)(\d+)(?:\s*(?:g|grams))?/i) || text.match(/(\d+)\s*(?:g|grams)?\s*protein/i);
  const fatMatch = text.match(/(?:fat\s*[:\-]?\s*)(\d+)(?:\s*(?:g|grams))?/i) || text.match(/(\d+)\s*(?:g|grams)?\s*fat/i);
  // Match 'carbohydrates', 'carbs', 'carbohydrate'
  const carbMatch = text.match(/(?:carbohydrates?|carbs?)\s*[:\-]?\s*(\d+)(?:\s*(?:g|grams))?/i) || text.match(/(\d+)\s*(?:g|grams)?\s*(?:carbohydrates?|carbs?)/i);
  if (calMatch) result.calories = calMatch[1];
  if (proteinMatch) result.protein = proteinMatch[1];
  if (fatMatch) result.fat = fatMatch[1];
  if (carbMatch) result.carbohydrates = carbMatch[1];
  return result;
}

// Utility to strip HTML tags
function stripHtmlTags(str: string) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}

export default function RecipePage({ recipe, lastUpdated, error: serverError }: RecipePageProps) {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const user = session?.user || null;
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [error, setError] = useState<string | null>(serverError || null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recipeType, setRecipeType] = useState<'user' | 'ai' | 'spoonacular'>(
    recipe?.id.toString().startsWith('spoonacular-') ? 'spoonacular' : 'user'
  );

  const handleDelete = async () => {
    if (!recipe || !user || recipe.user_id !== user.id) return;
    if (!confirm('are you sure you want to delete this recipe?')) return;
    setIsDeleting(true);
    try {
      let deleteQuery = supabase.from('recipes').delete();
      if (recipe.id == null) {
        // Delete rows where id IS NULL
        deleteQuery = deleteQuery.is('id', null);
      } else {
        // Delete by specific id
        deleteQuery = deleteQuery.eq('id', recipe.id);
      }
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;
      router.push('/');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setError('failed to delete recipe');
      setIsDeleting(false);
    }
  };

  if (isProfileLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">loading...</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <p className="text-red-500">{error || 'recipe not found'}</p>
        </div>
      </div>
    );
  }

  const isOwner = user?.id && hasUserId(recipe) && user.id === recipe.user_id;

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
        <meta name="description" content={recipe.description} />
        <meta property="og:title" content={recipe.title} />
        <meta property="og:description" content={recipe.description} />
        {recipe.image_url && <meta property="og:image" content={recipe.image_url} />}
        <meta name="last-modified" content={lastUpdated} />
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {recipe.image_url || recipe.image ? (
            <div className="relative w-full h-96 rounded-xl overflow-hidden">
              <Image
                src={recipe.image_url || recipe.image || ''}
                alt={recipe.title}
                fill
                className="object-cover rounded-xl"
              />
            </div>
          ) : null}

          <div>
            <h1 className="text-3xl mb-6">{recipe.title}</h1>
            <div className="flex items-center gap-2 mb-2">
              {recipeType === 'spoonacular' ? (
                <>
                  <span className="w-8 h-8 rounded-full bg-gray-800 text-gray-200 dark:bg-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-lg select-none">S</span>
                  <span className="font-medium prose prose-invert">spoonacular</span>
                </>
              ) : recipeType === 'ai' || recipe.user_id === '00000000-0000-0000-0000-000000000000' ? (
                <span className="font-medium prose prose-invert">AI Recipe</span>
              ) : (
                <>
                  {profile?.avatar_url && (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username || '[recipes] user'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <Link
                    href={`/user/${recipe.user_id}`}
                    className="text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    {profile?.username || '[recipes] user'}
                  </Link>
                </>
              )}
              <span className="text-gray-500 dark:text-gray-400">
                • {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ''}
              </span>
              {isOwner && hasId(recipe) && (
                <div className="flex gap-2 ml-auto">
                  <Link
                    href={`/edit-recipe/${recipe.id}`}
                    className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg flex items-center justify-center"
                  >
                    edit
                  </Link>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 text-red-500 dark:text-red-400 rounded-lg"
                  >
                    {isDeleting ? 'deleting...' : 'delete'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">description</h2>
            <div className="prose prose-invert max-w-none">
              {recipeType === 'ai'
                ? (recipe.description && recipe.description !== 'A delicious dish you\'ll love!'
                    ? recipe.description
                    : <span className="italic text-gray-400">No description available.</span>)
                : (recipeType === 'spoonacular'
                    ? stripHtmlTags(recipe.description || recipe.summary || '')
                    : (recipe.description || recipe.summary || <span className="italic text-gray-400">No description available.</span>))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 my-4">
            {/* Cuisine */}
            {(recipe.cuisine_type || (recipe.cuisines && recipe.cuisines.length > 0)) && (
              <span className="px-4 py-1 rounded-full font-semibold text-sm pill-white">
                {recipe.cuisine_type || (recipe.cuisines && recipe.cuisines.join(', '))}
              </span>
            )}
            {/* Diet */}
            {(recipe.diet_type || (recipe.diets && recipe.diets.length > 0)) && (
              <span className="px-4 py-1 rounded-full font-semibold text-sm pill-white">
                {recipe.diet_type || (recipe.diets && recipe.diets.join(', '))}
              </span>
            )}
            {/* Cooking Time */}
            {(recipe.cooking_time_value && recipe.cooking_time_unit) || recipe.cooking_time || recipe.readyInMinutes ? (
              <span className="px-4 py-1 rounded-full font-semibold text-sm pill-white">
                {(recipe.cooking_time_value && recipe.cooking_time_unit)
                  ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit}`
                  : recipe.cooking_time || (recipe.readyInMinutes && recipe.readyInMinutes + ' mins')}
              </span>
            ) : null}
          </div>

          {/* Nutrition Section */}
          <div>
            <h2 className="text-xl mb-4 mt-8">nutrition</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Calories', key: 'calories', spoonacularName: 'Calories' },
                { label: 'Protein', key: 'protein', spoonacularName: 'Protein' },
                { label: 'Fat', key: 'fat', spoonacularName: 'Fat' },
                { label: 'Carbohydrates', key: 'carbohydrates', spoonacularName: 'Carbohydrates' }
              ].map(({ label, key, spoonacularName }) => {
                let value = 'N/A';
                // 1. Try Spoonacular nutrition
                if (recipe.nutrition?.nutrients) {
                  const nutrient = recipe.nutrition.nutrients.find(
                    (n: any) => n.name === spoonacularName
                  );
                  if (nutrient) {
                    value = `${Math.round(nutrient.amount)} ${nutrient.unit}`;
                  }
                }
                // 2. Try local recipe nutrition
                else if (recipe[key as keyof typeof recipe]) {
                  const nutritionValue = recipe[key as keyof typeof recipe];
                  if (typeof nutritionValue === 'string' && nutritionValue !== 'unknown') {
                    value = nutritionValue;
                  } else if (typeof nutritionValue === 'number') {
                    value = nutritionValue.toString();
                  }
                }
                // 3. Fallback: extract from summary or description
                else {
                  const fallback = extractNutritionFromText(recipe.summary || recipe.description || '');
                  if (fallback[key as keyof typeof fallback] && fallback[key as keyof typeof fallback] !== 'N/A') {
                    value = fallback[key as keyof typeof fallback];
                  }
                }
                return (
                  <div key={label} className="text-center">
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">{label.toLowerCase()}</div>
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
                  : recipe.extendedIngredients &&
                    recipe.extendedIngredients.map((ing, idx) => (
                      <li key={idx} className="">
                        {ing.original}
                      </li>
                    ))}
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
                      {cleanStepPrefix(instruction)}
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

          <div className="flex items-center gap-4">
            <StarButton
              recipeId={recipe.id.toString()}
              recipeType={recipeType}
            />
            {recipeType === 'user' && (
              <ReportButton
                recipeId={recipe.id.toString()}
                recipeType="user"
              />
            )}
            <ShareButton
              recipeId={recipe.id.toString()}
              recipeTitle={recipe.title}
              recipeType={recipeType}
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={recipe.title}
              text={recipe.description}
            />
          </div>

          {hasId(recipe) && (
            <div className="mt-8">
              <Comments recipeId={recipe.id.toString()} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const { id } = params as { id: string };

  try {
    const { source, id: originalId } = parseRecipeId(id);

    // If it's a Spoonacular ID, fetch from the API
    if (source === 'spoonacular') {
      const recipe = await getRecipeById(id); // Pass the full ID with prefix
      if (!recipe) {
        return {
          notFound: true,
        };
      }
      return {
        props: {
          recipe: {
            ...recipe,
            id: id, // Keep the original ID with prefix
            user_id: 'spoonacular'
          },
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    // If it's an AI recipe ID (random-internet-), fetch from the API
    if (id.startsWith('random-internet-')) {
      try {
        const response = await fetch(`/api/recipes/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch AI recipe');
        }
        const recipe = await response.json();
        return {
          props: {
            recipe,
            lastUpdated: new Date().toISOString(),
          },
        };
      } catch (error) {
        console.error('Error fetching AI recipe:', error);
        return {
          notFound: true,
        };
      }
    }

    // If it's a local recipe, fetch from Supabase
    const supabase = getSupabaseClient();
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !recipe) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        recipe,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return {
      props: {
        recipe: null,
        lastUpdated: new Date().toISOString(),
        error: 'Failed to fetch recipe',
      },
    };
  }
};

// Add these utility functions
function mapToAllowedCuisine(cuisine: string) {
  if (!cuisine) return 'unknown';
  cuisine = cuisine.toLowerCase();
  const CUISINE_TYPES = [
    'italian', 'mexican', 'asian', 'american', 'mediterranean',
    'french', 'chinese', 'japanese', 'indian', 'thai', 'greek',
    'spanish', 'british', 'turkish', 'korean', 'vietnamese', 'german', 'caribbean', 'african', 'middle eastern', 'russian', 'brazilian'
  ];
  return CUISINE_TYPES.find(type => cuisine.includes(type)) || 'unknown';
}

function mapToAllowedDiet(diet: string) {
  if (!diet) return 'unknown';
  diet = diet.toLowerCase();
  const DIET_TYPES = [
    'vegetarian', 'vegan', 'gluten-free', 'ketogenic', 'paleo',
    'pescatarian', 'lacto-vegetarian', 'ovo-vegetarian', 'whole30', 'low-fodmap', 'dairy-free', 'nut-free', 'halal', 'kosher'
  ];
  return DIET_TYPES.find(type => diet.includes(type)) || 'unknown';
}