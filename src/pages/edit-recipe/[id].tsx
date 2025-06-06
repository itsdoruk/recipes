import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useUser } from '@supabase/auth-helpers-react';

const CUISINE_TYPES = [
  'italian',
  'mexican',
  'asian',
  'american',
  'mediterranean',
  'french',
  'chinese',
  'japanese',
  'indian',
  'thai',
  'greek',
  'spanish',
  'british',
  'turkish',
  'korean',
  'vietnamese',
  'german',
  'caribbean',
  'african',
  'middle eastern',
  'russian',
  'brazilian'
];

const DIET_TYPES = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'ketogenic',
  'paleo',
  'pescetarian',
  'primal',
  'whole30',
  'dairy-free',
  'low-carb',
  'low-fat',
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
  calories: string;
  protein: string;
  fat: string;
  carbohydrates: string;
  cooking_time_value?: number;
  cooking_time_unit?: string;
}

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
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

        if (error) {
          console.error('Error fetching recipe:', error);
          
          // Check if it's a "not found" error
          if (error.code === 'PGRST116') {
            setError(`Recipe with ID ${id} not found. It may have been deleted or you may have an incorrect link.`);
            setIsLoading(false);
            return;
          }
          
          throw error;
        }

        if (!data) {
          setError('Recipe not found');
          setIsLoading(false);
          return;
        }

        if (data.user_id !== user.id) {
          router.push('/');
          return;
        }

        setRecipe(data);
      } catch (err) {
        console.error(String('Error fetching recipe:'), err);
        setError(String('failed to load recipe'));
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
      // Validate cooking time format
      if (recipe.cooking_time) {
        const match = recipe.cooking_time.match(/^(\d+)\s+(seconds|mins|days)$/);
        if (!match) {
          setError('cooking time must be a number followed by a unit (seconds, mins, or days)');
          setIsSaving(false);
          return;
        }
        const value = parseInt(match[1]);
        if (isNaN(value) || value <= 0) {
          setError('cooking time must be a positive number');
          setIsSaving(false);
          return;
        }
      }

      // Handle cooking time
      let cookingTime = null;
      let cookingTimeValue = null;
      let cookingTimeUnit = null;

      if (recipe.cooking_time) {
        const match = recipe.cooking_time.match(/^(\d+)\s+(seconds|mins|days)$/);
        if (match) {
          cookingTime = recipe.cooking_time;
          cookingTimeValue = parseInt(match[1]);
          cookingTimeUnit = match[2];
        }
      }

      // Handle nutrition values
      const nutritionValues = {
        calories: typeof recipe.calories === 'string' ? 
                 (recipe.calories.trim() === 'unknown' ? null : parseInt(recipe.calories.trim())) : 
                 recipe.calories || null,
        protein: typeof recipe.protein === 'string' ? 
                (recipe.protein.trim() === 'unknown' ? null : parseInt(recipe.protein.trim())) : 
                recipe.protein || null,
        fat: typeof recipe.fat === 'string' ? 
            (recipe.fat.trim() === 'unknown' ? null : parseInt(recipe.fat.trim())) : 
            recipe.fat || null,
        carbohydrates: typeof recipe.carbohydrates === 'string' ? 
                      (recipe.carbohydrates.trim() === 'unknown' ? null : parseInt(recipe.carbohydrates.trim())) : 
                      recipe.carbohydrates || null
      };

      const updateData = {
        title: recipe.title,
        description: recipe.description,
        image_url: recipe.image_url,
        cuisine_type: recipe.cuisine_type || null,
        cooking_time: cookingTime,
        cooking_time_value: cookingTimeValue,
        cooking_time_unit: cookingTimeUnit,
        diet_type: recipe.diet_type || null,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        calories: nutritionValues.calories,
        protein: nutritionValues.protein,
        fat: nutritionValues.fat,
        carbohydrates: nutritionValues.carbohydrates
      };

      const { error } = await supabase
        .from('recipes')
        .update(updateData)
        .eq('id', recipe.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      router.push(`/recipe/${recipe.id}`);
    } catch (err) {
      console.error('Error updating recipe:', err);
      setError(err instanceof Error ? err.message : 'failed to update recipe');
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
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <p className="text-red-500">{error || 'recipe not found'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">{String('Please sign in')}</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>edit recipe | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl">edit recipe</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                  recipe name
                </label>
                <input
                  type="text"
                  id="title"
                  value={recipe.title}
                  onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                  required
                  placeholder="enter recipe name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                  recipe description
                </label>
                <textarea
                  id="description"
                  value={recipe.description}
                  onChange={(e) => setRecipe({ ...recipe, description: e.target.value })}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                  rows={4}
                  required
                  placeholder="describe your recipe"
                />
              </div>

              <div>
                <label htmlFor="image_url" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                  image url
                </label>
                <input
                  type="url"
                  id="image_url"
                  value={recipe.image_url || ''}
                  onChange={(e) => setRecipe({ ...recipe, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                  placeholder="paste image url"
                />
              </div>

              <div>
                <label htmlFor="ingredients" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                  ingredients
                </label>
                <textarea
                  id="ingredients"
                  value={recipe.ingredients.join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    setRecipe({ ...recipe, ingredients: lines });
                  }}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                  rows={4}
                  required
                  placeholder="list ingredients (one per line)"
                />
              </div>

              <div>
                <label htmlFor="instructions" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                  instructions
                </label>
                <textarea
                  id="instructions"
                  value={recipe.instructions.join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    setRecipe({ ...recipe, instructions: lines });
                  }}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                  rows={4}
                  required
                  placeholder="list steps (one per line)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  id="cuisine_type"
                  value={recipe.cuisine_type || ''}
                  onChange={(e) => setRecipe({ ...recipe, cuisine_type: e.target.value })}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                >
                  <option value="">select cuisine</option>
                  {CUISINE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    id="cooking_time"
                    value={recipe.cooking_time?.split(' ')[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      const unit = recipe.cooking_time?.split(' ')[1] || 'mins';
                      if (val) {
                        setRecipe({ ...recipe, cooking_time: `${val} ${unit}` });
                      } else {
                        setRecipe({ ...recipe, cooking_time: '' });
                      }
                    }}
                    className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                    min="0"
                    placeholder="cooking time"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <select
                    id="cooking_time_unit"
                    value={recipe.cooking_time?.split(' ')[1] || 'mins'}
                    onChange={(e) => {
                      const value = recipe.cooking_time?.split(' ')[0] || '';
                      if (value) {
                        setRecipe({ ...recipe, cooking_time: `${value} ${e.target.value}` });
                      }
                    }}
                    className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                  >
                    <option value="seconds">seconds</option>
                    <option value="mins">minutes</option>
                    <option value="days">days</option>
                  </select>
                </div>

                <select
                  id="diet_type"
                  value={recipe.diet_type || ''}
                  onChange={(e) => setRecipe({ ...recipe, diet_type: e.target.value })}
                  className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                >
                  <option value="">select diet</option>
                  {DIET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="calories" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                    calories
                  </label>
                  <input
                    type="text"
                    id="calories"
                    value={recipe.calories === null || recipe.calories === 'unknown' ? '' : recipe.calories}
                    onChange={(e) => setRecipe({ ...recipe, calories: e.target.value || 'unknown' })}
                    className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                    placeholder="e.g. 400"
                  />
                </div>
                <div>
                  <label htmlFor="protein" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                    protein (g)
                  </label>
                  <input
                    type="text"
                    id="protein"
                    value={recipe.protein === null || recipe.protein === 'unknown' ? '' : recipe.protein}
                    onChange={(e) => setRecipe({ ...recipe, protein: e.target.value || 'unknown' })}
                    className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                    placeholder="e.g. 30"
                  />
                </div>
                <div>
                  <label htmlFor="fat" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                    fat (g)
                  </label>
                  <input
                    type="text"
                    id="fat"
                    value={recipe.fat === null || recipe.fat === 'unknown' ? '' : recipe.fat}
                    onChange={(e) => setRecipe({ ...recipe, fat: e.target.value || 'unknown' })}
                    className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                    placeholder="e.g. 10"
                  />
                </div>
                <div>
                  <label htmlFor="carbohydrates" className="block text-sm text-gray-500 dark:text-gray-400 mb-2 rounded-xl">
                    carbs (g)
                  </label>
                  <input
                    type="text"
                    id="carbohydrates"
                    value={recipe.carbohydrates === null || recipe.carbohydrates === 'unknown' ? '' : recipe.carbohydrates}
                    onChange={(e) => setRecipe({ ...recipe, carbohydrates: e.target.value || 'unknown' })}
                    className="w-full px-3 py-2 border border-outline bg-transparent font-normal text-base leading-normal rounded-xl"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity disabled:opacity-50 rounded-xl"
                >
                  {isSaving ? 'saving...' : 'save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
} 