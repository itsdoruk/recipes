import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const CUISINE_TYPES = [
  'italian',
  'mexican',
  'asian',
  'american',
  'mediterranean',
];

const DIET_TYPES = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'ketogenic',
  'paleo',
];

const COOKING_TIMES = [
  { label: '15 mins or less', value: '15' },
  { label: '30 mins or less', value: '30' },
  { label: '45 mins or less', value: '45' },
  { label: '1 hour or less', value: '60' },
];

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
}

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id || !user) return;

    const fetchRecipe = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data.user_id !== user.id) {
          router.push('/');
          return;
        }

        setRecipe(data);
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [id, user, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipe || !user) return;

    setIsSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('recipes')
        .update({
          title: recipe.title,
          description: recipe.description,
          image_url: recipe.image_url,
          cuisine_type: recipe.cuisine_type,
          cooking_time: recipe.cooking_time,
          diet_type: recipe.diet_type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipe.id)
        .eq('user_id', user.id);

      if (error) throw error;

      router.push(`/recipe/${recipe.id}`);
    } catch (err) {
      console.error('Error updating recipe:', err);
      setError('Failed to update recipe');
    } finally {
      setIsSaving(false);
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

  return (
    <>
      <Head>
        <title>edit recipe | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">edit recipe</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block font-mono mb-2">
                title
              </label>
              <input
                type="text"
                id="title"
                value={recipe.title}
                onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block font-mono mb-2">
                description
              </label>
              <textarea
                id="description"
                value={recipe.description}
                onChange={(e) => setRecipe({ ...recipe, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono h-32"
                required
              />
            </div>

            <div>
              <label htmlFor="image_url" className="block font-mono mb-2">
                image url
              </label>
              <input
                type="url"
                id="image_url"
                value={recipe.image_url || ''}
                onChange={(e) => setRecipe({ ...recipe, image_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                id="cuisine_type"
                value={recipe.cuisine_type || ''}
                onChange={(e) => setRecipe({ ...recipe, cuisine_type: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any cuisine</option>
                {CUISINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                id="cooking_time"
                value={recipe.cooking_time || ''}
                onChange={(e) => setRecipe({ ...recipe, cooking_time: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any time</option>
                {COOKING_TIMES.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>

              <select
                id="diet_type"
                value={recipe.diet_type || ''}
                onChange={(e) => setRecipe({ ...recipe, diet_type: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
              >
                <option value="">any diet</option>
                {DIET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="font-mono text-red-500">{error}</p>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono disabled:opacity-50"
              >
                {isSaving ? 'saving...' : 'save changes'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
              >
                cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
} 