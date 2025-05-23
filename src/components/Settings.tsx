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

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);
  const [supabase, setSupabase] = useState<any>(null);

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
      <h1 className="text-2xl mb-6">appearance</h1>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="theme" className="block text-sm font-medium mb-2">
            theme
          </label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full h-10 px-3 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity rounded-xl"
          >
            <option value="system">system</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
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
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--foreground)', background: 'var(--background)' }}
            >
              cancel
            </button>
            <button
              onClick={() => selectedUser && handleUnblock(selectedUser.user_id)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity rounded-lg"
              style={{ color: 'var(--accent)', background: 'var(--background)' }}
            >
              unblock
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 