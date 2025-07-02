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
import RecipeCard from '@/components/RecipeCard';
import { unlinkGoogleAccount } from '@/lib/auth-utils';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Skeleton from '@/components/Skeleton';

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
  const [starredRecipes, setStarredRecipes] = useState<any[]>([]);
  const [starredLoading, setStarredLoading] = useState(true);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [formChanged, setFormChanged] = useState(false);

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
    async function fetchStarredRecipesUnified() {
      setStarredLoading(true);
      try {
        if (!session?.user?.id) {
          setStarredRecipes([]);
          setStarredLoading(false);
          return;
        }
        const supabase = getBrowserClient();
        // Get all starred recipe rows
        const { data: starredRows, error: starredRowsError } = await supabase
          .from('starred_recipes')
          .select('*')
          .eq('user_id', session.user.id);
        if (starredRowsError || !starredRows) {
          setStarredRecipes([]);
          setStarredLoading(false);
        return;
      }
        // Separate recipe IDs by type
        const userRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'user').map((r: any) => r.recipe_id);
        const spoonacularRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'spoonacular').map((r: any) => r.recipe_id);
        const aiRecipeIds = starredRows.filter((r: any) => r.recipe_type === 'ai').map((r: any) => r.recipe_id);
        let starredRecipesList: any[] = [];
        // Fetch user recipes in one query
        if (userRecipeIds.length > 0) {
          const { data: userRecipes } = await supabase
            .from('recipes')
            .select('*')
            .in('id', userRecipeIds);
          // Attach usernames
          if (userRecipes && userRecipes.length > 0) {
            const userIds = Array.from(new Set(userRecipes.map((r: any) => r.user_id)));
            let userProfiles: Record<string, string> = {};
            if (userIds.length > 0) {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, username')
                .in('user_id', userIds);
              if (profiles) {
                userProfiles = profiles.reduce((acc: Record<string, string>, p: any) => {
                  acc[p.user_id] = p.username;
                  return acc;
                }, {});
              }
            }
            starredRecipesList.push(...userRecipes.map((r: any) => ({ ...r, recipe_type: 'user', username: userProfiles[r.user_id] || '[recipes] user' })));
          }
        }
        // Fetch spoonacular recipes in one query
        if (spoonacularRecipeIds.length > 0) {
          const { data: spoonacularRecipes } = await supabase
            .from('spoonacular_recipes')
            .select('*')
            .in('id', spoonacularRecipeIds);
          if (spoonacularRecipes) {
            starredRecipesList.push(...spoonacularRecipes.map((r: any) => ({ ...r, recipe_type: 'spoonacular' })));
          }
        }
        // Fetch AI recipes one by one (API)
        for (const recipeId of aiRecipeIds) {
          try {
            const res = await fetch(`/api/recipes/${recipeId}`);
            if (res.ok) {
            const data = await res.json();
              starredRecipesList.push({ ...data, recipe_type: 'ai', user_id: data.user_id || session.user.id });
            }
          } catch (error) {
            // Ignore errors for individual AI recipes
          }
        }
        // Sort by created_at descending
        starredRecipesList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setStarredRecipes(starredRecipesList);
          } catch (e) {
        setStarredRecipes([]);
      } finally {
        setStarredLoading(false);
      }
    }
    fetchStarredRecipesUnified();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!userProfile) return;
    setFormChanged(
      form.username !== (userProfile.username || '') ||
      form.bio !== (userProfile.bio || '') ||
      form.show_email !== (userProfile.show_email || false) ||
      JSON.stringify(form.dietary_restrictions) !== JSON.stringify(userProfile.dietary_restrictions || []) ||
      form.cooking_skill_level !== (userProfile.cooking_skill_level || '')
    );
  }, [form, userProfile]);

  useEffect(() => {
    async function fetchBlockedUsers() {
      if (!session?.user?.id) {
        setBlockedUsers([]);
        return;
      }
      try {
        // Get blocked user IDs
        const { data: blockedData, error: blockedError } = await supabase
          .from('blocked_users')
          .select('blocked_user_id')
          .eq('user_id', session.user.id);
        if (blockedError) throw blockedError;
        const blockedIds = (blockedData || []).map((b: { blocked_user_id: string }) => b.blocked_user_id);
        if (blockedIds.length === 0) {
          setBlockedUsers([]);
          return;
        }
        // Fetch profiles for blocked users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', blockedIds);
        if (profilesError) throw profilesError;
        setBlockedUsers(profiles || []);
      } catch (err) {
        setBlockedUsers([]);
        console.error('Error fetching blocked users:', err);
      }
    }
    fetchBlockedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('image size must be less than 5mb');
      setIsUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
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
      if (avatarInputRef.current) avatarInputRef.current.value = '';
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
      <div className="flex flex-col gap-6 max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-10 mb-8">
            <Skeleton width={128} height={128} className="rounded-full" />
            <div className="flex-1 flex flex-col gap-2 items-center md:items-start">
              <Skeleton width={180} height={32} />
              <Skeleton width={220} height={20} />
              <div className="flex gap-2 mt-2">
                <Skeleton width={100} height={32} />
                <Skeleton width={100} height={32} />
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <Skeleton width="100%" height={48} />
            <Skeleton width="100%" height={48} />
            <Skeleton width="100%" height={48} />
          </div>
          <div className="pt-8 border-t border-outline mt-8">
            <Skeleton width="60%" height={32} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Skeleton width="100%" height={120} />
              <Skeleton width="100%" height={120} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Account Settings | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-10">
              <div className="relative w-32 h-32 rounded-full overflow-hidden flex items-center justify-center border-4 border-accent shadow-lg">
                <Avatar avatar_url={avatarUrl} username={form.username} size={128} />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                    <div className="text-white text-lg font-semibold">{uploadProgress}%</div>
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2 items-center md:items-start">
                <h1 className="text-3xl text-[var(--foreground)] lowercase">{form.username || 'your username'}</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">{form.bio || 'add a short bio to let others know about you'}</p>
                <div className="flex gap-2 mt-2">
                  <label htmlFor="avatar-upload" className="px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg cursor-pointer text-sm font-medium">
                    Change Avatar
                  </label>
              <input
                    id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                    className="hidden"
                disabled={isUploading}
                    ref={avatarInputRef}
              />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-4 py-2 border border-outline bg-transparent text-[var(--danger)] hover:opacity-80 transition-opacity rounded-lg text-sm font-medium"
                  >
                    sign out
                  </button>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                  <label className="block mb-2 text-[var(--foreground)] lowercase">username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                    required
                    minLength={3}
                    maxLength={32}
              />
            </div>
            <div>
                  <label className="block mb-2 text-[var(--foreground)] lowercase">cooking skill level</label>
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
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  maxLength={160}
                />
              </div>
              <div>
                <label className="block mb-2 text-[var(--foreground)] lowercase">dietary restrictions</label>
                <input
                  type="text"
                  value={form.dietary_restrictions.join(', ')}
                  onChange={e => setForm(prev => ({ ...prev, dietary_restrictions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  placeholder="e.g. vegetarian, gluten-free, dairy-free"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.show_email}
                    onChange={(e) => setForm(prev => ({ ...prev, show_email: e.target.checked }))}
                    className="w-5 h-5 border border-outline rounded focus:ring-accent bg-transparent"
                    id="show-email"
                  />
                  <label htmlFor="show-email" className="text-[var(--foreground)] lowercase cursor-pointer">show email</label>
            </div>
              <button
                type="submit"
                  disabled={loading || !formChanged}
                  className="px-6 py-3 border border-outline bg-[var(--background)] text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'saving...' : 'save changes'}
              </button>
            </div>
            {error && (
                <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-2">
                <p className="text-red-500">{error}</p>
              </div>
            )}
              {success && <p className="p-4 border border-green-200 bg-green-50 rounded-xl text-green-600 mb-2">{success}</p>}
          </form>

            {/* Account Management */}
            <div className="pt-8 border-t border-outline">
              <h2 className="text-xl mb-4 text-[var(--foreground)] lowercase">account management</h2>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => router.push('/account/change-password')}
                  className="px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-left text-[var(--foreground)]"
                >
                  change password
                </button>
                <button
                  onClick={() => router.push('/account/change-email')}
                  className="px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-left text-[var(--foreground)]"
                >
                  change email
                </button>
                {hasGoogleAccount && (
                  <button
                    onClick={() => setShowUnlinkGoogleModal(true)}
                    className="px-4 py-3 border border-outline bg-transparent text-[var(--danger)] hover:opacity-80 transition-opacity rounded-lg text-left text-base font-semibold"
                  >
                    remove google account
                  </button>
                )}
                <button
                  onClick={() => router.push('/account/delete')}
                  className="px-4 py-3 border border-outline bg-transparent text-[var(--danger)] hover:opacity-80 transition-opacity rounded-lg text-left text-base font-semibold"
                >
                  delete account
                </button>
              </div>
            </div>

            {/* Blocked Users */}
            <div className="pt-8 border-t border-outline">
              <h2 className="text-xl mb-4 text-[var(--foreground)] lowercase">blocked users</h2>
            {blockedUsers.length > 0 ? (
              <div className="space-y-4">
                {blockedUsers.map((blockedUser) => (
                    <div key={blockedUser.user_id} className="flex items-center justify-between p-4 border border-outline rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                        <Avatar avatar_url={blockedUser.avatar_url} username={blockedUser.username} size={40} />
                      </div>
                      <div>
                          <div className="font-medium text-[var(--foreground)]">{blockedUser.username || '[recipes] user'}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUser(blockedUser);
                        setShowUnblockModal(true);
                      }}
                        className="px-4 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-left text-[var(--foreground)]"
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

            {/* Starred Recipes */}
            <div className="pt-8 border-t border-outline">
              <h2 className="text-xl mb-4 text-[var(--foreground)] lowercase">starred recipes</h2>
              {starredLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => <RecipeCard.Skeleton key={i} />)}
                </div>
              ) : starredRecipes.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">no starred recipes</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {starredRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id || recipe.recipe_id}
                      {...recipe}
                      recipeType={recipe.recipe_type}
                      {...(recipe.username ? { username: recipe.username } : {})}
                    />
                  ))}
                </div>
              )}
            </div>
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
        <div className="p-8 shadow-2xl max-w-lg w-full border border-outline rounded-xl" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          <h2 className="text-2xl mb-6 lowercase">unblock user</h2>
          <p className="mb-6">
            are you sure you want to unblock {selectedUser?.username || 'this user'}? you will be able to see their content and interact with them again.
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setShowUnblockModal(false);
                setSelectedUser(null);
              }}
              className="px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-[var(--foreground)]"
            >
              cancel
            </button>
            <button
              onClick={() => selectedUser && handleUnblock(selectedUser.user_id)}
              className="px-4 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 transition-opacity rounded-lg"
              disabled={isSubmitting}
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
        <div className="p-8 shadow-2xl max-w-lg w-full border border-outline rounded-xl" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          <h2 className="text-2xl mb-6 lowercase">unlink google account</h2>
          <p className="mb-6">
            are you sure you want to remove your google account integration? you will still be able to sign in with your email and password.
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowUnlinkGoogleModal(false)}
              className="px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-[var(--foreground)]"
              disabled={isUnlinkingGoogle}
            >
              cancel
            </button>
            <button
              onClick={handleUnlinkGoogle}
              className="px-4 py-2 border border-outline bg-transparent text-[var(--warning)] hover:opacity-80 transition-opacity rounded-lg"
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