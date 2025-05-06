import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { searchRecipes } from '@/lib/spoonacular';
import RecipeCard from '@/components/RecipeCard';

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  description?: string;
}

interface LocalRecipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
}

type Recipe = SpoonacularRecipe | LocalRecipe;

export default function SearchPage() {
  const router = useRouter();
  const { q: query, cuisine, diet, time } = router.query;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      // Debug log
      console.log('Spoonacular API Key available:', !!process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY);

      try {
        // Search local recipes
        const { data: localRecipes, error: localError } = await supabase
          .from('recipes')
          .select('*')
          .ilike('title', `%${query}%`)
          .order('created_at', { ascending: false });

        if (localError) throw localError;

        let allRecipes = [...(localRecipes || [])];

        // Try to search Spoonacular recipes, but don't fail if it errors
        try {
          const spoonacularRecipes = await searchRecipes(query as string);
          if (spoonacularRecipes) {
            allRecipes = [...allRecipes, ...spoonacularRecipes];
          }
        } catch (spoonacularError) {
          console.error('Spoonacular search failed:', spoonacularError);
          // Continue with just local recipes
        }

        setRecipes(allRecipes);
      } catch (err) {
        console.error('Error searching recipes:', err);
        setError('Failed to search recipes');
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [query, cuisine, diet, time]);

  if (!query) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono">enter a search query</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>search: {query} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-mono text-2xl mb-8">
          search results for "{query}"
        </h1>

        {isLoading ? (
          <p className="font-mono">searching...</p>
        ) : error ? (
          <p className="font-mono text-red-500">{error}</p>
        ) : recipes.length === 0 ? (
          <p className="font-mono">no recipes found</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recipes.map((recipe) => (
              'user_id' in recipe ? (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  description={recipe.description}
                  image_url={recipe.image_url}
                  user_id={recipe.user_id}
                  created_at={recipe.created_at}
                />
              ) : (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id.toString()}
                  title={recipe.title}
                  description={recipe.description || ''}
                  image_url={recipe.image}
                  user_id="spoonacular"
                  created_at={new Date().toISOString()}
                />
              )
            ))}
          </div>
        )}
      </main>
    </>
  );
}