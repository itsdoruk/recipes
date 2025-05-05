import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface Profile {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  created_at: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (!user && !router.query.id) {
      router.push('/login');
      return;
    }

    const checkTableStructure = async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);

        if (error) {
          console.error('Profiles table error:', error);
          if (error.code === '42P01') {
            setError('Profiles table does not exist. Please run the SQL setup script.');
          } else {
            setError(`Database error: ${error.message}`);
          }
        }
      } catch (err) {
        console.error('Error checking table structure:', err);
      }
    };

    checkTableStructure();

    const fetchProfile = async () => {
      const profileId = router.query.id || user?.id;
      if (!profileId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (data) {
        setProfile(data);
        setPreviewUrl(data.avatar_url || '');
      }

      // Fetch user's recipes
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (recipesData) {
        setRecipes(recipesData);
      }
    };

    fetchProfile();
  }, [user, router.query.id]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      let avatar_url = profile?.avatar_url;

      if (avatarFile) {
        try {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${user.id}-${Math.random()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile);

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          avatar_url = publicUrl;
        } catch (uploadErr) {
          console.error('Avatar upload error:', uploadErr);
          throw new Error(`Failed to upload avatar: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}`);
        }
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: profile?.username,
          bio: profile?.bio,
          avatar_url,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }

      if (data) {
        setProfile(data);
        setSuccess('profile updated');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user && !router.query.id) return null;

  const isOwnProfile = !router.query.id || router.query.id === user?.id;

  return (
    <>
      <Head>
        <title>{profile?.username || 'Profile'} | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-mono text-2xl mb-8 text-center">
          {isOwnProfile ? 'my profile' : `${profile?.username}'s profile`}
        </h1>

        {error && (
          <div className="mb-4 p-3 border border-red-200 dark:border-red-800 text-sm font-mono">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 border border-green-200 dark:border-green-800 text-sm font-mono">
            {success}
          </div>
        )}

        <div className="space-y-8">
          {isOwnProfile ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20 border border-gray-200 dark:border-gray-800">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-50 dark:bg-gray-900" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="text-sm font-mono"
                />
              </div>

              <div>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-mono"
                />
              </div>

              <input
                type="text"
                value={profile?.username || ''}
                onChange={(e) => setProfile(prev => ({ ...prev!, username: e.target.value }))}
                placeholder="username"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none font-mono"
              />

              <textarea
                value={profile?.bio || ''}
                onChange={(e) => setProfile(prev => ({ ...prev!, bio: e.target.value }))}
                placeholder="tell us about yourself..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none h-32 font-mono"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                >
                  {isLoading ? '...' : 'save'}
                </button>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                >
                  sign out
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                {profile?.avatar_url ? (
                  <div className="relative w-20 h-20 border border-gray-200 dark:border-gray-800">
                    <Image
                      src={profile.avatar_url}
                      alt={profile.username}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{profile?.bio || 'no bio yet'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12">
          <h2 className="font-mono text-xl mb-4">recipes</h2>
          <div className="grid gap-4">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="p-4 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => router.push(`/recipe/${recipe.id}`)}
              >
                <h3 className="font-mono text-lg">{recipe.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
                  {recipe.description}
                </p>
              </div>
            ))}
            {recipes.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 font-mono">
                no recipes yet
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 