import { useState, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useUser } from '@supabase/auth-helpers-react';
import { getSupabaseClient } from '@/lib/supabase';
import Image from "next/image";
import FormSkeleton from '@/components/FormSkeleton';

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
  const user = useUser();
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
        throw new Error('image size should be less than 5mb');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('file must be an image');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // Upload the file
      const { error: uploadError } = await getSupabaseClient().storage
        .from('recipe-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (uploadError.message.includes('violates row-level security policy')) {
          throw new Error('You do not have permission to upload images. Please sign in.');
        }
        throw new Error(uploadError.message || 'failed to upload image. please try again.');
      }

      // Get the public URL
      const { data: { publicUrl } } = getSupabaseClient().storage
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
      setError('recipe title is required');
      return false;
    }

    if (title.length > 100) {
      setError('title must be less than 100 characters');
      return false;
    }

    if (!description.trim()) {
      setError('recipe description is required');
      return false;
    }

    if (description.length > 2000) {
      setError('description must be less than 2000 characters');
      return false;
    }

    if (!ingredients.trim()) {
      setError('at least one ingredient is required');
      return false;
    }

    if (!instructions.trim()) {
      setError('at least one instruction is required');
      return false;
    }

    if (cookingTimeValue && (isNaN(parseInt(cookingTimeValue)) || parseInt(cookingTimeValue) <= 0)) {
      setError('cooking time must be a positive number');
      return false;
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      setError('image size must be less than 5mb');
      return false;
    }

    if (imageFile && !imageFile.type.startsWith('image/')) {
      setError('file must be an image');
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
          setError(uploadError.message || 'failed to upload image. please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      const recipeData = {
        title: title.trim(),
        description: description.trim(),
        image_url: finalImageUrl,
        user_id: user.id,
        recipe_type: 'user',
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

      const { data: recipe, error: insertError } = await getSupabaseClient()
        .from('recipes')
        .insert([recipeData])
        .select('id')
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
      setError(err.message || 'failed to create recipe. please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return <FormSkeleton />;
  }

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
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-3xl mb-8 lowercase">create recipe</h1>
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
                    disabled={isSubmitting}
                  >
                    upload image
                  </button>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                    placeholder="or paste image url"
                    disabled={isSubmitting}
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
                      className="object-cover rounded-xl"
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
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                maxLength={100}
                required
                disabled={isSubmitting}
              />
            </div>
            {/* Description */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                maxLength={2000}
                required
                disabled={isSubmitting}
              />
            </div>
            {/* Cuisine & Diet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">cuisine type</label>
                <select
                  value={cuisineType}
                  onChange={e => setCuisineType(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
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
                  value={dietType}
                  onChange={e => setDietType(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
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
                  value={cookingTimeValue}
                  onChange={e => setCookingTimeValue(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  min={1}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">unit</label>
                <select
                  value={cookingTimeUnit}
                  onChange={e => setCookingTimeUnit(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
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
                value={ingredients}
                onChange={e => setIngredients(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                required
                disabled={isSubmitting}
              />
            </div>
            {/* Instructions */}
            <div>
              <label className="block mb-2 text-[var(--foreground)] lowercase">instructions (one per line)</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                required
                disabled={isSubmitting}
              />
            </div>
            {/* Nutrition */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">calories</label>
                <input
                  type="text"
                  value={calories}
                  onChange={e => setCalories(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">protein</label>
                <input
                  type="text"
                  value={protein}
                  onChange={e => setProtein(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">fat</label>
                <input
                  type="text"
                  value={fat}
                  onChange={e => setFat(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">carbohydrates</label>
                <input
                  type="text"
                  value={carbohydrates}
                  onChange={e => setCarbohydrates(e.target.value)}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
                className="px-6 py-3 border border-outline bg-[var(--background)] text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'creating...' : 'create recipe'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}