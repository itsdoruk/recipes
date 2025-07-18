import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { searchRecipes } from '@/lib/spoonacular';
import RecipeCard from '@/components/RecipeCard';
import useSWR from 'swr';
import SearchSkeleton from '@/components/SearchSkeleton';

interface SpoonacularRecipe {
  id: number;
  title: string;
  summary: string;
  image: string;
  readyInMinutes: number;
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

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('failed to fetch data');
  return res.json();
};

// Helper to check for UUID
function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export default function SearchPage() {
  const router = useRouter();
  const { q: query, cuisine, diet, time } = router.query;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const supabase = getBrowserClient();

  // Use SWR for caching search results
  const { data: searchResults, error: searchError } = useSWR(
    query ? `/api/search?q=${query}&cuisine=${cuisine}&diet=${diet}&time=${time}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  useEffect(() => {
    if (!query) return;

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        // Search local recipes with expanded search criteria
        const supabaseQuery = supabase
          .from('recipes')
          .select('*')
          .or(
            `title.ilike.%${query}%,` +
            `description.ilike.%${query}%,` +
            `ingredients.cs.{${query}},` +
            `instructions.cs.{${query}}`
          )
          .order('created_at', { ascending: false });

        // Apply filters to local recipes
        if (cuisine) {
          supabaseQuery.eq('cuisine_type', cuisine);
        }
        if (diet) {
          supabaseQuery.eq('diet_type', diet);
        }
        if (time) {
          supabaseQuery.lte('cooking_time_value', time);
        }

        const { data: localRecipes, error: localError } = await supabaseQuery;

        if (localError) {
          console.error('Error searching local recipes:', localError);
          setError('failed to search local recipes');
          setRecipes([]);
          return;
        }

        let allRecipes = [...(localRecipes || [])];

        // Try to search Spoonacular recipes with filters
        try {
          const spoonacularRecipes = await searchRecipes(query as string, {
            cuisine: cuisine as string,
            diet: diet as string,
            maxReadyTime: time ? parseInt(time as string) : undefined,
          });
          
          if (spoonacularRecipes && spoonacularRecipes.length > 0) {
            allRecipes = [...allRecipes, ...spoonacularRecipes];
          }
        } catch (spoonacularError) {
          console.error('Spoonacular search failed:', spoonacularError);
          // Continue with just local recipes
        }

        // Sort combined results by date (newest first)
        allRecipes.sort((a, b) => {
          const dateA = 'created_at' in a ? new Date(a.created_at) : new Date();
          const dateB = 'created_at' in b ? new Date(b.created_at) : new Date();
          return dateB.getTime() - dateA.getTime();
        });

        setRecipes(allRecipes);
      } catch (err) {
        console.error('Error searching recipes:', err);
        setError('failed to search recipes');
        setRecipes([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [query, cuisine, diet, time]);

  if (!query) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">enter a search query</p>
      </div>
    );
  }

  if (isLoading) {
    return <SearchSkeleton />;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4">
          <p className="text-red-500">{error}</p>
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

  if (hasSearched && recipes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">no recipes found for "{query}"</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>search: {query} | [recipes]</title>
        <meta name="description" content={`Search results for ${query}`} />
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl mb-8">
          search results for "{query}"
        </h1>

        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((recipe) => {
            // AI recipes
            if ('user_id' in recipe && recipe.user_id === '00000000-0000-0000-0000-000000000000' && isUUID(recipe.id)) {
              return (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  description={recipe.description}
                  image_url={recipe.image_url}
                  user_id={recipe.user_id}
                  created_at={recipe.created_at}
                  cuisine_type={recipe.cuisine_type}
                  cooking_time={recipe.cooking_time}
                  diet_type={recipe.diet_type}
                  recipeType="ai"
                />
              );
            }
            // Spoonacular recipes
            if ('readyInMinutes' in recipe) {
              return (
                <RecipeCard
                  key={`spoonacular-${recipe.id}`}
                  id={`spoonacular-${recipe.id}`}
                  title={recipe.title}
                  description={recipe.summary}
                  image_url={recipe.image}
                  user_id="spoonacular"
                  created_at={new Date().toISOString()}
                  cuisine_type={null}
                  cooking_time={recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null}
                  diet_type={null}
                  recipeType="spoonacular"
                />
              );
            }
            // User recipes (valid UUID)
            if ('user_id' in recipe && isUUID(recipe.id)) {
              return (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  description={recipe.description}
                  image_url={recipe.image_url}
                  user_id={recipe.user_id}
                  created_at={recipe.created_at}
                  cuisine_type={recipe.cuisine_type}
                  cooking_time={recipe.cooking_time}
                  diet_type={recipe.diet_type}
                  recipeType="user"
                />
              );
            }
            // Fallback: skip rendering for unknown types
            return null;
          })}
        </div>
      </main>
    </>
  );
}