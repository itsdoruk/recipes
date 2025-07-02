import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useAuth } from '@/lib/hooks/useAuth';
import Avatar from './Avatar';
import Modal from './Modal';

interface BlockedUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

const FONT_SIZES = [
  { value: 'normal', label: 'normal' },
  { value: 'large', label: 'large' },
  { value: 'xlarge', label: 'extra large' },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);
  const [supabase, setSupabase] = useState<any>(null);

  // New settings state
  const [themeSetting, setThemeSetting] = useState('system');
  const [fontSizeSetting, setFontSizeSetting] = useState('normal');
  const [fontSize, setFontSize] = useState('normal');
  const [showNutrition, setShowNutrition] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage and theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setThemeSetting(localStorage.getItem('app_theme') || theme || 'system');
      setFontSizeSetting(localStorage.getItem('app_font_size') || 'normal');
      setFontSize(localStorage.getItem('app_font_size') || 'normal');
      setShowNutrition(localStorage.getItem('app_show_nutrition') !== 'false');
      // Apply initial font size
      const savedFontSize = localStorage.getItem('app_font_size') || 'normal';
      document.body.classList.remove('font-size-normal', 'font-size-large', 'font-size-xlarge');
      document.body.classList.add(`font-size-${savedFontSize}`);
    }
  }, [theme]);

  // Track changes for save button
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('app_theme') || theme || 'system';
      const savedFontSize = localStorage.getItem('app_font_size') || 'normal';
      const savedShowNutrition = localStorage.getItem('app_show_nutrition') !== 'false';
      const hasChanges = themeSetting !== savedTheme || fontSizeSetting !== savedFontSize || showNutrition !== savedShowNutrition;
      setHasUnsavedChanges(hasChanges);
    }
  }, [themeSetting, fontSizeSetting, showNutrition, theme]);

  // Apply font size to document body
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.classList.remove('font-size-normal', 'font-size-large', 'font-size-xlarge');
      document.body.classList.add(`font-size-${fontSize}`);
    }
  }, [fontSize]);

  // Initialize Supabase client on the client side
  useEffect(() => {
    const initSupabase = async () => {
      try {
        setSupabase(getBrowserClient());
      } catch (error) {
        console.error('Error initializing Supabase:', error);
      }
    };
    initSupabase();
  }, []);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (!user || !supabase) return;
      
      const { data: blockedData } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('user_id', user.id);

      if (blockedData?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', blockedData.map((b: { blocked_user_id: string }) => b.blocked_user_id));
        setBlockedUsers(profiles || []);
      }
    };

    if (user && supabase) {
      fetchBlockedUsers();
    }
  }, [user, supabase]);

  const handleUnblock = async (userId: string) => {
    if (!user || !supabase) return;
    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', user.id)
        .eq('blocked_user_id', userId);
      setBlockedUsers(prev => prev.filter(u => u.user_id !== userId));
      setShowUnblockModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_theme', themeSetting);
        setTheme(themeSetting);
        localStorage.setItem('app_font_size', fontSizeSetting);
        setFontSize(fontSizeSetting);
        localStorage.setItem('app_show_nutrition', showNutrition ? 'true' : 'false');
        window.dispatchEvent(new Event('nutrition-visibility-changed'));
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    setThemeSetting('system');
    setTheme('system');
    setFontSizeSetting('normal');
    setFontSize('normal');
    setShowNutrition(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_theme');
      localStorage.removeItem('app_font_size');
      localStorage.removeItem('app_show_nutrition');
    }
    setHasUnsavedChanges(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-gray-500 dark:text-gray-400">loading settings...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-gray-500 dark:text-gray-400">please sign in to access settings</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl px-4 py-8 max-w-2xl mx-auto" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <h1 className="text-2xl mb-6">app settings</h1>
      <div className="space-y-8">
        {/* Appearance */}
        <div>
          <label htmlFor="theme" className="block text-sm font-medium mb-2">
            theme
          </label>
          <select
            id="theme"
            value={themeSetting}
            onChange={(e) => setThemeSetting(e.target.value)}
            className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
          >
            <option value="system">system</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </div>
        {/* Font Size */}
        <div>
          <label htmlFor="font-size" className="block text-sm font-medium mb-2">
            font size
          </label>
          <select
            id="font-size"
            value={fontSizeSetting}
            onChange={(e) => setFontSizeSetting(e.target.value)}
            className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
          >
            {FONT_SIZES.map((size) => (
              <option key={size.value} value={size.value}>{size.label.toLowerCase()}</option>
            ))}
          </select>
        </div>
        {/* Nutrition Info Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">show nutrition info</span>
          <button
            onClick={() => {
              setShowNutrition((v) => !v);
            }}
            className={`px-6 py-3 border hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base lowercase disabled:opacity-50 disabled:cursor-not-allowed ${showNutrition ? 'border-outline bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-transparent text-black border-black'}`}
            aria-pressed={showNutrition}
          >
            {showNutrition ? 'on' : 'off'}
          </button>
        </div>

        {/* Save Changes Button */}
        {hasUnsavedChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base lowercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'saving...' : 'save changes'}
            </button>
          </div>
        )}

        {/* Reset Settings */}
        <div className="flex justify-end">
          <button
            onClick={handleResetSettings}
            className="px-6 py-3 border border-outline bg-transparent text-[var(--danger)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base lowercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            reset to default
          </button>
        </div>
      </div>

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
              className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base lowercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              cancel
            </button>
            <button
              onClick={() => selectedUser && handleUnblock(selectedUser.user_id)}
              className="px-6 py-3 border border-outline bg-transparent text-[var(--accent)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base lowercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              unblock
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 