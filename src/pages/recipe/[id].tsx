import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { getRecipeById } from '@/lib/spoonacular';
import { supabase } from '@/lib/supabase';
import { Comments } from '@/components/Comments';

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

export default function RecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchRecipe = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Check for random-internet recipe in localStorage
        if (typeof window !== 'undefined' && typeof id === 'string' && id.startsWith('random-internet-')) {
          const local = localStorage.getItem(id);
          if (local) {
            setRecipe(JSON.parse(local));
            setProfile(null);
            setIsLoading(false);
            return;
          } else {
            setError('Could not find this AI-improvised recipe.');
            setIsLoading(false);
            return;
          }
        }

        // First try to get recipe from Supabase
        const { data: supabaseRecipe, error: supabaseError } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', id)
          .single();

        if (supabaseRecipe) {
          setRecipe(supabaseRecipe);
          // Fetch profile for user recipe
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('user_id', supabaseRecipe.user_id)
            .single();
          setProfile(profileData);
          setIsLoading(false);
          return;
        }

        // If not found in Supabase, try Spoonacular
        const spoonacularRecipe = await getRecipeById(id as string);
        if (!spoonacularRecipe) {
          setError('Recipe not found. It may have been removed or is no longer available.');
          setIsLoading(false);
          return;
        }
        
        // Transform Spoonacular recipe data to match our format
        const transformedRecipe = {
          ...spoonacularRecipe,
          image_url: spoonacularRecipe.image,
          user_id: 'spoonacular',
          created_at: spoonacularRecipe.dateAdded,
          cuisine_type: spoonacularRecipe.cuisines?.[0] || null,
          cooking_time: spoonacularRecipe.readyInMinutes ? `${spoonacularRecipe.readyInMinutes} mins` : null,
          diet_type: spoonacularRecipe.diets?.[0] || null,
          ingredients: spoonacularRecipe.extendedIngredients?.map((ing: any) => ing.original) || [],
          instructions: spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map((step: any) => step.step) || [],
          nutrition: spoonacularRecipe.nutrition,
          servings: spoonacularRecipe.servings,
          sourceUrl: spoonacularRecipe.sourceUrl
        };
        
        setRecipe(transformedRecipe);
        setProfile(null);
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecipe();
  }, [id]);

  const handleDelete = async () => {
    if (!recipe || !user || recipe.user_id !== user.id) return;
    if (!confirm('are you sure you want to delete this recipe?')) return;
    setIsDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipe.id);
      if (deleteError) throw deleteError;
      router.push('/');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setError('Failed to delete recipe');
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
        <p className="text-red-500">{error || 'Recipe not found'}</p>
      </div>
    );
  }

  const isOwner = user?.id && hasUserId(recipe) && user.id === (hasUserId(recipe) ? recipe.user_id : undefined);

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {recipe.image_url || recipe.image ? (
            <div className="relative w-full h-96">
              <Image
                src={recipe.image_url || recipe.image}
                alt={recipe.title}
                fill
                className="object-cover"
              />
            </div>
          ) : null}

          <div>
            <h1 className="text-3xl">{recipe.title}</h1>
            {profile && (
              <div className="flex items-center gap-2 mt-4">
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || 'anonymous'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <Link
                  href={`/user/${recipe.user_id}`}
                  className="text-gray-500 dark:text-gray-400 hover:underline"
                >
                  {profile.username || 'anonymous'}
                </Link>
                <span className="text-gray-500 dark:text-gray-400">
                  • {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ''}
                </span>
                {isOwner && hasId(recipe) && (
                  <div className="flex gap-2 ml-auto">
                    <Link
                      href={`/edit-recipe/${recipe.id}`}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
                    >
                      edit
                    </Link>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-3 py-1 text-sm border rounded text-red-500 hover:bg-red-50 disabled:opacity-50"
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

          {/* Nutrition Section for both user and Spoonacular recipes */}
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
                  : recipe.extendedIngredients &&
                    recipe.extendedIngredients.map((ing: any, idx: number) => (
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