import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { getRecipeById } from '@/lib/spoonacular';
import { supabase } from '@/lib/supabase';
import { Comments } from '@/components/Comments';
import { GetServerSideProps } from 'next';
import { marked } from 'marked';
import StarButton from '@/components/StarButton';
import ReportButton from '@/components/ReportButton';

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

function hasUserId(recipe: any): recipe is { user_id: string } {
  return recipe && typeof recipe.user_id === 'string';
}

function hasId(recipe: any): recipe is { id: string | number } {
  return recipe && (typeof recipe.id === 'string' || typeof recipe.id === 'number');
}

function splitInstructions(instructions: string): string[] {
  // Split by period, semicolon, or newline, and trim whitespace
  return instructions
    .split(/\.|;|\n/)
    .map(step => step.trim())
    .filter(Boolean);
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
  recipe: Recipe;
  lastUpdated: string;
}

export default function RecipePage({ recipe, lastUpdated }: RecipePageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!recipe.id) return;
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch profile for user recipe
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('user_id', recipe.user_id)
          .single();
        setProfile(profileData);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [recipe.id]);

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

  if (isLoading) {
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

  const isOwner = user?.id && hasUserId(recipe) && user.id === (hasUserId(recipe) ? recipe.user_id : undefined);

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

      <main className="max-w-2xl mx-auto px-4 py-8 rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
            <div className="flex items-center justify-between">
              <h1 className="text-3xl">{recipe.title}</h1>
              <div className="flex items-center gap-2">
                <StarButton recipeId={recipe.id} recipeType="user" />
                <ReportButton 
                  recipeId={recipe.id} 
                  recipeType="user" 
                  onReportSubmitted={() => {
                    // Refresh the page to show updated reports
                    router.reload();
                  }} 
                />
              </div>
            </div>
            {profile && (
              <div className="flex items-center gap-2 mt-4">
                {profile.avatar_url && (
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
                  {profile.username || '[recipes] user'}
                </Link>
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
            )}
          </div>

          <div>
            <h2 className="text-xl mb-4">description</h2>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: recipe.description || recipe.summary || '' }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cuisine */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">cuisine</h3>
              <p className="">{recipe.cuisine_type || (recipe.cuisines && recipe.cuisines.length > 0 && recipe.cuisines.join(', ')) || 'N/A'}</p>
            </div>
            {/* Cooking Time */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">cooking time</h3>
              <p className="">{(recipe.cooking_time_value && recipe.cooking_time_unit) ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit}` : recipe.cooking_time || (recipe.readyInMinutes && recipe.readyInMinutes + ' mins') || 'N/A'}</p>
            </div>
            {/* Diet */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-gray-400">diet</h3>
              <p className="">{recipe.diet_type || (recipe.diets && recipe.diets.length > 0 && recipe.diets.join(', ')) || 'N/A'}</p>
            </div>
          </div>

          {/* Nutrition Section */}
          <div>
            <h2 className="text-xl mb-4 mt-8">nutrition</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Calories', key: 'calories' },
                { label: 'Protein', key: 'protein' },
                { label: 'Fat', key: 'fat' },
                { label: 'Carbohydrates', key: 'carbohydrates' }
              ].map(({ label, key }) => {
                let value = 'N/A';
                if (recipe[key as keyof typeof recipe]) {
                  const nutritionValue = recipe[key as keyof typeof recipe];
                  if (typeof nutritionValue === 'string' && nutritionValue !== 'unknown') {
                    value = nutritionValue;
                  } else if (typeof nutritionValue === 'number') {
                    value = nutritionValue.toString();
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
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!recipe) {
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
      notFound: true,
    };
  }
};