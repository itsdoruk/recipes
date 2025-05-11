import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Avatar from './Avatar';
import Modal from './Modal';

interface BlockedUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (!user) return;
      const { data: blockedData } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('user_id', user.id);

      if (blockedData?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', blockedData.map(b => b.blocked_user_id));
        setBlockedUsers(profiles || []);
      }
    };

    fetchBlockedUsers();
  }, [user]);

  const handleUnblock = async (userId: string) => {
    if (!user) return;
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

        <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-xl mb-4">blocked users</h2>
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
                    className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
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

        {/* Block User Form */}
        <div className="mt-8">
          <h2 className="text-xl mb-4">block a user</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!user) return;
              const form = e.target as HTMLFormElement;
              const usernameInput = form.elements.namedItem('block-username') as HTMLInputElement;
              const username = usernameInput.value.trim();
              if (!username) return;
              // Look up user by username
              const { data: foundUser, error } = await supabase
                .from('profiles')
                .select('user_id, username, avatar_url')
                .eq('username', username)
                .single();
              if (error || !foundUser) {
                alert('User not found');
                return;
              }
              if (foundUser.user_id === user.id) {
                alert('You cannot block yourself');
                return;
              }
              // Check if already blocked
              if (blockedUsers.some(u => u.user_id === foundUser.user_id)) {
                alert('User is already blocked');
                return;
              }
              // Block user
              const { error: blockError } = await supabase
                .from('blocked_users')
                .insert({ user_id: user.id, blocked_user_id: foundUser.user_id });
              if (blockError) {
                alert('Failed to block user');
                return;
              }
              setBlockedUsers(prev => [...prev, foundUser]);
              usernameInput.value = '';
            }}
            className="flex gap-2 items-center"
          >
            <input
              type="text"
              name="block-username"
              placeholder="username to block"
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-transparent"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl hover:opacity-80 transition-opacity"
              style={{ color: 'var(--danger)' }}
            >
              block
            </button>
          </form>
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