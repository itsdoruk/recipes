import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import { getRecipeById } from '@/lib/spoonacular';

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  description?: string;
  extendedIngredients: Array<{
    original: string;
  }>;
  analyzedInstructions: Array<{
    steps: Array<{
      step: string;
    }>;
  }>;
}

interface LocalRecipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  image_url?: string;
  user_id: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

type Recipe = SpoonacularRecipe | LocalRecipe;

export default function RecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSpoonacular, setIsSpoonacular] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchRecipe = async () => {
      try {
        console.log('Fetching recipe with ID:', id);
        
        // First try to fetch from our database
        const { data: localData, error: localError } = await supabase
          .from('recipes')
          .select(`
            *,
            profiles (
              username,
              avatar_url
            )
          `)
          .eq('id', id)
          .single();

        if (localData) {
          console.log('Found local recipe:', localData);
          setRecipe(localData as LocalRecipe);
          setIsSpoonacular(false);
          return;
        }

        // If not found in our database, try Spoonacular
        try {
          const spoonacularData = await getRecipeById(Number(id));
          console.log('Found Spoonacular recipe:', spoonacularData);
          setRecipe(spoonacularData as SpoonacularRecipe);
          setIsSpoonacular(true);
        } catch (spoonacularError) {
          console.error('Spoonacular error:', spoonacularError);
          throw new Error('Recipe not found in either database');
        }
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recipe');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  if (isLoading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono text-center">loading...</p>
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono text-center text-red-500">{error || 'Recipe not found'}</p>
      </main>
    );
  }

  const isLocalRecipe = 'user_id' in recipe;

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="font-mono text-2xl mb-2">{recipe.title}</h1>
            {isLocalRecipe && (
              <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                by{' '}
                <button
                  onClick={() => router.push(`/profile?id=${recipe.user_id}`)}
                  className="hover:underline"
                >
                  {recipe.profiles?.username || 'anonymous'}
                </button>
              </p>
            )}
          </div>

          {isLocalRecipe ? (
            recipe.image_url && (
              <div className="relative w-full h-64 border border-gray-200 dark:border-gray-800">
                <Image
                  src={recipe.image_url}
                  alt={recipe.title}
                  fill
                  className="object-cover"
                />
              </div>
            )
          ) : (
            <div className="relative w-full h-64 border border-gray-200 dark:border-gray-800">
              <Image
                src={recipe.image}
                alt={recipe.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {!isLocalRecipe && recipe.description && (
            <div>
              <h2 className="font-mono text-lg mb-2">description</h2>
              <p className="font-mono text-gray-500 dark:text-gray-400">
                {recipe.description}
              </p>
            </div>
          )}

          <div>
            <h2 className="font-mono text-lg mb-2">ingredients</h2>
            <ul className="list-none space-y-1">
              {isLocalRecipe ? (
                recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="font-mono">
                    • {ingredient}
                  </li>
                ))
              ) : (
                recipe.extendedIngredients.map((ingredient, index) => (
                  <li key={index} className="font-mono">
                    • {ingredient.original}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-lg mb-2">instructions</h2>
            <ol className="list-decimal list-inside space-y-2">
              {isLocalRecipe ? (
                recipe.instructions.map((instruction, index) => (
                  <li key={index} className="font-mono">
                    {instruction}
                  </li>
                ))
              ) : (
                recipe.analyzedInstructions[0]?.steps.map((step, index) => (
                  <li key={index} className="font-mono">
                    {step.step}
                  </li>
                ))
              )}
            </ol>
          </div>

          {isLocalRecipe && user?.id === recipe.user_id && (
            <div className="pt-4">
              <button
                onClick={() => router.push(`/edit/${recipe.id}`)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
              >
                edit recipe
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}