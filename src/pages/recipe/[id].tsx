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
import { cleanStepPrefix, extractRecipePropertiesFromMarkdown, stripHtmlTags } from '@/lib/recipeUtils';
import { parseRecipeId, isValidRecipeId } from '@/lib/recipeIdUtils';
import { RANDOM_CARD_IMG } from '@/lib/constants';
import { generateRecipeId } from '@/lib/recipeIdUtils';
import { fetchProfileById } from '@/lib/api/profile';

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

// Helper to strip <b> and </b> tags
function stripBoldTags(text: string) {
  return typeof text === 'string' ? text.replace(/<\/?b>/gi, '') : text;
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
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [ownerProfileLoading, setOwnerProfileLoading] = useState(true);

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

  useEffect(() => {
    async function loadOwnerProfile() {
      if (!recipe?.user_id || recipe.user_id === 'spoonacular' || recipe.user_id === 'ai' || recipe.user_id === '00000000-0000-0000-0000-000000000000') {
        setOwnerProfile(null);
        setOwnerProfileLoading(false);
        return;
      }
      setOwnerProfileLoading(true);
      const profile = await fetchProfileById(recipe.user_id);
      setOwnerProfile(profile);
      setOwnerProfileLoading(false);
    }
    loadOwnerProfile();
  }, [recipe?.user_id]);

  if (isProfileLoading || ownerProfileLoading) {
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
        <title>{stripBoldTags(recipe.title)} | [recipes]</title>
        <meta name="description" content={stripBoldTags(recipe.description)} />
        <meta property="og:title" content={stripBoldTags(recipe.title)} />
        <meta property="og:description" content={stripBoldTags(recipe.description)} />
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
            <h1 className="text-3xl mb-6">{stripBoldTags(recipe.title)}</h1>
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
                  {ownerProfile?.avatar_url && (
                    <img
                      src={ownerProfile.avatar_url}
                      alt={ownerProfile.username || '[recipes] user'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <Link
                    href={`/user/${recipe.user_id}`}
                    className="text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    {ownerProfile?.username || '[recipes] user'}
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
                    className="p-2 bg-transparent border-none shadow-none outline-none hover:opacity-80 transition-opacity flex items-center"
                    aria-label="Edit recipe"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M4 13.5V16h2.5l7.06-7.06-2.5-2.5L4 13.5z"/><path d="M14.06 6.94a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0l-1.06 1.06 4 4 1.06-1.06z"/></svg>
                  </Link>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-2 bg-transparent border-none shadow-none outline-none text-red-500 hover:opacity-80 transition-opacity flex items-center"
                    aria-label="Delete recipe"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M6 6v8m4-8v8m4-8v8M3 6h14M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
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
                      {recipeType === 'spoonacular' ? stripHtmlTags(cleanStepPrefix(instruction)) : cleanStepPrefix(instruction)}
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-4">
                  {splitInstructions(recipe.instructions).map((step, idx) => (
                    <li key={idx} className="">
                      {recipeType === 'spoonacular' ? stripHtmlTags(step) : step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <StarButton
              recipeId={recipe.id.toString()}
              recipeType={recipeType}
              isStarred={false}
              onToggle={(isStarred) => {
                // Handle star toggle
                console.log('Star toggled:', isStarred);
              }}
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

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const { id } = params as { id: string };

  try {
    // Check if it's a valid UUID
    if (!isValidRecipeId(id)) {
      return {
        notFound: true,
      };
    }

    // Get the host from the request headers
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // First try to fetch from our database
    const supabase = getSupabaseClient();
    const { data: recipe, error: dbError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (recipe) {
      // If we found the recipe in our database, return it
      return {
        props: {
          recipe,
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    // If not found in database, try the API endpoint
    const response = await fetch(`${baseUrl}/api/recipes/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          notFound: true,
        };
      }
      throw new Error('Failed to fetch recipe');
    }

    const recipeData = await response.json();

    return {
      props: {
        recipe: recipeData,
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