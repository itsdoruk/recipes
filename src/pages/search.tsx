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
          setError('Failed to search local recipes');
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
        setError('Failed to search recipes');
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

  return (
    <>
      <Head>
        <title>search: {query} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl mb-8">
          search results for "{query}"
        </h1>

        {isLoading ? (
          <p className="">searching...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : recipes.length === 0 ? (
          <p className="">no recipes found</p>
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