import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Modal from 'react-modal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Profile } from '@/types';
import { toLower } from '@/utils/text';
import Avatar from '@/components/Avatar';

// Lazy load modals
const UserModal = lazy(() => import('@/components/admin/UserModal'));
const WarningModal = lazy(() => import('@/components/admin/WarningModal'));
const BulkWarningModal = lazy(() => import('@/components/admin/BulkWarningModal'));

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
  const [error, setError] = useState<string | null>(null);
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
  const [filter, setFilter] = useState<'all' | 'banned' | 'warned'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (!data?.is_admin) {
        router.push('/');
        return;
      }

      setIsAdmin(true);
      fetchData();
    } catch (err) {
      console.error('Error checking admin status:', err);
      router.push('/');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch users with pagination
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch recipes with pagination
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (recipesError) throw recipesError;
      setRecipes(recipesData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data. Please try again.');
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAuditLog(data || []);
  }, []);

  const logAdminAction = async (action: string, targetUserId: string, details: any = {}) => {
    try {
      // First check if the admin_audit_log table exists
      const { error: tableCheckError } = await supabase
        .from('admin_audit_log')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.error('Error checking admin_audit_log table:', tableCheckError);
        throw new Error('Admin audit log table not available');
      }

      // Insert the log entry
      const { error: insertError } = await supabase
        .from('admin_audit_log')
        .insert({
          admin_id: user?.id,
          action,
          target_user_id: targetUserId,
          details,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error inserting audit log:', insertError);
        throw new Error(`Failed to log admin action: ${insertError.message}`);
      }

      // Update local audit log immediately
      const newLog = {
        id: Date.now().toString(), // Temporary ID for local state
        admin_id: user?.id,
        action,
        target_user_id: targetUserId,
        details,
        created_at: new Date().toISOString()
      };
      
      setAuditLog(prev => [newLog, ...prev]);
    } catch (err) {
      console.error('Error in logAdminAction:', err);
      setError(err instanceof Error ? err.message : 'Failed to log admin action');
      // Don't throw the error, just log it and continue
      // This way, even if logging fails, the main action (ban/warning) can still succeed
    }
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
      // Get current user data
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userError) throw userError;

      // Prepare update data
      const updateData: Partial<Profile> = {
        banned: !banned,
        ban_type: !banned ? 'permanent' : null,
        ban_reason: !banned ? 'Admin action' : null,
        ban_expiry: null,
        last_ban_date: !banned ? new Date().toISOString() : null,
        ban_count: !banned ? (userData.ban_count || 0) + 1 : userData.ban_count
      };

      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Add to ban history
      if (!banned) {
        const { error: historyError } = await supabase
          .from('ban_history')
          .insert({
            user_id: userId,
            admin_id: user?.id,
            ban_type: 'permanent',
            reason: 'Admin action',
            ban_start: new Date().toISOString(),
            is_active: true
          });

        if (historyError) {
          console.error('Error adding to ban history:', historyError);
        }
      }

      // Update local state with the complete user data
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, ...updateData } : u
      ));

      // Log the action
      await logAdminAction(banned ? 'unban' : 'ban', userId, {
        ban_type: updateData.ban_type,
        ban_reason: updateData.ban_reason
      });

      // Refresh data to ensure consistency
      await fetchData();
    } catch (err) {
      console.error('error in handleBanToggle:', err);
      setError(err instanceof Error ? err.message : 'failed to update ban status');
    }
  };

  const handleWarningChange = async (userId: string, warnings: boolean, delta: number) => {
    try {
      const newWarnings = Math.max(0, (warnings ? 1 : 0) + delta);
      const { error } = await supabase
        .from('profiles')
        .update({ warnings: newWarnings > 0 })
        .eq('user_id', userId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error updating warnings:', err);
    }
  };

  const handleBanExpiryChange = async (userId: string, date: Date | null) => {
    try {
      // Get current user data
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userError) throw userError;

      // Prepare update data
      const updateData: Partial<Profile> = {
        ban_expiry: date ? date.toISOString() : null,
        banned: !!date,
        ban_type: date ? 'temporary' : null,
        ban_reason: date ? 'Temporary ban' : null,
        last_ban_date: date ? new Date().toISOString() : null,
        ban_count: date ? (userData.ban_count || 0) + 1 : userData.ban_count
      };

      // Update the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Add to ban history if setting a ban
      if (date) {
        const { error: historyError } = await supabase
          .from('ban_history')
          .insert({
            user_id: userId,
            admin_id: user?.id,
            ban_type: 'temporary',
            reason: 'Temporary ban',
            ban_start: new Date().toISOString(),
            ban_end: date.toISOString(),
            is_active: true
          });

        if (historyError) {
          console.error('Error adding to ban history:', historyError);
        }
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, ...updateData } : u
      ));

      // Log the action
      await logAdminAction('update_ban_expiry', userId, {
        ban_expiry: updateData.ban_expiry,
        ban_type: updateData.ban_type,
        ban_reason: updateData.ban_reason
      });
    } catch (err) {
      console.error('Error in handleBanExpiryChange:', err);
      setError(err instanceof Error ? err.message : 'Failed to update ban expiry');
    }
  };

  // Optimize user modal opening
  const openUserModal = useCallback(async (user: Profile) => {
    setSelectedUser(user);
    setUserModalOpen(true);
    // Fetch warnings and activity in parallel
    const [warningsResponse, activityResponse] = await Promise.all([
      supabase
        .from('warnings')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('recipes')
        .select('id, title, created_at')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);
    setUserWarnings(warningsResponse.data || []);
    setUserActivity(activityResponse.data || []);
  }, []);

  // Optimize warning modal
  const openWarningModal = useCallback((user: Profile) => {
    setWarningTargetUser(user);
    setWarningReason('');
    setShowWarningModal(true);
  }, []);

  const closeWarningModal = useCallback(() => {
    setShowWarningModal(false);
    setWarningTargetUser(null);
    setWarningReason('');
  }, []);

  // Optimize bulk warning modal
  const openBulkWarningModal = useCallback(() => {
    setBulkWarningReason('');
    setShowBulkWarningModal(true);
  }, []);

  const closeBulkWarningModal = useCallback(() => {
    setShowBulkWarningModal(false);
    setBulkWarningReason('');
  }, []);

  const handleAddWarning = async () => {
    if (!warningTargetUser || !warningReason.trim()) return;
    try {
      // First add the warning record
      const { error: warningError } = await supabase
        .from('warnings')
        .insert({
          user_id: warningTargetUser.user_id,
          admin_id: user?.id,
          reason: warningReason.trim()
        });
      if (warningError) throw warningError;

      // Then update the user's warning count
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          warnings: (warningTargetUser.warnings || 0) + 1 
        })
        .eq('user_id', warningTargetUser.user_id);
      if (profileError) throw profileError;

      // Update local state immediately
      setUsers(prev => prev.map(u => 
        u.user_id === warningTargetUser.user_id 
          ? { ...u, warnings: (u.warnings || 0) + 1 } 
          : u
      ));

      closeWarningModal();
      if (selectedUser && selectedUser.user_id === warningTargetUser.user_id) {
        openUserModal({ ...selectedUser, warnings: (selectedUser.warnings || 0) + 1 });
      }
      await logAdminAction('add_warning', warningTargetUser.user_id, { reason: warningReason.trim() });
    } catch (err) {
      console.error('Error adding warning:', err);
      setError('Failed to add warning');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const selectAllUsers = (userIds: string[]) => {
    setSelectedUserIds(userIds.filter(id => filteredUsers.some(user => user.user_id === id)));
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };

  const handleBulkBan = async (ban: boolean) => {
    try {
      // First verify all users exist
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('user_id, banned')
        .in('user_id', selectedUserIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw new Error(`Failed to fetch users: ${usersError.message}`);
      }
      if (!usersData || usersData.length !== selectedUserIds.length) {
        throw new Error('Some users not found');
      }

      // Prepare update data
      const updateData: Partial<Profile> = {
        banned: ban,
        ban_type: ban ? ('permanent' as const) : null,
        ban_reason: ban ? 'Bulk admin action' : null,
        ban_expiry: null,
        last_ban_date: ban ? new Date().toISOString() : null
      };

      // Update all selected users in a single query
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .in('user_id', selectedUserIds);

      if (updateError) {
        console.error('Error in bulk ban/unban:', updateError);
        throw new Error(`Failed to update ban status: ${updateError.message}`);
      }

      // Add to ban history for each user
      if (ban) {
        const banHistoryEntries = selectedUserIds.map(userId => ({
          user_id: userId,
          admin_id: user?.id,
          ban_type: 'permanent' as const,
          reason: 'Bulk admin action',
          ban_start: new Date().toISOString(),
          is_active: true
        }));

        const { error: historyError } = await supabase
          .from('ban_history')
          .insert(banHistoryEntries);

        if (historyError) {
          console.error('Error adding to ban history:', historyError);
        }
      }

      // Update local state immediately
      setUsers(prev => prev.map(u => 
        selectedUserIds.includes(u.user_id) 
          ? { ...u, ...updateData } 
          : u
      ));

      // Log each action
      for (const userId of selectedUserIds) {
        await logAdminAction(ban ? 'ban' : 'unban', userId, { 
          bulk: true,
          ban_type: updateData.ban_type,
          ban_reason: updateData.ban_reason,
          previous_status: !ban,
          new_status: ban
        });
      }
      clearSelectedUsers();
    } catch (err) {
      console.error('Error in handleBulkBan:', err);
      setError(err instanceof Error ? err.message : 'Failed to update ban status');
    }
  };

  const handleBulkWarning = async () => {
    if (!bulkWarningReason.trim()) return;
    try {
      // Add warnings for all selected users
      const warningPromises = selectedUserIds.map(userId =>
        supabase
          .from('warnings')
          .insert({
            user_id: userId,
            admin_id: user?.id,
            reason: bulkWarningReason.trim()
          })
      );
      await Promise.all(warningPromises);

      // Update warning counts for all users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, warnings')
        .in('user_id', selectedUserIds);
      
      if (profileError) throw profileError;

      // Update each user's warning count
      const updatePromises = profiles.map(profile =>
        supabase
          .from('profiles')
          .update({ warnings: (profile.warnings || 0) + 1 })
          .eq('user_id', profile.user_id)
      );
      await Promise.all(updatePromises);

      // Update local state immediately
      setUsers(prev => prev.map(u => 
        selectedUserIds.includes(u.user_id) 
          ? { ...u, warnings: (u.warnings || 0) + 1 } 
          : u
      ));

      clearSelectedUsers();
      closeBulkWarningModal();
    } catch (err) {
      console.error('Error in bulk warning:', err);
      setError('Failed to add warnings');
    }
  };

  // Add visibility change handler to prevent reload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh data when tab becomes visible again
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  // Memoize filtered users to prevent unnecessary re-renders
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // First apply the filter
      if (filter === 'banned' && !u.banned) return false;
      if (filter === 'warned' && (!u.warnings || u.warnings === 0)) return false;
      
      // Then apply the search
      if (!search) return true;
      return (
        (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [users, search, filter]);

  // Memoize filtered audit log with better search
  const filteredAuditLog = useMemo(() => {
    if (!auditSearch) return auditLog;

    const searchLower = auditSearch.toLowerCase();
    return auditLog.filter(log => {
      const actionMatch = log.action?.toLowerCase().includes(searchLower);
      let detailsMatch = false;
      try {
        detailsMatch = log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower);
      } catch (err) {
        console.error('Error stringifying log details:', err);
        // If we can't stringify the details, just check if the details object exists
        detailsMatch = !!log.details;
      }
      const targetUserMatch = log.target_user_id?.toLowerCase().includes(searchLower);
      const adminMatch = log.admin_id?.toLowerCase().includes(searchLower);
      const dateMatch = new Date(log.created_at).toLocaleString().toLowerCase().includes(searchLower);

      return actionMatch || detailsMatch || targetUserMatch || adminMatch || dateMatch;
    });
  }, [auditLog, auditSearch]);

  // Format audit log details for display
  const formatAuditLogDetails = (log: any) => {
    const details = log.details || {};
    const formattedDetails = [];

    if (details.reason) {
      formattedDetails.push(`reason: ${toLower(details.reason)}`);
    }
    if (details.bulk) {
      formattedDetails.push('bulk action');
    }
    if (Object.keys(details).length > 0) {
      return formattedDetails.join(' | ');
    }
    return null;
  };

  // Format action for display
  const formatAction = (action: string) => {
    return toLower(action)
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Debounce search input
  const debouncedSearch = useCallback((value: string) => {
    const timeoutId = setTimeout(() => {
      setSearch(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  // Add save function
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Refresh all data to ensure consistency
      await Promise.all([
        fetchData(),
        fetchAuditLog()
      ]);
      setSaveMessage('changes saved successfully');
    } catch (err) {
      console.error('Error saving changes:', err);
      setSaveMessage('error saving changes');
    } finally {
      setIsSaving(false);
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{toLower('admin panel')}</title>
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">{toLower('admin panel')}</h1>
            <div className="flex items-center gap-4">
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes('error') ? 'text-red-500' : 'text-green-500'}`}>
                  {toLower(saveMessage)}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--background)', color: 'var(--foreground)' }}
              >
                {isSaving ? toLower('saving...') : toLower('save changes')}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex flex-col items-center gap-4 p-8 border border-red-400 bg-red-50 dark:bg-red-900/20 shadow-md">
              <span className="text-6xl">⚠️</span>
              <h2 className="text-2xl font-bold">{toLower('error')}</h2>
              <p className="text-lg text-center">{toLower(error)}</p>
            </div>
          )}

          <div>
            <h2 className="text-xl mb-4">{toLower('users')}</h2>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder={toLower('search by username or email...')}
                onChange={e => debouncedSearch(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 w-full"
              />
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'banned' | 'warned')}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800"
              >
                <option value="all">{toLower('all users')}</option>
                <option value="banned">{toLower('banned users')}</option>
                <option value="warned">{toLower('warned users')}</option>
              </select>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedUserIds.length === users.length && users.length > 0}
                  onChange={e => selectAllUsers(e.target.checked ? users.map(u => u.user_id) : [])}
                />
                <span className="text-sm">{toLower('select all')}</span>
                {selectedUserIds.length > 0 && (
                  <div className="ml-4 flex gap-2 items-center" style={{ background: 'var(--background)', border: '1px solid var(--outline)', color: 'var(--foreground)' }}>
                    <span className="font-semibold">{toLower('bulk actions:')}</span>
                    <button onClick={() => handleBulkBan(true)} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--danger)', background: 'var(--background)' }}>{toLower('ban')}</button>
                    <button onClick={() => handleBulkBan(false)} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--accent)', background: 'var(--background)' }}>{toLower('unban')}</button>
                    <button onClick={openBulkWarningModal} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--warning)', background: 'var(--background)' }}>{toLower('+ warning')}</button>
                    <button onClick={clearSelectedUsers} className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: 'var(--foreground)', background: 'var(--background)' }}>{toLower('clear')}</button>
                  </div>
                )}
              </div>
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-gray-400 bg-gray-50 dark:bg-gray-900/20 shadow-md">
                  <span className="text-6xl">🔍</span>
                  <h2 className="text-2xl font-bold">{toLower('no users found')}</h2>
                  <p className="text-lg text-center">{toLower('try adjusting your search or filter criteria')}</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
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
                        <div className="w-12 h-12 overflow-hidden rounded-full flex items-center justify-center">
                          <Avatar avatar_url={user.avatar_url} username={user.username} size={48} />
                        </div>
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {toLower(user.username || 'anonymous')}
                            {user.is_admin && <span className="text-blue-400 text-xs font-bold border border-blue-400 px-1">{toLower('admin')}</span>}
                            {user.banned && <span className="text-red-400 text-xl ml-1">🔒</span>}
                            {user.warnings && user.warnings > 0 && <span className="text-yellow-400 text-xl ml-1">⚠️</span>}
                          </div>
                          <div className="text-sm text-gray-500">{toLower(user.email || user.user_id)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBanToggle(user.user_id, !!user.banned)}
                        className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ color: user.banned ? 'var(--accent)' : 'var(--danger)', background: 'var(--background)' }}
                      >
                        {toLower(user.banned ? 'unban' : 'ban')}
                      </button>
                      <div className="flex items-center">
                        <DatePicker
                          selected={user.ban_expiry ? new Date(user.ban_expiry) : null}
                          onChange={date => handleBanExpiryChange(user.user_id, date)}
                          showTimeSelect
                          dateFormat="Pp"
                          placeholderText={toLower('select expiry date')}
                          isClearable
                          className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      </div>
                      <button
                        onClick={() => openWarningModal(user)}
                        className="px-3 py-1 border border-gray-200 dark:border-gray-800 font-medium cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--warning)', background: 'var(--background)' }}
                      >
                        {toLower('+ Warning')}
                      </button>
                      <span className="text-lg font-bold" style={{ color: 'var(--warning)' }}>{user.warnings ? 1 : 0}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">{toLower('recipes')}</h2>
            <div className="space-y-4">
              {recipes.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-gray-400 bg-gray-50 dark:bg-gray-900/20 shadow-md">
                  <span className="text-6xl">📝</span>
                  <h2 className="text-2xl font-bold">{toLower('no recipes found')}</h2>
                  <p className="text-lg text-center">{toLower('there are no recipes in the system yet')}</p>
                </div>
              ) : (
                recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="p-4 border border-gray-200 dark:border-gray-800 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{toLower(recipe.title)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(recipe.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRecipe(recipe.id)}
                      className="px-3 py-2 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 transition-opacity"
                    >
                      {toLower('delete')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl mb-4">{toLower('audit log')}</h2>
            <input
              type="text"
              placeholder={toLower('search audit log...')}
              onChange={e => setAuditSearch(e.target.value)}
              className="mb-4 px-3 py-2 border border-gray-200 dark:border-gray-800 w-full"
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAuditLog.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-gray-400 bg-gray-50 dark:bg-gray-900/20 shadow-md">
                  <span className="text-6xl">📋</span>
                  <h2 className="text-2xl font-bold">{toLower('no audit logs')}</h2>
                  <p className="text-lg text-center">{toLower('no audit logs found for the current search')}</p>
                </div>
              ) : (
                filteredAuditLog.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-medium">{toLower(formatAction(log.action))}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                        {formatAuditLogDetails(log) && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {toLower(formatAuditLogDetails(log))}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        <p>{toLower('admin id:')} {toLower(log.admin_id)}</p>
                        <p>{toLower('target user:')} {toLower(log.target_user_id)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <Suspense fallback={null}>
        {userModalOpen && selectedUser && (
          <UserModal
            isOpen={userModalOpen}
            user={selectedUser}
            warnings={userWarnings}
            activity={userActivity}
            onClose={() => setUserModalOpen(false)}
          />
        )}
        {showWarningModal && warningTargetUser && (
          <WarningModal
            isOpen={showWarningModal}
            user={warningTargetUser}
            onClose={closeWarningModal}
            onAddWarning={handleAddWarning}
            warningReason={warningReason}
            setWarningReason={setWarningReason}
          />
        )}
        {showBulkWarningModal && (
          <BulkWarningModal
            isOpen={showBulkWarningModal}
            onClose={closeBulkWarningModal}
            onAddWarning={handleBulkWarning}
            warningReason={bulkWarningReason}
            setWarningReason={setBulkWarningReason}
          />
        )}
      </Suspense>
    </>
  );
}