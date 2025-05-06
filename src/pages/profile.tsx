import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

interface Profile {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    bio: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchProfile();
    fetchUserRecipes();
  }, [user, router]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([
              {
                user_id: user?.id,
                username: null,
                bio: null,
                avatar_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ])
            .select()
            .single();

          if (createError) throw createError;
          setProfile(newProfile);
        } else {
          throw error;
        }
      } else {
        setProfile(data);
        setForm({
          username: data.username || "",
          bio: data.bio || "",
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
    } catch (err) {
      console.error('Error fetching recipes:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log('Updating profile for user:', user.id);
      console.log('Update data:', {
        username: form.username,
        bio: form.bio,
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: form.username,
          bio: form.bio,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      console.log('Profile updated successfully:', data);
      setProfile(data);
      setForm({
        username: data.username || "",
        bio: data.bio || "",
      });
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || !e.target.files[0]) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        try {
          const oldPath = profile.avatar_url.split('/').pop();
          if (oldPath) {
            await supabase.storage
              .from('avatars')
              .remove([oldPath]);
          }
        } catch (err) {
          console.error('Error deleting old avatar:', err);
          // Continue with upload even if delete fails
        }
      }

      setUploadProgress(30);

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload image. Please try again.');
      }

      setUploadProgress(60);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setUploadProgress(80);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error('Failed to update profile with new avatar');
      }

      setUploadProgress(100);
      await fetchProfile();
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>profile</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">profile</h1>
          </div>

          {error && (
            <p className="font-mono text-red-500">{error}</p>
          )}

          {isLoading ? (
            <p className="font-mono">loading...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="relative w-24 h-24">
                      <img
                        src={profile?.avatar_url || '/default-avatar.png'}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover"
                      />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                          <div className="text-white text-sm">{uploadProgress}%</div>
                        </div>
                      )}
                    </div>
                    <label
                      htmlFor="avatar-upload"
                      className={`absolute bottom-0 right-0 p-1 bg-black text-white rounded-full cursor-pointer hover:opacity-80 transition-opacity ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block font-mono mb-2">username</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono mb-2">bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono disabled:opacity-50"
              >
                {isSaving ? "saving..." : "save changes"}
              </button>
            </form>
          )}

          {recipes.length > 0 && (
            <div className="mt-8">
              <h2 className="font-mono text-xl mb-4">your recipes</h2>
              <div className="space-y-4">
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="p-4 border border-gray-200 dark:border-gray-800"
                  >
                    <h3 className="font-mono text-lg">{recipe.title}</h3>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 