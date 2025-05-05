import { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { searchRecipes, type Recipe, getPopularRecipes } from "@/lib/spoonacular";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface SearchFilters {
  diet: string;
  cuisine: string;
  maxReadyTime: number;
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    diet: "",
    cuisine: "",
    maxReadyTime: 0
  });

  useEffect(() => {
    const fetchAllRecipes = async () => {
      try {
        // Fetch from Supabase
        const { data: supabaseRecipes, error: supabaseError } = await supabase
          .from('recipes')
          .select('*')
          .order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;

        // Transform Supabase recipes to match Recipe interface
        const transformedRecipes = supabaseRecipes.map(recipe => ({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image_url,
          instructions: recipe.instructions.join('\n'),
          extendedIngredients: recipe.ingredients.map((ing: string) => ({
            id: Math.random(),
            original: ing,
            amount: 0,
            unit: ''
          })),
          dateAdded: recipe.created_at
        }));

        // Fetch from Spoonacular
        const spoonacularRecipes = await getPopularRecipes();

        // Combine and sort by date
        const allRecipes = [...transformedRecipes, ...spoonacularRecipes]
          .sort((a, b) => new Date(b.dateAdded || '').getTime() - new Date(a.dateAdded || '').getTime());

        setRecipes(allRecipes);
      } catch (err) {
        console.error("Failed to fetch recipes:", err);
        setError("Failed to load recipes");
      }
    };

    fetchAllRecipes();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const results = await searchRecipes(query, {
        diet: filters.diet,
        cuisine: filters.cuisine,
        maxReadyTime: filters.maxReadyTime
      });
      setRecipes(results);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search recipes");
      setRecipes([]);
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
                onClick={() => router.push(`/recipe/${recipe.id}`)}
                className="border border-gray-200 dark:border-gray-800 p-4 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="relative w-full h-48 mb-4">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="font-mono text-lg mb-2">{recipe.title}</h2>
                <div className="flex justify-between items-center">
                  {recipe.readyInMinutes && (
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      {recipe.readyInMinutes} mins
                    </p>
                  )}
                  <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                    {new Date(recipe.dateAdded || Date.now()).toLocaleDateString()}
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