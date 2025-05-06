import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { getRecipeById } from '@/lib/spoonacular';
import { supabase } from '@/lib/supabase';

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
    fetchRecipe();
    // eslint-disable-next-line
  }, [id]);

  const fetchRecipe = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const recipeData = await getRecipeById(id as string);
      if (!recipeData) throw new Error('Recipe not found');
      setRecipe(recipeData);

      // Only fetch profile if this is a user recipe (has user_id)
      if (recipeData.user_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('user_id', recipeData.user_id)
          .single();
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching recipe:', err);
      setError('Failed to load recipe');
    } finally {
      setIsLoading(false);
    }
  };

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
        <p className="font-mono">loading...</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono text-red-500">{error || 'Recipe not found'}</p>
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
            <h1 className="font-mono text-3xl">{recipe.title}</h1>
            {profile && (
              <div className="flex items-center gap-2 mt-4">
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || 'anonymous'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                {profile && hasUserId(recipe) && (
                  <Link
                    href={`/user/${hasUserId(recipe) ? recipe.user_id : ''}`}
                    className="font-mono text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    {profile.username || 'anonymous'}
                  </Link>
                )}
                <span className="font-mono text-gray-500 dark:text-gray-400">
                  • {recipe.dateAdded ? new Date(recipe.dateAdded).toLocaleDateString() : ''}
                </span>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">description</h2>
            <div className="font-mono prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: recipe.description || recipe.summary || '' }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cuisine */}
            {(recipe.cuisine_type || (recipe.cuisines && recipe.cuisines.length > 0)) && (
              <div>
                <h3 className="font-mono text-sm text-gray-500 dark:text-gray-400">cuisine</h3>
                <p className="font-mono">{recipe.cuisine_type || (recipe.cuisines && recipe.cuisines.join(', '))}</p>
              </div>
            )}
            {/* Cooking Time */}
            {(recipe.cooking_time || recipe.readyInMinutes) && (
              <div>
                <h3 className="font-mono text-sm text-gray-500 dark:text-gray-400">cooking time</h3>
                <p className="font-mono">{recipe.cooking_time || (recipe.readyInMinutes + ' mins')}</p>
              </div>
            )}
            {/* Diet */}
            {(recipe.diet_type || (recipe.diets && recipe.diets.length > 0)) && (
              <div>
                <h3 className="font-mono text-sm text-gray-500 dark:text-gray-400">diet</h3>
                <p className="font-mono">{recipe.diet_type || (recipe.diets && recipe.diets.join(', '))}</p>
              </div>
            )}
          </div>

          {/* Nutrition Section for Spoonacular recipes */}
          {recipe.nutrition && Array.isArray(recipe.nutrition.nutrients) && (
            <div>
              <h2 className="font-mono text-xl mb-4 mt-8">nutrition</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Calories', 'Protein', 'Fat', 'Carbohydrates'].map((nutrient) => {
                  const n = recipe.nutrition.nutrients.find((x: any) => x.name === nutrient);
                  return n ? (
                    <div key={nutrient} className="font-mono text-center">
                      <div className="text-lg font-bold">{n.amount} {n.unit}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-sm">{nutrient.toLowerCase()}</div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {recipe.ingredients && (
            <div>
              <h2 className="font-mono text-xl mb-4">ingredients</h2>
              <ul className="list-disc list-inside space-y-2">
                {Array.isArray(recipe.ingredients)
                  ? recipe.ingredients.map((ingredient: string, index: number) => (
                      <li key={index} className="font-mono">
                        {ingredient}
                      </li>
                    ))
                  : recipe.extendedIngredients &&
                    recipe.extendedIngredients.map((ing: any, idx: number) => (
                      <li key={idx} className="font-mono">
                        {ing.original}
                      </li>
                    ))}
              </ul>
            </div>
          )}

          {recipe.instructions && (
            <div>
              <h2 className="font-mono text-xl mb-4">instructions</h2>
              {Array.isArray(recipe.instructions) ? (
                <ol className="list-decimal list-inside space-y-4">
                  {recipe.instructions.map((instruction: string, index: number) => (
                    <li key={index} className="font-mono">
                      {instruction}
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-4">
                  {splitInstructions(recipe.instructions).map((step, idx) => (
                    <li key={idx} className="font-mono">{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mb-4">
            {profile && hasUserId(recipe) && (
              <Link
                href={`/user/${hasUserId(recipe) ? recipe.user_id : ''}`}
                className="font-mono hover:underline"
              >
                {profile.username || 'anonymous'}
              </Link>
            )}
            {isOwner && hasId(recipe) && (
              <div className="flex gap-2">
                <Link
                  href={`/edit-recipe/${hasId(recipe) ? recipe.id : ''}`}
                  className="px-3 py-1 text-sm border rounded font-mono hover:bg-gray-100"
                >
                  edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 text-sm border rounded font-mono text-red-500 hover:bg-red-50"
                >
                  delete
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}