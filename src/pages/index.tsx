import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { GetServerSideProps } from "next";

interface SearchFilters {
  diet: string;
  cuisine: string;
  maxReadyTime: number;
}

interface HomeProps {
  initialRecipes: LocalRecipe[];
}

interface LocalRecipe {
  id: string;
  title: string;
  description: string;
  image_url: string;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
}

interface SpoonacularSearchResult {
  id: number;
  title: string;
  image: string;
  summary?: string;
  readyInMinutes?: number;
}

export default function Home({ initialRecipes }: HomeProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<LocalRecipe[]>(initialRecipes);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    diet: "",
    cuisine: "",
    maxReadyTime: 0
  });

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Build the query for local recipes
      let supabaseQuery = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      // Add search term filter if provided
      if (query) {
        supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      // Add cuisine type filter if provided
      if (filters.cuisine) {
        supabaseQuery = supabaseQuery.eq('cuisine_type', filters.cuisine);
      }

      // Add diet type filter if provided
      if (filters.diet) {
        supabaseQuery = supabaseQuery.eq('diet_type', filters.diet);
      }

      // Add cooking time filter if provided
      if (filters.maxReadyTime) {
        supabaseQuery = supabaseQuery.eq('cooking_time_value', filters.maxReadyTime);
      }

      // Execute the query
      const { data: localRecipes, error: localError } = await supabaseQuery;

      if (localError) throw localError;

      // Transform local recipes to match LocalRecipe interface
      const transformedLocalRecipes = localRecipes?.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        image_url: recipe.image_url,
        user_id: recipe.user_id,
        created_at: recipe.created_at,
        cuisine_type: recipe.cuisine_type,
        cooking_time: recipe.cooking_time_value ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit}` : null,
        diet_type: recipe.diet_type,
      })) || [];

      // Search Spoonacular if search term is provided
      let spoonacularRecipes: LocalRecipe[] = [];
      if (query) {
        try {
          const response = await fetch(
            `https://api.spoonacular.com/recipes/complexSearch?apiKey=${process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY}&query=${query}&addRecipeInformation=true&number=10`
          );
          const data = await response.json();
          spoonacularRecipes = data.results.map((recipe: SpoonacularSearchResult) => ({
            id: `spoonacular-${recipe.id}`,
            title: recipe.title,
            description: recipe.summary?.replace(/<[^>]*>/g, '') || '',
            image_url: recipe.image,
            user_id: 'spoonacular',
            created_at: new Date().toISOString(),
            cuisine_type: null, // Spoonacular doesn't provide this in the search results
            cooking_time: recipe.readyInMinutes ? `${recipe.readyInMinutes} mins` : null,
            diet_type: null, // Spoonacular doesn't provide this in the search results
          }));
        } catch (err) {
          console.error('Error fetching from Spoonacular:', err);
        }
      }

      // Combine and sort recipes
      const allRecipes = [...transformedLocalRecipes, ...spoonacularRecipes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecipes(allRecipes);
    } catch (err) {
      console.error('Error searching recipes:', err);
      setError('Failed to search recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <Head>
        <title>[recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">[recipes]</h1>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search recipes..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono disabled:opacity-50"
              >
                {isLoading ? "searching..." : "search"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={filters.diet}
                onChange={(e) => handleFilterChange("diet", e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any diet</option>
                <option value="vegetarian">vegetarian</option>
                <option value="vegan">vegan</option>
                <option value="gluten-free">gluten-free</option>
                <option value="ketogenic">ketogenic</option>
                <option value="paleo">paleo</option>
              </select>

              <select
                value={filters.cuisine}
                onChange={(e) => handleFilterChange("cuisine", e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any cuisine</option>
                <option value="italian">italian</option>
                <option value="mexican">mexican</option>
                <option value="asian">asian</option>
                <option value="american">american</option>
                <option value="mediterranean">mediterranean</option>
              </select>

              <select
                value={filters.maxReadyTime}
                onChange={(e) => handleFilterChange("maxReadyTime", Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="0">any time</option>
                <option value="15">15 mins or less</option>
                <option value="30">30 mins or less</option>
                <option value="45">45 mins or less</option>
                <option value="60">1 hour or less</option>
              </select>
            </div>
          </form>

          {error && (
            <p className="font-mono text-red-500">{error}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="border border-gray-200 dark:border-gray-800 p-4 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => router.push(`/recipe/${recipe.id}`)}
              >
                <div className="relative w-full h-48 mb-4">
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="font-mono text-lg mb-2">{recipe.title}</h2>
                <div className="flex justify-between items-center">
                  {recipe.cooking_time && (
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      {recipe.cooking_time}
                    </p>
                  )}
                  <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                    {new Date(recipe.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Fetch recipes from Supabase
    const { data: supabaseRecipes, error: supabaseError } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (supabaseError) throw supabaseError;

    // Transform Supabase recipes to match LocalRecipe interface
    const transformedRecipes = supabaseRecipes.map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image_url: recipe.image_url,
      user_id: recipe.user_id,
      created_at: recipe.created_at,
      cuisine_type: recipe.cuisine_type,
      cooking_time: recipe.cooking_time_value ? `${recipe.cooking_time_value} ${recipe.cooking_time_unit}` : null,
      diet_type: recipe.diet_type,
    }));

    return {
      props: {
        initialRecipes: transformedRecipes,
      },
    };
  } catch (error) {
    console.error('Error fetching initial recipes:', error);
    return {
      props: {
        initialRecipes: [],
      },
    };
  }
};