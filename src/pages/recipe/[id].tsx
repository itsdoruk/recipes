import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';

interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  image_url: string | null;
  user_id: string;
  created_at: string;
  cuisine_type: string | null;
  cooking_time: string | null;
  diet_type: string | null;
}

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

export default function RecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetchRecipe();
  }, [id]);

  const fetchRecipe = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setRecipe(data);

      // Fetch author profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', data.user_id)
        .single();

      setProfile(profileData);
    } catch (err) {
      console.error('Error fetching recipe:', err);
      setError('Failed to load recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe || !user || recipe.user_id !== user.id) return;

    if (!confirm('are you sure you want to delete this recipe?')) return;

    setIsDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipe.id);

      if (deleteError) throw deleteError;

      router.push('/');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setError('Failed to delete recipe');
      setIsDeleting(false);
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

  const isOwner = user?.id === recipe.user_id;

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {recipe.image_url && (
            <div className="relative w-full h-96">
              <Image
                src={recipe.image_url}
                alt={recipe.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          <div>
            <h1 className="font-mono text-3xl">{recipe.title}</h1>
            <div className="flex items-center gap-2 mt-4">
              {profile?.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={profile.username || 'anonymous'}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <Link
                href={`/user/${recipe.user_id}`}
                className="font-mono text-gray-500 dark:text-gray-400 hover:underline"
              >
                {profile?.username || 'anonymous'}
              </Link>
              <span className="font-mono text-gray-500 dark:text-gray-400">
                • {new Date(recipe.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {recipe.cuisine_type && (
              <div>
                <h3 className="font-mono text-sm text-gray-500 dark:text-gray-400">cuisine</h3>
                <p className="font-mono">{recipe.cuisine_type}</p>
              </div>
            )}
            {recipe.cooking_time && (
              <div>
                <h3 className="font-mono text-sm text-gray-500 dark:text-gray-400">cooking time</h3>
                <p className="font-mono">{recipe.cooking_time}</p>
              </div>
            )}
            {recipe.diet_type && (
              <div>
                <h3 className="font-mono text-sm text-gray-500 dark:text-gray-400">diet</h3>
                <p className="font-mono">{recipe.diet_type}</p>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">description</h2>
            <p className="font-mono">{recipe.description}</p>
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">ingredients</h2>
            <ul className="list-disc list-inside space-y-2">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="font-mono">
                  {ingredient}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">instructions</h2>
            <ol className="list-decimal list-inside space-y-4">
              {recipe.instructions.map((instruction, index) => (
                <li key={index} className="font-mono">
                  {instruction}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/user/${recipe.user_id}`}
              className="font-mono hover:underline"
            >
              {profile?.username || 'anonymous'}
            </Link>
            {user?.id === recipe.user_id && (
              <div className="flex gap-2">
                <Link
                  href={`/edit-recipe/${recipe.id}`}
                  className="px-3 py-1 text-sm border rounded font-mono hover:bg-gray-100"
                >
                  edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 text-sm border rounded font-mono text-red-500 hover:bg-red-50"
                >
                  delete
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}