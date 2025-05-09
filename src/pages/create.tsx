import { useState, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

const CUISINE_TYPES = [
  'italian', 'mexican', 'asian', 'american', 'mediterranean',
  'french', 'chinese', 'japanese', 'indian', 'thai', 'greek',
  'spanish', 'british', 'turkish', 'korean', 'vietnamese', 'german', 'caribbean', 'african', 'middle eastern', 'russian', 'brazilian'
];

const DIET_TYPES = [
  'vegetarian', 'vegan', 'gluten-free', 'ketogenic', 'paleo',
  'pescatarian', 'lacto-vegetarian', 'ovo-vegetarian', 'whole30', 'low-fodmap', 'dairy-free', 'nut-free', 'halal', 'kosher'
];

export default function CreateRecipePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadImage = async (file: File): Promise<string> => {
    try {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size should be less than 5MB');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (uploadError.message.includes('violates row-level security policy')) {
          throw new Error('You do not have permission to upload images. Please sign in.');
        }
        throw new Error(uploadError.message);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Image upload error:', error);
      throw new Error(error.message || 'Failed to upload image. Please try again.');
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      setError('Recipe title is required');
      return false;
    }

    if (title.length > 100) {
      setError('Title must be less than 100 characters');
      return false;
    }

    if (!description.trim()) {
      setError('Recipe description is required');
      return false;
    }

    if (description.length > 2000) {
      setError('Description must be less than 2000 characters');
      return false;
    }

    if (!ingredients.trim()) {
      setError('At least one ingredient is required');
      return false;
    }

    if (!instructions.trim()) {
      setError('At least one instruction is required');
      return false;
    }

    if (cookingTimeValue && (isNaN(parseInt(cookingTimeValue)) || parseInt(cookingTimeValue) <= 0)) {
      setError('Cooking time must be a positive number');
      return false;
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return false;
    }

    if (imageFile && !imageFile.type.startsWith('image/')) {
      setError('File must be an image');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalImageUrl = imageUrl;
      
      if (imageFile) {
        try {
          finalImageUrl = await uploadImage(imageFile);
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          setError(uploadError.message || 'Failed to upload image. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      const recipeData = {
        title: title.trim(),
        description: description.trim(),
        image_url: finalImageUrl,
        user_id: user.id,
        cuisine_type: cuisineType || null,
        cooking_time: cookingTimeValue ? `${cookingTimeValue} ${cookingTimeUnit}` : null,
        cooking_time_value: cookingTimeValue ? parseInt(cookingTimeValue) : null,
        cooking_time_unit: cookingTimeUnit,
        diet_type: dietType || null,
        ingredients: ingredients.split('\n').map(i => i.trim()).filter(Boolean),
        instructions: instructions.split('\n').map(i => i.trim()).filter(Boolean),
        calories: calories || 'unknown',
        protein: protein || 'unknown',
        fat: fat || 'unknown',
        carbohydrates: carbohydrates || 'unknown'
      };

      const { data: recipe, error: insertError } = await supabase
        .from('recipes')
        .insert([recipeData])
        .select()
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        throw new Error(insertError.message);
      }

      if (!recipe) {
        throw new Error('No recipe data returned after insert');
      }

      router.push(`/recipe/${recipe.id}`);
    } catch (err: any) {
      console.error('Error creating recipe:', err);
      setError(err.message || 'Failed to create recipe. Please try again.');
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
            <h1 className="text-3xl">create recipe</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  recipe name
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                  required
                  placeholder="enter recipe name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  recipe description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                  rows={4}
                  required
                  placeholder="describe your recipe"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  recipe image
                </label>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                    >
                      upload image
                    </button>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                      placeholder="or paste image url"
                    />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {(imagePreview || imageUrl) && (
                    <div className="relative w-full h-48">
                      <Image
                        src={imagePreview || imageUrl}
                        alt="recipe preview"
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="ingredients" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  ingredients
                </label>
                <textarea
                  id="ingredients"
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                  rows={4}
                  required
                  placeholder="list ingredients (one per line)"
                />
              </div>

              <div>
                <label htmlFor="instructions" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  instructions
                </label>
                <textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                  rows={4}
                  required
                  placeholder="list steps (one per line)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  id="cuisine_type"
                  value={cuisineType}
                  onChange={(e) => setCuisineType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
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
                    id="cooking_time_value"
                    value={cookingTimeValue}
                    onChange={(e) => {
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
                    <option value="mins">minutes</option>
                    <option value="days">days</option>
                  </select>
                </div>

                <select
                  id="diet_type"
                  value={dietType}
                  onChange={(e) => setDietType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                >
                  <option value="">select diet</option>
                  {DIET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h2 className="text-xl mb-4">nutrition facts</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="calories" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                      calories
                    </label>
                    <input
                      type="text"
                      id="calories"
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                      placeholder="enter calories"
                    />
                  </div>
                  <div>
                    <label htmlFor="protein" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                      protein
                    </label>
                    <input
                      type="text"
                      id="protein"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                      placeholder="enter protein"
                    />
                  </div>
                  <div>
                    <label htmlFor="fat" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                      fat
                    </label>
                    <input
                      type="text"
                      id="fat"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                      placeholder="enter fat"
                    />
                  </div>
                  <div>
                    <label htmlFor="carbohydrates" className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                      carbohydrates
                    </label>
                    <input
                      type="text"
                      id="carbohydrates"
                      value={carbohydrates}
                      onChange={(e) => setCarbohydrates(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-normal text-base leading-normal"
                      placeholder="enter carbohydrates"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-500">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'saving...' : 'save recipe'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}