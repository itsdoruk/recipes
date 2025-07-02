import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useAuth } from '@/lib/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { cleanStepPrefix } from '@/lib/recipeUtils';
import RecipeCard from '@/components/RecipeCard';
import { getAIRecipes } from '@/lib/recipeUtils';

type AIRecipe = {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  image_url: string;
  cooking_time: string;
  user_id: string;
  cuisine_type?: string;
  diet_type?: string;
  cooking_time_value?: number;
  created_at?: string;
};

// Add robust filtering helpers
function normalize(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim();
}

function parseCookingTime(cooking_time: string | null | undefined): number | null {
  if (!cooking_time) return null;
  const minMatch = cooking_time.match(/(\d+)\s*mins?/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  const hourMatch = cooking_time.match(/(\d+)\s*hours?/i);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60;
  return null;
}

interface RecipeFilter {
  cuisine?: string;
  diet?: string;
  maxReadyTime?: number;
}

interface AIRecipeType {
  cuisine_type?: string | null;
  diet_type?: string | null;
  cooking_time?: string | null;
  cooking_time_value?: number | null;
  [key: string]: any;
}

function filterRecipe(recipe: AIRecipeType, filters: RecipeFilter): boolean {
  if (filters.cuisine && normalize(recipe.cuisine_type) !== normalize(filters.cuisine)) {
    return false;
  }
  if (filters.diet && normalize(recipe.diet_type) !== normalize(filters.diet)) {
    return false;
  }
  if (filters.maxReadyTime && filters.maxReadyTime > 0) {
    const recipeTime = parseCookingTime(recipe.cooking_time) || recipe.cooking_time_value || null;
    if (!recipeTime || recipeTime > filters.maxReadyTime) {
      return false;
    }
  }
  return true;
}

const CUISINE_TYPES = [
  'italian', 'mexican', 'asian', 'american', 'mediterranean',
  'french', 'chinese', 'japanese', 'indian', 'thai', 'greek',
  'spanish', 'british', 'turkish', 'korean', 'vietnamese', 'german', 'caribbean', 'african', 'middle eastern', 'russian', 'brazilian', 'unknown'
];
const DIET_TYPES = [
  'vegetarian', 'vegan', 'gluten-free', 'ketogenic', 'paleo',
  'pescatarian', 'lacto-vegetarian', 'ovo-vegetarian', 'whole30', 'low-fodmap', 'dairy-free', 'nut-free', 'halal', 'kosher', 'unknown'
];
const COOKING_TIMES = [
  { label: '15 mins or less', value: 15 },
  { label: '30 mins or less', value: 30 },
  { label: '1 hour or less', value: 60 },
];

export default function AIRecipe() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RecipeFilter>({});
  const [aiRecipes, setAiRecipes] = useState<AIRecipe[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Handle recipe data from URL parameters
  useEffect(() => {
    if (router.isReady && router.query.id) {
      const recipeFromParams: AIRecipe = {
        id: router.query.id as string,
        title: router.query.title as string,
        description: router.query.description as string,
        image_url: router.query.image_url as string,
        user_id: router.query.user_id as string,
        created_at: router.query.created_at as string,
        cuisine_type: router.query.cuisine_type as string,
        diet_type: router.query.diet_type as string,
        cooking_time: router.query.cooking_time as string,
        cooking_time_value: router.query.cooking_time_value ? parseInt(router.query.cooking_time_value as string) : undefined,
        ingredients: (router.query.ingredients as string)?.split('|') || [],
        instructions: (router.query.instructions as string)?.split('|') || [],
      };
      setAiRecipes([recipeFromParams]); // Show only this recipe in the list
    }
  }, [router.isReady, router.query]);

  // Fetch AI recipes on mount, but only if no recipe is selected from URL
  useEffect(() => {
    if (!router.query.id) {
      const fetchRecipes = async () => {
        setAiLoading(true);
        setError(null);
        try {
          // First regenerate AI recipes to get fresh ones
          const regenRes = await fetch('/api/regen-ai-recipes', { method: 'POST' });
          if (!regenRes.ok) {
            const errData = await regenRes.json();
            throw new Error(errData.error || 'Failed to refresh AI recipes');
          }
          
          // Then fetch the fresh recipes
          const { recipes, error: fetchError } = await getAIRecipes();
          if (fetchError) {
            throw fetchError;
          }
          setAiRecipes(recipes);
        } catch (err) {
          console.error('Error fetching AI recipes:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch AI recipes');
        } finally {
          setAiLoading(false);
        }
      };
      fetchRecipes();
    }
  }, [router.query.id]);

  // Filtered recipes (ensure lowercase and fallback to 'unknown')
  // Also filter out recipes without images
  const filteredRecipes = aiRecipes
    .filter(r => r.image_url && r.image_url.trim() !== '')
    .filter(r => {
      const cuisine = (r.cuisine_type || 'unknown').toLowerCase();
      const diet = (r.diet_type || 'unknown').toLowerCase();
      const time = r.cooking_time_value || parseCookingTime(r.cooking_time) || 0;
      const filterCuisine = filters.cuisine ? filters.cuisine.toLowerCase() : undefined;
      const filterDiet = filters.diet ? filters.diet.toLowerCase() : undefined;
      const filterTime = filters.maxReadyTime;
      return (
        (!filterCuisine || cuisine === filterCuisine) &&
        (!filterDiet || diet === filterDiet) &&
        (!filterTime || (time > 0 && time <= filterTime))
      );
    });

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">loading...</div>;
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="p-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-2xl mb-4">AI Recipes</h1>
          <p className="mb-4">Please log in to view AI recipes.</p>
          <button
            onClick={() => router.push('/login?redirectTo=/ai-recipe')}
            className="h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
          >
            Log In
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="p-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h1 className="text-2xl mb-4">AI Recipes</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">Discover AI-generated recipes tailored to your preferences.</p>
        
        {error && (
          <div className="mb-4 p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* FILTER PILLS UI */}
        <div className="mb-8 pb-4 border-b border-outline">
          <div className="flex flex-wrap gap-2">
            {CUISINE_TYPES.map(type => (
              <button
                key={type}
                className={`px-3 py-1 rounded-full border ${filters.cuisine === type ? 'bg-gray-800 text-white' : 'bg-transparent'}`}
                onClick={() => setFilters(f => ({ ...f, cuisine: f.cuisine === type ? undefined : type }))}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {DIET_TYPES.map(type => (
              <button
                key={type}
                className={`px-3 py-1 rounded-full border ${filters.diet === type ? 'bg-gray-800 text-white' : 'bg-transparent'}`}
                onClick={() => setFilters(f => ({ ...f, diet: f.diet === type ? undefined : type }))}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {COOKING_TIMES.map(({ label, value }) => (
              <button
                key={value}
                className={`px-3 py-1 rounded-full border ${filters.maxReadyTime === value ? 'bg-gray-800 text-white' : 'bg-transparent'}`}
                onClick={() => setFilters(f => ({ ...f, maxReadyTime: f.maxReadyTime === value ? undefined : value }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* AI RECIPES LIST */}
        <div className="mt-8">
          {aiLoading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(3)].map((_, i) => <RecipeCard.Skeleton key={i} />)}
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">No AI recipes found for selected filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredRecipes.map(recipe => (
                <div key={recipe.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
                  <RecipeCard
                    id={recipe.id}
                    title={recipe.title}
                    description={recipe.description}
                    image_url={recipe.image_url}
                    created_at={recipe.created_at || new Date().toISOString()}
                    user_id={recipe.user_id}
                    cuisine_type={recipe.cuisine_type}
                    diet_type={recipe.diet_type}
                    cooking_time={recipe.cooking_time}
                    recipeType="ai"
                  />
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold mb-2">Ingredients</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="text-gray-600 dark:text-gray-300">{ing}</li>
                      ))}
                    </ul>
                    <h3 className="font-bold mt-4 mb-2">Instructions</h3>
                    <ol className="list-decimal list-inside text-sm space-y-2">
                      {recipe.instructions.map((step, i) => (
                        <li key={i} className="text-gray-600 dark:text-gray-300">{cleanStepPrefix(step)}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 