import { useEffect, useState, useRef } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Image from 'next/image';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import Modal from '@/components/Modal';
import EmptyStarredRecipes from '@/components/EmptyStarredRecipes';
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Database } from '@/types/supabase';
import { useStarredRecipes } from '@/hooks/useStarredRecipes';
import RecipeCard from '@/components/RecipeCard';
import { unlinkGoogleAccount } from '@/lib/auth-utils';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
  recipe_type: 'ai' | 'spoonacular' | 'user';
  user_id: string;
  cuisine_type?: string | null;
  cooking_time?: string | null;
  diet_type?: string | null;
}

interface BlockedUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

interface FormData {
  username: string;
  bio: string;
  show_email: boolean;
  dietary_restrictions: string[];
  cooking_skill_level: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useAuth();
  const { profile: userProfile, isLoading: profileLoading, refreshProfile } = useProfile();
  const supabase = useSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormData>({
    username: '',
    bio: '',
    show_email: false,
    dietary_restrictions: [],
    cooking_skill_level: ''
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnlinkGoogleModal, setShowUnlinkGoogleModal] = useState(false);
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const INITIAL_RETRIES_DELAY = 1000; // 1 second
  const { starredRecipes, isLoading: starredLoading } = useStarredRecipes();
  const [starredDetails, setStarredDetails] = useState<any[]>([]);

  // Check if user has Google account linked
  const hasGoogleAccount = session?.user?.identities?.some(
    (identity: any) => identity.provider === 'google'
  );

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle authentication
  useEffect(() => {
    if (sessionLoading || profileLoading) {
      return;
    }
    
    if (!session) {
      router.push('/login');
      return;
    }

    // Set initial form data
    if (userProfile) {
      setProfile(userProfile);
      setForm({
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        show_email: userProfile.show_email || false,
        dietary_restrictions: userProfile.dietary_restrictions || [],
        cooking_skill_level: userProfile.cooking_skill_level || ''
      });
      setAvatarUrl(userProfile.avatar_url || null);
    }

    setLoading(false);
  }, [session, userProfile, sessionLoading, profileLoading, router]);

  useEffect(() => {
    async function fetchDetails() {
      if (!starredRecipes || starredRecipes.length === 0) {
        setStarredDetails([]);
        return;
      }
      const results = await Promise.all(
        starredRecipes.map(async (star) => {
          try {
            let url = '';
            if (star.recipe_type === 'spoonacular') {
              url = `/api/recipes/spoonacular-${star.recipe_id}`;
            } else if (star.recipe_type === 'ai') {
              url = `/api/recipes/${star.recipe_id}`;
            } else {
              url = `/api/recipes/${star.recipe_id}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            return { ...data, recipe_type: star.recipe_type };
          } catch (e) {
            return { id: star.recipe_id, recipe_type: star.recipe_type, error: true };
          }
        })
      );
      setStarredDetails(results);
    }
    fetchDetails();
  }, [starredRecipes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: form.username,
          bio: form.bio,
          show_email: form.show_email,
          dietary_restrictions: form.dietary_restrictions,
          cooking_skill_level: form.cooking_skill_level,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id);

      if (updateError) throw updateError;
      setSuccess('Profile updated successfully!');
      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      if (session?.user?.id) {
        router.push(`/user/${session.user.id}`);
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id || !e.target.files || !e.target.files[0]) return;
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
    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
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

  const handleUnblock = async (userId: string) => {
    if (!session?.user?.id) return;
    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', session.user.id)
        .eq('blocked_user_id', userId);
      setBlockedUsers(prev => prev.filter(u => u.user_id !== userId));
      setShowUnblockModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error unblocking user:', error);
      setError('Failed to unblock user');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlinkGoogle = async () => {
    setIsUnlinkingGoogle(true);
    setError(null);

    try {
      const { error } = await unlinkGoogleAccount();
      if (error) {
        throw error;
      }
      
      setSuccess('Google account successfully unlinked');
      setShowUnlinkGoogleModal(false);
      
      // Refresh the session to update the user data
      router.reload();
    } catch (err: any) {
      console.error('Error unlinking Google account:', err);
      setError(err.message || 'Failed to unlink Google account');
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  if (loading || sessionLoading || profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Account Settings | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <h1 className="text-2xl" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>account settings</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <label className="block mb-2 font-semibold" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block mb-2 font-semibold" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block mb-2 font-semibold" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>dietary restrictions</label>
              <input
                type="text"
                value={form.dietary_restrictions.join(', ')}
                onChange={e => setForm(prev => ({ ...prev, dietary_restrictions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                placeholder="e.g. vegetarian, gluten-free, dairy-free"
              />
            </div>
            <div>
              <label className="block mb-2 font-semibold" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>cooking skill level</label>
              <select
                value={form.cooking_skill_level}
                onChange={(e) => setForm(prev => ({ ...prev, cooking_skill_level: e.target.value }))}
                className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
              >
                <option value="">select skill level</option>
                <option value="beginner">beginner</option>
                <option value="intermediate">intermediate</option>
                <option value="advanced">advanced</option>
                <option value="expert">expert</option>
              </select>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>privacy</h2>
              <div className="flex items-center justify-between">
                <label className="font-semibold" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>show email</label>
                <input
                  type="checkbox"
                  checked={form.show_email}
                  onChange={(e) => setForm(prev => ({ ...prev, show_email: e.target.checked }))}
                  className="w-4 h-4-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 dark:focus:ring-gray-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
              >
                {loading ? 'saving...' : 'save changes'}
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-2 border border-outline text-[var(--danger)] hover:opacity-80 transition-opacity rounded-lg"
              >
                sign out
              </button>
            </div>
            {error && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
            {success && <p className="text-green-600">{success}</p>}
          </form>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl mb-4" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>blocked users</h2>
            {blockedUsers.length > 0 ? (
              <div className="space-y-4">
                {blockedUsers.map((blockedUser) => (
                  <div key={blockedUser.user_id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                        <Avatar avatar_url={blockedUser.avatar_url} username={blockedUser.username} size={40} />
                      </div>
                      <div>
                        <div className="font-medium">{blockedUser.username || '[recipes] user'}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUser(blockedUser);
                        setShowUnblockModal(true);
                      }}
                      className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
                      style={{ color: 'var(--accent)' }}
                    >
                      unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">no blocked users</p>
            )}
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl mb-4" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>account management</h2>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/account/change-password')}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-left"
                style={{ color: 'var(--foreground)' }}
              >
                change password
              </button>
              
              <button
                onClick={() => router.push('/account/change-email')}
                className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-left"
                style={{ color: 'var(--foreground)' }}
              >
                change email
              </button>

              {hasGoogleAccount && (
                <button
                  onClick={() => setShowUnlinkGoogleModal(true)}
                  className="w-full px-4 py-3 border border-orange-200 dark:border-orange-800 bg-transparent hover:opacity-80 transition-opacity rounded-xl text-left"
                  style={{ color: 'var(--warning)' }}
                >
                  remove google account
                </button>
              )}

              <button
                onClick={() => router.push('/account/delete')}
                className="w-full px-4 py-3 border border-red-200 dark:border-red-800 bg-transparent hover:opacity-80 transition-opacity rounded-xl text-left"
                style={{ color: 'var(--danger)' }}
              >
                delete account
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl mb-4" style={{ color: 'var(--foreground)', textTransform: 'lowercase' }}>starred recipes</h2>
            {starredLoading ? (
              <div>Loading starred recipes...</div>
            ) : starredDetails.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">no starred recipes</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {starredDetails.map((recipe) =>
                  recipe.error ? (
                    <div key={recipe.id} className="p-4 border border-outline rounded-xl text-center text-gray-500 dark:text-gray-400">
                      Could not load recipe details.
                    </div>
                  ) : (
                    <RecipeCard key={recipe.id} {...recipe} recipeType={recipe.recipe_type === 'ai' ? 'ai' : recipe.recipe_type === 'spoonacular' ? 'spoonacular' : 'recipe'} />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Unblock Modal */}
      <Modal
        isOpen={showUnblockModal}
        onRequestClose={() => {
          setShowUnblockModal(false);
          setSelectedUser(null);
        }}
        contentLabel="Unblock User"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-lg w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
          <h2 className="text-2xl font-bold mb-4">unblock user</h2>
          <p className="mb-6">
            are you sure you want to unblock {selectedUser?.username || 'this user'}? you will be able to see their content and interact with them again.
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setShowUnblockModal(false);
                setSelectedUser(null);
              }}
              className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--foreground)', background: 'var(--background)' }}
            >
              cancel
            </button>
            <button
              onClick={() => selectedUser && handleUnblock(selectedUser.user_id)}
              className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--accent)', background: 'var(--background)' }}
            >
              unblock
            </button>
          </div>
        </div>
      </Modal>

      {/* Unlink Google Modal */}
      <Modal
        isOpen={showUnlinkGoogleModal}
        onRequestClose={() => setShowUnlinkGoogleModal(false)}
        contentLabel="Unlink Google Account"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-lg w-full border rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)' }}>
          <h2 className="text-2xl font-bold mb-4">unlink google account</h2>
          <p className="mb-6">
            are you sure you want to remove your google account integration? you will still be able to sign in with your email and password.
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowUnlinkGoogleModal(false)}
              className="px-3 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--foreground)', background: 'var(--background)' }}
              disabled={isUnlinkingGoogle}
            >
              cancel
            </button>
            <button
              onClick={handleUnlinkGoogle}
              className="px-3 py-2 border border-orange-200 dark:border-orange-800 hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--warning)', background: 'var(--background)' }}
              disabled={isUnlinkingGoogle}
            >
              {isUnlinkingGoogle ? 'removing...' : 'remove'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
} 