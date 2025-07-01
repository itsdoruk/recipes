import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useUser } from '@supabase/auth-helpers-react';
import FormSkeleton from '@/components/FormSkeleton';

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
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return <FormSkeleton />;
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

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-3xl mb-8 lowercase">edit recipe</h1>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Image Upload */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">image</label>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                    disabled={isSaving}
                  >
                    upload image
                  </button>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                    placeholder="or paste image url"
                    disabled={isSaving}
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {(imagePreview || imageUrl || recipe.image_url) && (
                  <div className="relative w-full h-48">
                    <img
                      src={imagePreview || imageUrl || recipe.image_url || ''}
                      alt="recipe preview"
                      className="object-cover rounded-xl w-full h-full"
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Title */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">title</label>
              <input
                type="text"
                value={recipe.title}
                onChange={e => setRecipe({ ...recipe, title: e.target.value })}
                className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                maxLength={100}
                required
                disabled={isSaving}
              />
            </div>
            {/* Description */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">description</label>
              <textarea
                value={recipe.description}
                onChange={e => setRecipe({ ...recipe, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                maxLength={2000}
                required
                disabled={isSaving}
              />
            </div>
            {/* Cuisine & Diet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">cuisine type</label>
                <select
                  value={recipe.cuisine_type || ''}
                  onChange={e => setRecipe({ ...recipe, cuisine_type: e.target.value })}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                >
                  <option value="">select cuisine</option>
                  {CUISINE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">diet type</label>
                <select
                  value={recipe.diet_type || ''}
                  onChange={e => setRecipe({ ...recipe, diet_type: e.target.value })}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                >
                  <option value="">select diet</option>
                  {DIET_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Cooking Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">cooking time</label>
                <input
                  type="number"
                  value={recipe.cooking_time?.split(' ')[0] || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const unit = recipe.cooking_time?.split(' ')[1] || 'mins';
                    if (val) {
                      setRecipe({ ...recipe, cooking_time: `${val} ${unit}` });
                    } else {
                      setRecipe({ ...recipe, cooking_time: '' });
                    }
                  }}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  min={1}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">unit</label>
                <select
                  value={recipe.cooking_time?.split(' ')[1] || 'mins'}
                  onChange={e => {
                    const value = recipe.cooking_time?.split(' ')[0] || '';
                    if (value) {
                      setRecipe({ ...recipe, cooking_time: `${value} ${e.target.value}` });
                    }
                  }}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                >
                  <option value="mins">mins</option>
                  <option value="seconds">seconds</option>
                  <option value="days">days</option>
                </select>
              </div>
            </div>
            {/* Ingredients */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">ingredients (one per line)</label>
              <textarea
                value={recipe.ingredients.join('\n')}
                onChange={e => setRecipe({ ...recipe, ingredients: e.target.value.split('\n') })}
                rows={4}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                required
                disabled={isSaving}
              />
            </div>
            {/* Instructions */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">instructions (one per line)</label>
              <textarea
                value={recipe.instructions.join('\n')}
                onChange={e => setRecipe({ ...recipe, instructions: e.target.value.split('\n') })}
                rows={4}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                required
                disabled={isSaving}
              />
            </div>
            {/* Nutrition */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">calories</label>
                <input
                  type="text"
                  value={recipe.calories === null || recipe.calories === 'unknown' ? '' : recipe.calories}
                  onChange={e => setRecipe({ ...recipe, calories: e.target.value || 'unknown' })}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">protein</label>
                <input
                  type="text"
                  value={recipe.protein === null || recipe.protein === 'unknown' ? '' : recipe.protein}
                  onChange={e => setRecipe({ ...recipe, protein: e.target.value || 'unknown' })}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">fat</label>
                <input
                  type="text"
                  value={recipe.fat === null || recipe.fat === 'unknown' ? '' : recipe.fat}
                  onChange={e => setRecipe({ ...recipe, fat: e.target.value || 'unknown' })}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">carbohydrates</label>
                <input
                  type="text"
                  value={recipe.carbohydrates === null || recipe.carbohydrates === 'unknown' ? '' : recipe.carbohydrates}
                  onChange={e => setRecipe({ ...recipe, carbohydrates: e.target.value || 'unknown' })}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSaving}
                />
              </div>
            </div>
            {/* Error Message */}
            {error && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500">{error}</p>
              </div>
            )}
            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 border border-outline bg-[var(--background)] text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'saving...' : 'save changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
} 