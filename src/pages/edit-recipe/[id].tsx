import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/hooks/useTranslation';

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

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
  ingredients: string[];
  instructions: string[];
}

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { t } = useTranslation();
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
        console.error(String('Error fetching recipe:'), err);
        setError(String('Failed to load recipe'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [id, user, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipe || !user) return;

    // Validate cooking time value is a number
    if (recipe.cooking_time && !/^\d+\s+(seconds|mins|days)$/.test(recipe.cooking_time)) {
      setError(String('Cooking time must be a number followed by a unit (seconds, mins, or days)'));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('recipes')
        .update({
          title: recipe.title,
          description: recipe.description,
          image_url: recipe.image_url,
          cuisine_type: recipe.cuisine_type || null,
          cooking_time: recipe.cooking_time || null,
          diet_type: recipe.diet_type || null,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipe.id)
        .eq('user_id', user.id);

      if (error) {
        console.error(String('Supabase update error:'), error);
        throw error;
      }

      router.push(`/recipe/${recipe.id}`);
    } catch (err) {
      console.error(String('Error updating recipe:'), err);
      setError(err instanceof Error ? err.message : String('Failed to update recipe'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">{String('loading...')}</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-red-500">{error || String('Recipe not found')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">{t('recipe.pleaseSignIn')}</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{t('recipe.editRecipe')} | {t('nav.recipes')}</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">{String('edit recipe')}</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="blockmb-2">
                {String('title')}
              </label>
              <input
                type="text"
                id="title"
                value={recipe.title}
                onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="blockmb-2">
                {String('description')}
              </label>
              <textarea
                id="description"
                value={recipe.description}
                onChange={(e) => setRecipe({ ...recipe, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparenth-32"
                required
              />
            </div>

            <div>
              <label htmlFor="image_url" className="blockmb-2">
                {String('image url')}
              </label>
              <input
                type="url"
                id="image_url"
                value={recipe.image_url || ''}
                onChange={(e) => setRecipe({ ...recipe, image_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
              />
            </div>

            <div>
              <label htmlFor="ingredients" className="blockmb-2">
                {String('ingredients (one per line)')}
              </label>
              <textarea
                id="ingredients"
                value={recipe.ingredients.join('\n')}
                onChange={(e) => setRecipe({ ...recipe, ingredients: e.target.value.split('\n').filter(i => i.trim()) })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparenth-32"
                required
                placeholder={String(`e.g. 2 eggs
1 cup flour
1/2 cup sugar`)}
              />
            </div>

            <div>
              <label htmlFor="instructions" className="blockmb-2">
                {String('instructions (one step per line)')}
              </label>
              <textarea
                id="instructions"
                value={recipe.instructions.join('\n')}
                onChange={(e) => setRecipe({ ...recipe, instructions: e.target.value.split('\n').filter(i => i.trim()) })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparenth-32"
                required
                placeholder={String(`e.g. Preheat oven to 350F
Mix flour and sugar
Add eggs and stir
Bake for 30 minutes`)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                id="cuisine_type"
                value={recipe.cuisine_type || ''}
                onChange={(e) => setRecipe({ ...recipe, cuisine_type: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
              >
                <option value="">{t('recipe.anyCuisine')}</option>
                {CUISINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`cuisine.${type}`)}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  id="cooking_time"
                  value={recipe.cooking_time || ''}
                  onChange={(e) => {
                    // Only allow numeric characters and spaces
                    const val = e.target.value.replace(/[^0-9\s]/g, '');
                    setRecipe({ ...recipe, cooking_time: val });
                  }}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent w-full"
                  min="0"
                  placeholder={t('recipe.cookingTime')}
                  inputMode="numeric"
                />
                <select
                  id="cooking_time_unit"
                  value={recipe.cooking_time?.split(' ')[1] || 'mins'}
                  onChange={(e) => {
                    const value = recipe.cooking_time?.split(' ')[0] || '';
                    setRecipe({ ...recipe, cooking_time: value ? `${value} ${e.target.value}` : null });
                  }}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
                >
                  <option value="seconds">{t('common.seconds')}</option>
                  <option value="mins">{t('common.minutes')}</option>
                  <option value="days">{t('common.days')}</option>
                </select>
              </div>

              <select
                id="diet_type"
                value={recipe.diet_type || ''}
                onChange={(e) => setRecipe({ ...recipe, diet_type: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
              >
                <option value="">{t('recipe.anyDiet')}</option>
                {DIET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`diet.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isSaving ? t('recipe.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
} 