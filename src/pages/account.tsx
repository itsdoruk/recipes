import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Head from 'next/head';

export default function AccountPage() {
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
    fetchProfile();
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
      setSuccess('Profile updated!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
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
      setError('Please upload an image file');
      setIsUploading(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
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
      setError('Failed to upload image. Please try again.');
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
    setSuccess('Avatar uploaded!');
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
        <title>account settings | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <h1 className="text-2xl mb-8">account settings</h1>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={form.username || 'avatar'} width={96} height={96} className="object-cover aspect-square" />
              ) : (
                <span className="text-4xl">{form.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'A'}</span>
              )}
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
            <label className="block mb-2">username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
            />
          </div>
          <div>
            <label className="block mb-2">bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
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
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="flex items-center justify-between">
              <label>show email</label>
              <input
                type="checkbox"
                checked={form.show_email}
                onChange={(e) => setForm(prev => ({ ...prev, show_email: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {saving ? 'saving...' : 'save changes'}
          </button>
          {error && <p className="text-red-500">{error}</p>}
          {success && <p className="text-green-600">{success}</p>}
        </form>
      </main>
    </>
  );
} 