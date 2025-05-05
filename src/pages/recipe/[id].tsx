import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';

interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  image_url?: string;
  user_id: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

export default function RecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchRecipe = async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select(`
            *,
            profiles (
              username,
              avatar_url
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setRecipe(data);
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  if (isLoading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono text-center">loading...</p>
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono text-center text-red-500">{error || 'Recipe not found'}</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{recipe.title} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="font-mono text-2xl mb-2">{recipe.title}</h1>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
              by{' '}
              <button
                onClick={() => router.push(`/profile?id=${recipe.user_id}`)}
                className="hover:underline"
              >
                {recipe.profiles?.username || 'anonymous'}
              </button>
            </p>
          </div>

          {recipe.image_url && (
            <div className="relative w-full h-64 border border-gray-200 dark:border-gray-800">
              <Image
                src={recipe.image_url}
                alt={recipe.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          <div>
            <h2 className="font-mono text-lg mb-2">ingredients</h2>
            <ul className="list-none space-y-1">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index} className="font-mono">
                  • {ingredient}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-lg mb-2">instructions</h2>
            <ol className="list-decimal list-inside space-y-2">
              {recipe.instructions.map((instruction, index) => (
                <li key={index} className="font-mono">
                  {instruction}
                </li>
              ))}
            </ol>
          </div>

          {user?.id === recipe.user_id && (
            <div className="pt-4">
              <button
                onClick={() => router.push(`/edit/${recipe.id}`)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
              >
                edit recipe
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}