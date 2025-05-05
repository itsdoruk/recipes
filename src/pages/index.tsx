import { useState } from "react";
import Image from "next/image";
import { searchRecipes, type Recipe } from "@/lib/spoonacular";
import { useRouter } from "next/router";

export default function Home() {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const results = await searchRecipes(query);
      setRecipes(results);
    } catch (error) {
      console.error("Failed to fetch recipes:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch recipes");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="font-mono text-2xl mb-4">find recipes</h1>
      </div>

      <form onSubmit={handleSearch} className="mb-12">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="type here..."
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-gray-200 dark:border-gray-800 disabled:opacity-50"
          >
            {loading ? "..." : "go"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-8 p-4 border border-red-200 dark:border-red-800 text-sm">
          <p className="font-mono">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="p-4 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer"
            onClick={() => router.push(`/recipe/${recipe.id}`)}
          >
            <h3 className="font-mono text-lg">{recipe.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
              {recipe.description}
            </p>
          </div>
        ))}
      </div>

      {recipes.length === 0 && !loading && !error && (
        <p className="text-center text-sm opacity-60 mt-12">
          type something to search
        </p>
      )}
    </main>
  );
}