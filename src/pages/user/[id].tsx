import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
}

export default function UserProfile() {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user's recipes
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (recipesError) throw recipesError;
      setRecipes(recipesData || []);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono">loading...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono text-red-500">{error || 'User not found'}</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{profile.username || 'anonymous'} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <img
              src={profile.avatar_url || '/default-avatar.png'}
              alt={profile.username || 'anonymous'}
              className="w-24 h-24 rounded-full object-cover"
            />
            <div>
              <h1 className="font-mono text-2xl">
                {profile.username || 'anonymous'}
              </h1>
              {profile.bio && (
                <p className="font-mono text-gray-500 dark:text-gray-400 mt-2">
                  {profile.bio}
                </p>
              )}
              <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mt-2">
                joined {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">recipes</h2>
            {recipes.length === 0 ? (
              <p className="font-mono text-gray-500 dark:text-gray-400">
                no recipes yet
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {recipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipe/${recipe.id}`}
                    className="block p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                  >
                    {recipe.image_url && (
                      <div className="relative w-full h-48 mb-4">
                        <Image
                          src={recipe.image_url}
                          alt={recipe.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <h3 className="font-mono text-lg">{recipe.title}</h3>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 