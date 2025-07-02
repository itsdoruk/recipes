import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Image from 'next/image';
import Link from 'next/link';
import { getRecipeById } from '../../lib/spoonacular';
import { getServerClient } from '../../lib/supabase/serverClient';
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
import { useAuth } from '@/lib/hooks/useAuth';
import { useUser } from '@/lib/hooks/useUser';
import { useStarredRecipes } from '@/hooks/useStarredRecipes';
import RecipeCard from '@/components/RecipeCard';
import { formatDistanceToNow } from 'date-fns';
import RecipePageSkeleton from '@/components/RecipePageSkeleton';
import Avatar from '@/components/Avatar';
import { MdEdit, MdDelete } from 'react-icons/md';

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
  recipe_type: string;
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
  const { user, isAuthenticated } = useAuth();
  const supabase = useSupabaseClient();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const recipeUser = useUser();
  const { starredRecipes, toggleStar } = useStarredRecipes();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(serverError || null);
  const [isStarred, setIsStarred] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recipeType, setRecipeType] = useState<'user' | 'ai' | 'spoonacular'>(
    recipe?.recipe_type === 'ai' ? 'ai' : recipe?.recipe_type === 'spoonacular' ? 'spoonacular' : 'user'
  );
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [ownerProfileLoading, setOwnerProfileLoading] = useState(true);
  const [showNutrition, setShowNutrition] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }
      
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();
          
        if (!error && profileData?.is_admin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [user?.id, supabase]);

  const handleDelete = async () => {
    if (!recipe || !user) return;
    
    // Only allow deletion if user is owner or admin
    if (recipe.user_id !== user.id && !isAdmin) return;
    
    const confirmMessage = isAdmin && recipe.user_id !== user.id 
      ? 'Are you sure you want to delete this user\'s recipe as an admin?' 
      : 'Are you sure you want to delete this recipe?';
    
    if (!confirm(confirmMessage)) return;
    
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
      router.push('/home');
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowNutrition(localStorage.getItem('app_show_nutrition') !== 'false');
      const handler = () => setShowNutrition(localStorage.getItem('app_show_nutrition') !== 'false');
      window.addEventListener('nutrition-visibility-changed', handler);
      return () => window.removeEventListener('nutrition-visibility-changed', handler);
    }
  }, []);

  if (isProfileLoading || ownerProfileLoading) {
    return <RecipePageSkeleton />;
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
  const canDelete = isOwner || isAdmin;

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
                  <Avatar
                    avatar_url={null}
                    username="spoonacular"
                    size={32}
                    className="bg-gray-800 text-gray-200 dark:bg-gray-700 dark:text-gray-200 font-bold"
                  />
                  <span className="font-medium prose prose-invert">spoonacular</span>
                </>
              ) : recipeType === 'ai' || recipe.user_id === '00000000-0000-0000-0000-000000000000' ? (
                <span className="font-medium prose prose-invert">AI Recipe</span>
              ) : (
                <>
                  <Avatar
                    avatar_url={ownerProfile?.avatar_url}
                    username={ownerProfile?.username || '[recipes] user'}
                    size={32}
                    className="bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200 font-bold"
                  />
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
              {canDelete && hasId(recipe) && (
                <div className="flex gap-2 ml-auto">
                  <Link
                    href={`/edit-recipe/${recipe.id}`}
                    className="w-10 h-10 flex items-center justify-center bg-transparent text-yellow-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Edit recipe"
                    title="Edit recipe"
                  >
                    <MdEdit className="w-6 h-6" />
                  </Link>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-10 h-10 flex items-center justify-center bg-transparent text-red-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Delete recipe"
                    title={isAdmin && !isOwner ? "Delete recipe (admin)" : "Delete recipe"}
                  >
                    <MdDelete className="w-6 h-6" />
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

          {showNutrition && (
          <div>
            <h2 className="text-xl mb-4 mt-8">nutrition</h2>
              {(() => {
                // Bulletproof Spoonacular detection
                const recipeType = typeof recipe.recipe_type === 'string' ? recipe.recipe_type.trim().toLowerCase() : '';
                const hasSpoonacularId = typeof recipe.spoonacular_id === 'string' && recipe.spoonacular_id.length > 0;
                const isSpoonacularUser = typeof recipe.user_id === 'string' && recipe.user_id === 'spoonacular';
                const titleHasSpoonacular = typeof recipe.title === 'string' && recipe.title.toLowerCase().includes('spoonacular');
                const isSpoonacular = recipeType === 'spoonacular' || hasSpoonacularId || isSpoonacularUser || titleHasSpoonacular;
                if (typeof window !== 'undefined') {
                  console.log('[nutrition debug]', {
                    recipeType,
                    hasSpoonacularId,
                    isSpoonacularUser,
                    titleHasSpoonacular,
                    isSpoonacular,
                    nutrition: recipe.nutrition,
                    recipe
                  });
                }
                if (isSpoonacular) {
                  // Only show calories for Spoonacular recipes
                  let value = 'N/A';
                  if (recipe.nutrition && Array.isArray(recipe.nutrition.nutrients)) {
                    const nutrient = recipe.nutrition.nutrients.find(
                      (n: any) => n.name && typeof n.name === 'string' && n.name.toLowerCase() === 'calories'
                    );
                    if (nutrient && nutrient.amount !== null && nutrient.amount !== undefined && String(nutrient.amount).toLowerCase() !== 'n/a' && String(nutrient.amount).toLowerCase() !== 'unknown') {
                      value = `${Math.round(nutrient.amount)} ${nutrient.unit}`;
                    }
                  } else if (recipe.nutrition && typeof recipe.nutrition === 'object') {
                    const nutritionValue = recipe.nutrition['calories'];
                    if (nutritionValue && typeof nutritionValue === 'string' && nutritionValue !== 'unknown') {
                      value = nutritionValue;
                    }
                  } else if (recipe['calories']) {
                    const nutritionValue = recipe['calories'];
                    if (typeof nutritionValue === 'string' && nutritionValue !== 'unknown') {
                      value = nutritionValue;
                    } else if (typeof nutritionValue === 'number') {
                      value = nutritionValue.toString();
                    }
                  } else {
                    const fallback = extractNutritionFromText(recipe.summary || recipe.description || '');
                    if (fallback['calories'] && fallback['calories'] !== 'N/A') {
                      value = fallback['calories'] as string;
                    }
                  }
                  return (
                    <div className="grid grid-cols-1 gap-4">
                      <div key="calories" className="text-center">
                        <div className="text-lg font-bold">{value}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm">calories</div>
                      </div>
                    </div>
                  );
                }
                // Not a Spoonacular recipe: show full grid
                return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Calories', key: 'calories', spoonacularName: 'Calories' },
                { label: 'Protein', key: 'protein', spoonacularName: 'Protein' },
                { label: 'Fat', key: 'fat', spoonacularName: 'Fat' },
                { label: 'Carbohydrates', key: 'carbohydrates', spoonacularName: 'Carbohydrates' }
              ].map(({ label, key, spoonacularName }) => {
                let value = 'N/A';
                // 1. Try database nutrition format (for all recipe types)
                if (recipe.nutrition && typeof recipe.nutrition === 'object') {
                  const nutritionValue = recipe.nutrition[key as keyof typeof recipe.nutrition];
                  if (nutritionValue && typeof nutritionValue === 'string' && nutritionValue !== 'unknown') {
                    value = nutritionValue;
                  }
                }
                // 2. Try Spoonacular API nutrition format (fallback)
                else if (
                  recipe.nutrition &&
                  typeof recipe.nutrition === 'object' &&
                  Array.isArray((recipe.nutrition as any).nutrients)
                ) {
                        const nutrients = (recipe.nutrition as any).nutrients as { name: string; amount: number; unit: string }[];
                  const nutrient = nutrients.find(
                          (n) => n.name === spoonacularName
                  );
                  if (nutrient) {
                    value = `${Math.round(nutrient.amount)} ${nutrient.unit}`;
                  }
                }
                // 3. Try legacy nutrition fields (for backward compatibility)
                else if (recipe[key as keyof typeof recipe]) {
                  const nutritionValue = recipe[key as keyof typeof recipe];
                  if (typeof nutritionValue === 'string' && nutritionValue !== 'unknown') {
                    value = nutritionValue;
                  } else if (typeof nutritionValue === 'number') {
                    value = nutritionValue.toString();
                  }
                }
                // 4. Fallback: extract from summary or description
                else {
                  const fallback = extractNutritionFromText(recipe.summary || recipe.description || '');
                  if (fallback[key as keyof typeof fallback] && fallback[key as keyof typeof fallback] !== 'N/A') {
                          value = fallback[key as keyof typeof fallback] as string;
                  }
                }
                return (
                        <div key={key} className="text-center">
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm">{label.toLowerCase()}</div>
                  </div>
                );
              })}
            </div>
                );
              })()}
          </div>
          )}

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

          <div className="flex items-center gap-4 h-16 px-4 border-t border-outline bg-transparent">
            <StarButton
              recipeId={recipe.id.toString()}
              recipeType={recipeType}
            />
            {recipeType === 'user' && (
              <ReportButton
                recipeId={recipe.id.toString()}
                recipeType="user"
                className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity"
              />
            )}
            <ShareButton
              recipeId={recipe.id.toString()}
              recipeTitle={recipe.title}
              recipeType={recipeType}
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={recipe.title}
              text={recipe.description}
              className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity"
              iconOnly={true}
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
    console.log('[getServerSideProps] Fetching recipe with ID:', id);

    // Check if it's a valid UUID
    if (!isValidRecipeId(id)) {
      console.log('[getServerSideProps] Invalid recipe ID format:', id);
      return {
        notFound: true,
      };
    }

    // Get the host from the request headers
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // First try to fetch from our database
    const supabase = getServerClient();
    console.log('[getServerSideProps] Querying Supabase for recipe:', id);
    
    const { data: recipe, error: dbError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError) {
      console.error('[getServerSideProps] Database error:', dbError);
      // Don't return error immediately, try API fallback
    }

    if (recipe) {
      console.log('[getServerSideProps] Found recipe in database:', {
        id: recipe.id,
        title: recipe.title,
        recipe_type: recipe.recipe_type
      });
      return {
        props: {
          recipe,
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    console.log('[getServerSideProps] Recipe not found in database, trying API...');

    // If not found in database, try the API endpoint
    const response = await fetch(`${baseUrl}/api/recipes/${id}`);
    
    if (!response.ok) {
      console.log('[getServerSideProps] API returned status:', response.status);
      if (response.status === 404) {
        return {
          notFound: true,
        };
      }
      throw new Error('Failed to fetch recipe');
    }

    const recipeData = await response.json();
    console.log('[getServerSideProps] Found recipe via API:', {
      id: recipeData.id,
      title: recipeData.title,
      recipe_type: recipeData.recipe_type
    });

    return {
      props: {
        recipe: recipeData,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[getServerSideProps] Error fetching recipe:', error);
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