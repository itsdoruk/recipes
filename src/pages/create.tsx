import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

export default function CreateRecipePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [cookingTimeValue, setCookingTimeValue] = useState('');
  const [cookingTimeUnit, setCookingTimeUnit] = useState('mins');
  const [dietType, setDietType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbohydrates, setCarbohydrates] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    // Validate cooking time value is a number
    if (!/^\d+$/.test(cookingTimeValue)) {
      setError('Cooking time must be a number');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ingredientsArray = ingredients
        .split('\n')
        .map((i) => i.trim())
        .filter(Boolean);
      const instructionsArray = instructions
        .split('\n')
        .map((i) => i.trim())
        .filter(Boolean);
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          title,
          description,
          image_url: imageUrl || null,
          user_id: user.id,
          cuisine_type: cuisineType || null,
          cooking_time_value: cookingTimeValue || null,
          cooking_time_unit: cookingTimeUnit || null,
          diet_type: dietType || null,
          ingredients: ingredientsArray,
          instructions: instructionsArray,
          calories: calories || null,
          protein: protein || null,
          fat: fat || null,
          carbohydrates: carbohydrates || null,
        })
        .select()
        .single();

      if (error) throw error;

      router.push(`/recipe/${data.id}`);
    } catch (err) {
      console.error('Error creating recipe:', err);
      setError('Failed to create recipe');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">please sign in to create a recipe</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>create recipe | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">create recipe</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="blockmb-2">
                title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="blockmb-2">
                description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparenth-32"
                required
              />
            </div>

            <div>
              <label htmlFor="image_url" className="blockmb-2">
                image url
              </label>
              <input
                type="url"
                id="image_url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
              />
            </div>

            <div>
              <label htmlFor="ingredients" className="blockmb-2">
                ingredients (one per line)
              </label>
              <textarea
                id="ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparenth-32"
                required
                placeholder={`e.g. 2 eggs
1 cup flour
1/2 cup sugar`}
              />
            </div>

            <div>
              <label htmlFor="instructions" className="blockmb-2">
                instructions (one step per line)
              </label>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparenth-32"
                required
                placeholder={`e.g. Preheat oven to 350F
Mix flour and sugar
Add eggs and stir
Bake for 30 minutes`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                id="cuisine_type"
                value={cuisineType}
                onChange={(e) => setCuisineType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
              >
                <option value="">any cuisine</option>
                {CUISINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  id="cooking_time_value"
                  value={cookingTimeValue}
                  onChange={(e) => {
                    // Only allow numeric characters
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setCookingTimeValue(val);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                  min="0"
                  placeholder="cooking time"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
                <select
                  id="cooking_time_unit"
                  value={cookingTimeUnit}
                  onChange={(e) => setCookingTimeUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                >
                  <option value="seconds">seconds</option>
                  <option value="mins">mins</option>
                  <option value="days">days</option>
                </select>
              </div>

              <select
                id="diet_type"
                value={dietType}
                onChange={(e) => setDietType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
              >
                <option value="">any diet</option>
                {DIET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h2 className="text-xl mb-4 mt-8">nutrition</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="calories" className="blockmb-2">calories</label>
                  <input
                    type="number"
                    id="calories"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
                    placeholder="calories"
                    defaultValue="0"
                  />
                </div>
                <div>
                  <label htmlFor="protein" className="blockmb-2">protein</label>
                  <input
                    type="number"
                    id="protein"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
                    placeholder="protein"
                    defaultValue="0"
                  />
                </div>
                <div>
                  <label htmlFor="fat" className="blockmb-2">fat</label>
                  <input
                    type="number"
                    id="fat"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
                    placeholder="fat"
                    defaultValue="0"
                  />
                </div>
                <div>
                  <label htmlFor="carbohydrates" className="blockmb-2">carbohydrates</label>
                  <input
                    type="number"
                    id="carbohydrates"
                    value={carbohydrates}
                    onChange={(e) => setCarbohydrates(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent "
                    placeholder="carbohydrates"
                    defaultValue="0"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-500">{error}</p>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacitydisabled:opacity-50"
              >
                {isSubmitting ? 'creating...' : 'create recipe'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity "
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