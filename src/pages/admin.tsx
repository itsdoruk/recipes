import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Modal from 'react-modal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_admin: boolean;
  banned?: boolean;
  warnings?: number;
  created_at: string;
  ban_expiry?: string;
}

interface Recipe {
  id: string;
  title: string;
  image_url: string;
  created_at: string;
  user_id: string;
}

export default function AdminPanel() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userWarnings, setUserWarnings] = useState<any[]>([]);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningTargetUser, setWarningTargetUser] = useState<Profile | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkWarningReason, setBulkWarningReason] = useState('');
  const [showBulkWarningModal, setShowBulkWarningModal] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    checkAdminStatus();
    fetchAuditLog();
  }, [user, router]);

  const checkAdminStatus = async () => {
    try {
      console.log('Checking admin status for user:', user?.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')  // Select all fields for debugging
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      console.log('Profile data:', data);

      if (!data?.is_admin) {
        console.log('User is not an admin');
        router.push('/');
        return;
      }

      console.log('User is admin, proceeding to admin panel');
      setIsAdmin(true);
      fetchData();
    } catch (err) {
      console.error('Error checking admin status:', err);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch recipes
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (recipesError) throw recipesError;
      setRecipes(recipesData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const fetchAuditLog = async () => {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setAuditLog(data || []);
  };

  const logAdminAction = async (action: string, targetUserId: string, details: any = {}) => {
    await supabase.from('admin_audit_log').insert({
      admin_id: user?.id,
      action,
      target_user_id: targetUserId,
      details,
    });
    fetchAuditLog();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      await fetchData();
      await logAdminAction('delete_user', userId, {});
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;

      await fetchData();
    } catch (err) {
      console.error('Error deleting recipe:', err);
    }
  };

  const handleBanToggle = async (userId: string, banned: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ banned: !banned })
        .eq('user_id', userId);
      if (error) throw error;
      await fetchData();
      await logAdminAction(banned ? 'unban' : 'ban', userId, {});
    } catch (err) {
      console.error('Error updating ban status:', err);
    }
  };

  const handleWarningChange = async (userId: string, warnings: number, delta: number) => {
    try {
      const newWarnings = Math.max(0, (warnings || 0) + delta);
      const { error } = await supabase
        .from('profiles')
        .update({ warnings: newWarnings })
        .eq('user_id', userId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error updating warnings:', err);
    }
  };

  const handleBanExpiryChange = async (userId: string, date: Date | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ban_expiry: date ? date.toISOString() : null })
        .eq('user_id', userId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error updating ban expiry:', err);
    }
  };

  const openUserModal = async (user: Profile) => {
    setSelectedUser(user);
    setUserModalOpen(true);
    // Fetch warnings
    const { data: warningsData } = await supabase
      .from('warnings')
      .select('*')
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false });
    setUserWarnings(warningsData || []);
    // Fetch recent activity (recipes)
    const { data: activityData } = await supabase
      .from('recipes')
      .select('id, title, created_at')
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false })
      .limit(5);
    setUserActivity(activityData || []);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    setSelectedUser(null);
    setUserWarnings([]);
    setUserActivity([]);
  };

  const openWarningModal = (user: Profile) => {
    setWarningTargetUser(user);
    setWarningReason('');
    setShowWarningModal(true);
  };

  const closeWarningModal = () => {
    setShowWarningModal(false);
    setWarningTargetUser(null);
    setWarningReason('');
  };

  const handleAddWarning = async () => {
    if (!warningTargetUser || !warningReason.trim()) return;
    try {
      const { error } = await supabase
        .from('warnings')
        .insert({
          user_id: warningTargetUser.user_id,
          admin_id: user?.id,
          reason: warningReason.trim()
        });
      if (error) throw error;
      closeWarningModal();
      await fetchData();
      if (selectedUser && selectedUser.user_id === warningTargetUser.user_id) {
        openUserModal(selectedUser); // Refresh modal data
      }
      await logAdminAction('add_warning', warningTargetUser.user_id, { reason: warningReason.trim() });
    } catch (err) {
      console.error('Error adding warning:', err);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const selectAllUsers = (userIds: string[]) => {
    setSelectedUserIds(userIds);
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };

  const handleBulkBan = async (ban: boolean) => {
    try {
      await supabase
        .from('profiles')
        .update({ banned: ban })
        .in('user_id', selectedUserIds);
      for (const userId of selectedUserIds) {
        await logAdminAction(ban ? 'ban' : 'unban', userId, { bulk: true });
      }
      await fetchData();
      clearSelectedUsers();
    } catch (err) {
      console.error('Error in bulk ban/unban:', err);
    }
  };

  const openBulkWarningModal = () => {
    setBulkWarningReason('');
    setShowBulkWarningModal(true);
  };

  const closeBulkWarningModal = () => {
    setShowBulkWarningModal(false);
    setBulkWarningReason('');
  };

  const handleBulkWarning = async () => {
    if (!bulkWarningReason.trim()) return;
    try {
      for (const userId of selectedUserIds) {
        await supabase
          .from('warnings')
          .insert({
            user_id: userId,
            admin_id: user?.id,
            reason: bulkWarningReason.trim()
          });
        await logAdminAction('add_warning', userId, { reason: bulkWarningReason.trim(), bulk: true });
      }
      await fetchData();
      clearSelectedUsers();
      closeBulkWarningModal();
    } catch (err) {
      console.error('Error in bulk warning:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="">loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Head>
        <title>admin panel</title>
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">admin panel</h1>
          </div>

          <div>
            <h2 className="text-xl mb-4">users</h2>
            <input
              type="text"
              placeholder="search by username or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-4 px-3 py-2 border border-gray-200 dark:border-gray-800 w-full"
            />
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedUserIds.length === users.length && users.length > 0}
                  onChange={e => selectAllUsers(e.target.checked ? users.map(u => u.user_id) : [])}
                />
                <span className="text-sm">Select All</span>
                {selectedUserIds.length > 0 && (
                  <div className="ml-4 flex gap-2 items-center" style={{ background: 'var(--background)', border: '1px solid var(--outline)', color: 'var(--foreground)' }}>
                    <span className="font-semibold">Bulk actions:</span>
                    <button onClick={() => handleBulkBan(true)} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--danger)', background: 'var(--background)', borderRadius: 0 }}>Ban</button>
                    <button onClick={() => handleBulkBan(false)} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--accent)', background: 'var(--background)', borderRadius: 0 }}>Unban</button>
                    <button onClick={openBulkWarningModal} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--warning)', background: 'var(--background)', borderRadius: 0 }}>+ Warning</button>
                    <button onClick={clearSelectedUsers} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--foreground)', background: 'var(--background)', borderRadius: 0 }}>Clear</button>
                  </div>
                )}
              </div>
              {users.filter(u =>
                (!search ||
                  (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
                  (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
                )
              ).map((user) => (
                <div
                  key={user.user_id}
                  className={`p-4 border flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 shadow-sm`}
                  style={{ background: 'var(--background)', borderColor: user.banned ? 'var(--danger)' : 'var(--outline)', color: 'var(--foreground)' }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.user_id)}
                      onChange={() => toggleUserSelection(user.user_id)}
                    />
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => openUserModal(user)}>
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username || 'avatar'} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-xl font-bold text-gray-300">{user.username?.[0]?.toUpperCase() || 'A'}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-lg flex items-center gap-2">
                          {user.username || 'anonymous'}
                          {user.is_admin && <span className="text-blue-400 text-xs font-bold border border-blue-400px-1">admin</span>}
                          {user.banned && <span className="text-red-400 text-xl ml-1">🔒</span>}
                          {user.warnings && user.warnings > 0 && <span className="text-yellow-400 text-xl ml-1">⚠️</span>}
                        </div>
                        <div className="text-sm text-gray-500">{user.email || user.user_id}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBanToggle(user.user_id, !!user.banned)}
                      className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: user.banned ? 'var(--accent)' : 'var(--danger)', background: 'var(--background)', borderRadius: 0 }}
                    >
                      {user.banned ? 'unban' : 'ban'}
                    </button>
                    <div className="flex items-center">
                      <DatePicker
                        selected={user.ban_expiry ? new Date(user.ban_expiry) : null}
                        onChange={date => handleBanExpiryChange(user.user_id, date)}
                        showTimeSelect
                        dateFormat="Pp"
                        placeholderText="Select expiry date"
                        isClearable
                        className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    </div>
                    <button
                      onClick={() => openWarningModal(user)}
                      className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--warning)', background: 'var(--background)', borderRadius: 0 }}
                    >
                      + warning
                    </button>
                    <span className="text-lg font-bold" style={{ color: 'var(--warning)' }}>{user.warnings || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">recipes</h2>
            <div className="space-y-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="p-4 border border-gray-200 dark:border-gray-800 flex justify-between items-center"
                >
                  <div>
                    <p className="">{recipe.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRecipe(recipe.id)}
                    className="px-3 py-2 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 transition-opacity "
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">audit log</h2>
            <input
              type="text"
              placeholder="search audit log..."
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              className="mb-4 px-3 py-2 border border-gray-200 dark:border-gray-800 w-full"
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLog.filter(log =>
                !auditSearch ||
                (log.action && log.action.toLowerCase().includes(auditSearch.toLowerCase())) ||
                (log.details && JSON.stringify(log.details).toLowerCase().includes(auditSearch.toLowerCase()))
              ).map(log => (
                <div key={log.id} className="p-2 border border-gray-200 dark:border-gray-800flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
                  <div>
                    <span className="font-semibold">{log.action}</span> on user <span className="text-blue-600">{log.target_user_id}</span>
                    {log.details && <span className="ml-2 text-xs text-gray-500">{JSON.stringify(log.details)}</span>}
                  </div>
                  <div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Modal
        isOpen={userModalOpen}
        onRequestClose={closeUserModal}
        contentLabel="User Details"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-lg w-full border" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)', borderRadius: 0 }}>
          <h2 className="text-2xl font-bold mb-4">User Details</h2>
          {selectedUser && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.username || 'avatar'} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-2xl font-bold text-gray-300">{selectedUser.username?.[0]?.toUpperCase() || 'A'}</span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-xl flex items-center gap-2">
                    {selectedUser.username || 'anonymous'}
                    {selectedUser.is_admin && <span className="text-blue-400 text-xs font-bold border border-blue-400px-1">admin</span>}
                    {selectedUser.banned && <span className="text-red-400 text-xl ml-1">🔒</span>}
                  </div>
                  <div className="text-sm text-gray-500">{selectedUser.email || selectedUser.user_id}</div>
                </div>
              </div>
              <div className="mb-2">
                <span className="font-semibold">Registration date:</span> {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Ban expiry:</span> {selectedUser.ban_expiry ? new Date(selectedUser.ban_expiry).toLocaleString() : 'N/A'}
              </div>
              <div className="mb-4">
                <span className="font-semibold">Warnings:</span>
                <ul className="list-disc ml-6 mt-1">
                  {userWarnings.length === 0 && <li className="text-gray-500">No warnings</li>}
                  {userWarnings.map(w => (
                    <li key={w.id} className="mb-1">
                      <span className="text-yellow-700">⚠️</span> {w.reason} <span className="text-xs text-gray-400">({new Date(w.created_at).toLocaleDateString()})</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mb-4">
                <span className="font-semibold">Recent Activity:</span>
                <ul className="list-disc ml-6 mt-1">
                  {userActivity.length === 0 && <li className="text-gray-500">No recent recipes</li>}
                  {userActivity.map(a => (
                    <li key={a.id}>{a.title} <span className="text-xs text-gray-400">({new Date(a.created_at).toLocaleDateString()})</span></li>
                  ))}
                </ul>
              </div>
              <button onClick={closeUserModal} className="mt-4 px-4 py-2 border cursor-pointer hover:opacity-80" style={{ borderColor: 'var(--outline)', background: 'var(--background)', color: 'var(--foreground)', borderRadius: 0 }}>Close</button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showWarningModal}
        onRequestClose={closeWarningModal}
        contentLabel="Add Warning"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-md w-full border" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)', borderRadius: 0 }}>
          <h2 className="text-xl font-bold mb-4">Add Warning</h2>
          <p className="mb-2">Enter a reason for the warning:</p>
          <textarea
            className="w-full border p-2 mb-4"
            style={{ borderColor: 'var(--outline)', background: 'var(--background)', color: 'var(--foreground)', borderRadius: 0 }}
            rows={3}
            value={warningReason}
            onChange={e => setWarningReason(e.target.value)}
            placeholder="Reason for warning..."
          />
          <div className="flex gap-2 justify-end">
            <button onClick={closeWarningModal} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--foreground)', background: 'var(--background)', borderRadius: 0 }}>Cancel</button>
            <button onClick={handleAddWarning} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--warning)', background: 'var(--background)', borderRadius: 0 }}>Add Warning</button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showBulkWarningModal}
        onRequestClose={closeBulkWarningModal}
        contentLabel="Bulk Add Warning"
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/50"
        ariaHideApp={false}
      >
        <div className="p-8 shadow-2xl max-w-md w-full border" style={{ background: 'var(--background)', borderColor: 'var(--outline)', color: 'var(--foreground)', borderRadius: 0 }}>
          <h2 className="text-xl font-bold mb-4">Bulk Add Warning</h2>
          <p className="mb-2">Enter a reason for the warning to all selected users:</p>
          <textarea
            className="w-full border p-2 mb-4"
            style={{ borderColor: 'var(--outline)', background: 'var(--background)', color: 'var(--foreground)', borderRadius: 0 }}
            rows={3}
            value={bulkWarningReason}
            onChange={e => setBulkWarningReason(e.target.value)}
            placeholder="Reason for warning..."
          />
          <div className="flex gap-2 justify-end">
            <button onClick={closeBulkWarningModal} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--foreground)', background: 'var(--background)', borderRadius: 0 }}>Cancel</button>
            <button onClick={handleBulkWarning} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--warning)', background: 'var(--background)', borderRadius: 0 }}>Add Warning</button>
          </div>
        </div>
      </Modal>
    </>
  );
}