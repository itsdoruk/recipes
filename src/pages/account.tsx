import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ 
    username: '', 
    bio: '',
    is_private: false,
    show_email: false 
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [starredRecipes, setStarredRecipes] = useState<Recipe[]>([]);
  const [following, setFollowing] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, bio, avatar_url, is_private, show_email')
        .eq('user_id', user.id)
        .single();
      setProfile(profileData);
      setForm({
        username: profileData?.username || '',
        bio: profileData?.bio || '',
        is_private: profileData?.is_private || false,
        show_email: profileData?.show_email || false
      });
      setAvatarUrl(profileData?.avatar_url || null);
      setLoading(false);
    };

    const fetchStarredRecipes = async () => {
      if (!user) return;
      const { data: starredData } = await supabase
        .from('starred_recipes')
        .select('recipe_id')
        .eq('user_id', user.id);

      if (starredData?.length) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select('id, title, description, image_url, created_at')
          .in('id', starredData.map(s => s.recipe_id));
        setStarredRecipes(recipes || []);
      }
    };

    const fetchFollowing = async () => {
      if (!user) return;
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingData?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', followingData.map(f => f.following_id));
        setFollowing(profiles || []);
      }
    };

    fetchProfile();
    fetchStarredRecipes();
    fetchFollowing();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          username: form.username, 
          bio: form.bio, 
          avatar_url: avatarUrl,
          is_private: form.is_private,
          show_email: form.show_email
        })
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      setSuccess('profile updated!');
    } catch (err: any) {
      setError(err.message || 'failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || !e.target.files[0]) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setError('please upload an image file');
      setIsUploading(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('image size must be less than 5mb');
      setIsUploading(false);
      return;
    }
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;
    setUploadProgress(30);
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (uploadError) {
      setError('failed to upload image. please try again.');
      setIsUploading(false);
      return;
    }
    setUploadProgress(60);
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    setUploadProgress(80);
    setAvatarUrl(publicUrl);
    setIsUploading(false);
    setUploadProgress(100);
    setSuccess('avatar uploaded!');
  };

  if (!user) {
    return <div className="max-w-2xl mx-auto px-4 py-8">please sign in to view your account settings</div>;
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-8">loading...</div>;
  }

  return (
    <>
      <Head>
        <title>account | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h1 className="text-2xl mb-8">account</h1>
        
        <div className="space-y-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                <Avatar avatar_url={avatarUrl} username={form.username} size={96} />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                    <div className="text-white text-sm">{uploadProgress}%</div>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className=""
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="block mb-2">username {form.is_private && '🔒'}</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity"
              />
            </div>
            <div>
              <label className="block mb-2">bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity"
              />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl">privacy</h2>
              <div className="flex items-center justify-between">
                <label>private profile</label>
                <input
                  type="checkbox"
                  checked={form.is_private}
                  onChange={(e) => setForm(prev => ({ ...prev, is_private: e.target.checked }))}
                  className="w-4 h-4-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <label>show email</label>
                <input
                  type="checkbox"
                  checked={form.show_email}
                  onChange={(e) => setForm(prev => ({ ...prev, show_email: e.target.checked }))}
                  className="w-4 h-4-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {saving ? 'saving...' : 'save changes'}
            </button>
            {error && <p className="text-red-500">{error}</p>}
            {success && <p className="text-green-600">{success}</p>}
          </form>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl mb-4">following</h2>
            <div className="space-y-4">
              {following.length > 0 ? (
                following.map((profile) => (
                  <Link
                    key={profile.user_id}
                    href={`/user/${profile.user_id}`}
                    className="flex items-center gap-3 h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                  >
                    <Avatar avatar_url={profile.avatar_url} username={profile.username} size={24} />
                    <span>@{profile.username}</span>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">not following anyone yet</p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl mb-4">starred recipes</h2>
            <div className="space-y-4">
              {starredRecipes.length > 0 ? (
                starredRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipe/${recipe.id}`}
                    className="flex items-center gap-3 h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                  >
                    {recipe.image_url ? (
                      <Image
                        src={recipe.image_url}
                        alt={recipe.title}
                        width={24}
                        height={24}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700" />
                    )}
                    <span>{recipe.title}</span>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">no starred recipes yet</p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl mb-4">account management</h2>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/account/change-password')}
                className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
              >
                change password
              </button>
              
              <button
                onClick={() => router.push('/account/change-email')}
                className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity text-left"
              >
                change email
              </button>

              <button
                onClick={() => router.push('/account/delete')}
                className="w-full h-10 px-3 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 transition-opacity text-left"
              >
                delete account
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
} 