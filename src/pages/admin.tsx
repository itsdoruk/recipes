import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { checkAdminStatus } from '@/lib/admin';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { SupabaseClient } from '@supabase/supabase-js';
import Modal from 'react-modal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Profile } from '@/types/supabase';
import { toLower } from '@/utils/text';
import Avatar from '@/components/Avatar';
import ModalWrapper from '@/components/admin/ModalWrapper';
import Link from 'next/link';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import RefreshWarnings from '@/components/RefreshWarnings';

// Lazy load modals
const UserModal = lazy(() => import('@/components/admin/UserModal'));
const WarningModal = lazy(() => import('@/components/admin/WarningModal'));
const BulkWarningModal = lazy(() => import('@/components/admin/BulkWarningModal'));

type ProfileData = {
  id?: string;
  user_id: string;
  username?: string;
  full_name?: string;
  email?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean;
  warnings?: number;
  banned?: boolean;
  ban_type?: string | null;
  ban_reason?: string | null;
  ban_expiry?: string | null;
  last_ban_date?: string | null;
  ban_count?: number;
  created_at?: string;
  updated_at?: string;
  bio?: string;
  is_private?: boolean;
  show_email?: boolean;
};

type ProfileUpdate = Partial<ProfileData>;

type ProfileResponse = {
  user_id: string;
  warnings: number;
};

export default function AdminPanel() {
  const router = useRouter();
  const user = useUser();
  const { session, loading: sessionLoading } = useAuth();
  const { profile, isLoading: profileLoading, refreshProfile } = useProfile();
  const supabase = useSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ProfileData[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ProfileData | null>(null);
  const [userWarnings, setUserWarnings] = useState<any[]>([]);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningTargetUser, setWarningTargetUser] = useState<ProfileData | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkWarningReason, setBulkWarningReason] = useState('');
  const [showBulkWarningModal, setShowBulkWarningModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'banned' | 'warned'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [reportStatus, setReportStatus] = useState<'under review' | 'resolved' | 'all'>('under review');
  const [tab, setTab] = useState('users');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isAdminNotesModalOpen, setIsAdminNotesModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  // Add a function to refresh the session
  const refreshSessionBeforeApiCall = useCallback(async () => {
    if (!supabase) return false;
    
    try {
      console.log('Refreshing session before API call');
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return false;
      }
      
      if (data && data.session) {
        console.log('Session refreshed successfully');
        return true;
      } else {
        console.error('No session after refresh');
        return false;
      }
    } catch (err) {
      console.error('Exception during session refresh:', err);
      return false;
    }
  }, [supabase]);

  // Add a function to handle session loss and recovery
  const ensureAuthenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!session) {
      console.error('No session available for fetch');
      throw new Error('Authentication required');
    }
    
    // First attempt with current session
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(options.headers || {})
        }
      });
      
      if (response.status === 401) {
        console.log('Received 401, attempting session refresh');
        
        // Try to refresh the session
        const refreshed = await refreshSessionBeforeApiCall();
        if (!refreshed || !session) {
          throw new Error('Session refresh failed');
        }
        
        // Retry with new token
        return fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...(options.headers || {})
          }
        });
      }
      
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }, [session, refreshSessionBeforeApiCall]);

  const fetchReports = useCallback(async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('reports_with_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error in fetchReports:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    }
  }, [supabase]);

  const fetchAuditLog = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching audit log:', error);
        return;
      }

      setAuditLog(data || []);
    } catch (err) {
      console.error('Error in fetchAuditLog:', err);
    }
  }, [supabase, user]);

  const fetchData = useCallback(async () => {
    if (!supabase || !user) return;

    try {
      const [usersResponse, recipesResponse] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('recipes').select('*').eq('recipe_type', 'user')
      ]);

      if (usersResponse.error) throw usersResponse.error;
      if (recipesResponse.error) throw recipesResponse.error;

      setUsers(usersResponse.data || []);
      setRecipes(recipesResponse.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  }, [supabase, user]);

  // Handle authentication and admin check
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (sessionLoading || profileLoading) {
        console.log('Still loading session or profile...');
        return;
      }
      
      if (!session) {
        console.log('No session found, redirecting to login');
        router.push('/login?redirectTo=/admin');
        return;
      }

      try {
        // First check if user has a profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          router.push('/');
          return;
        }

        if (!profileData?.is_admin) {
          console.log('User is not an admin, redirecting to home');
          router.push('/');
          return;
        }

        // If we get here, user is authenticated and is an admin
        console.log('User is authenticated and is an admin');
        setIsAdmin(true);
        setIsLoading(false);
        
        // Fetch initial data
        await Promise.all([
          fetchData(),
          fetchAuditLog(),
          fetchReports()
        ]);
      } catch (err) {
        console.error('Error in admin check:', err);
        setError('Failed to verify admin status');
        router.push('/');
      }
    };

    checkAdminStatus();
  }, [session, sessionLoading, profileLoading, router, fetchData, fetchAuditLog, fetchReports, supabase]);

  // Add a useEffect to fetch audit log when the tab changes to 'audit'
  useEffect(() => {
    if (tab === 'audit') {
      fetchAuditLog();
    }
  }, [tab, fetchAuditLog]);

  // Add a useEffect to fetch reports when the tab changes to 'reports'
  useEffect(() => {
    if (tab === 'reports') {
      fetchReports();
    }
  }, [tab, fetchReports]);

  const logAdminAction = useCallback(async (action: string, targetUserId?: string, details: any = {}) => {
    if (!supabase || !user) return;
    try {
      const { error: insertError } = await supabase
        .rpc('log_admin_action', {
          p_admin_id: user.id,
          p_action: action,
          p_target_user_id: targetUserId,
          p_details: details
        });

      if (insertError) {
        console.error('Error logging admin action:', insertError);
      }
    } catch (err) {
      console.error('Error in logAdminAction:', err);
    }
  }, [supabase, user]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!supabase) return;

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
  }, [supabase, fetchData, logAdminAction]);

  const handleDeleteRecipe = useCallback(async (recipeId: string) => {
    if (!supabase) return;

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
  }, [supabase, fetchData]);

  const handleBanToggle = async (userId: string, banned: boolean) => {
    if (!supabase) return;
    try {
      // Get current user data
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userError) throw userError;

      // Prepare update data
      const updateData: Partial<ProfileData> = {
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
        try {
          const { error: historyError } = await supabase
            .rpc('add_to_ban_history', {
              p_user_id: userId,
              p_admin_id: user?.id,
              p_ban_type: 'permanent',
              p_reason: 'Admin action',
              p_ban_start: new Date().toISOString(),
              p_ban_end: null
            });

          if (historyError) {
            console.error('Error adding to ban history:', historyError);
          }
        } catch (addError) {
          console.error('Error calling add_to_ban_history:', addError);
        }
      }

      // Update local state with the complete user data
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, ...updateData } : u
      ));

      // Log the action
      await logAdminAction(banned ? 'unban' : 'ban', userId, {});

      // Refresh data to ensure consistency
      await fetchData();
    } catch (err) {
      console.error('error in handleBanToggle:', err);
      setError(err instanceof Error ? err.message : 'failed to update ban status');
    }
  };

  const handleWarningChange = async (userId: string, warnings: boolean, delta: number) => {
    if (!supabase) return;
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
    if (!supabase) return;
    try {
      // Get current user data
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userError) throw userError;

      // Prepare update data
      const updateData: Partial<ProfileData> = {
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
        try {
          const { error: historyError } = await supabase
            .rpc('add_to_ban_history', {
              p_user_id: userId,
              p_admin_id: user?.id,
              p_ban_type: 'temporary',
              p_reason: 'Temporary ban',
              p_ban_start: new Date().toISOString(),
              p_ban_end: date.toISOString()
            });

          if (historyError) {
            console.error('Error adding to ban history:', historyError);
          }
        } catch (addError) {
          console.error('Error calling add_to_ban_history:', addError);
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
      setError(err instanceof Error ? err.message : 'failed to update ban expiry');
    }
  };

  // Optimize user modal opening
  const openUserModal = useCallback(async (user: ProfileData) => {
    if (!supabase) {
      console.error("Supabase client is not initialized");
      return;
    }
    
    setSelectedUser(user);
    setUserModalOpen(true);
    
    // Fetch warnings and activity in parallel
    try {
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
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserWarnings([]);
      setUserActivity([]);
    }
  }, [supabase]);

  // Optimize warning modal
  const openWarningModal = useCallback((user: ProfileData) => {
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

  const handleAddWarning = useCallback(async () => {
    if (!warningTargetUser || !warningReason.trim()) return;
    try {
      // Use our new API endpoint instead of direct Supabase calls
      const response = await ensureAuthenticatedFetch('/api/warnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: warningTargetUser.user_id,
          reason: warningReason.trim()
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: await response.text() };
        }
        throw new Error(errorData.error || 'Failed to add warning');
      }

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
    } catch (err) {
      console.error('Error adding warning:', err);
      setError('failed to add warning');
    }
  }, [warningTargetUser, warningReason, selectedUser, openUserModal, ensureAuthenticatedFetch]);

  const handleRemoveWarning = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      setIsSaving(true);
      
      // Use our new API endpoint for removing warnings
      const response = await ensureAuthenticatedFetch(`/api/warnings?user_id=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: await response.text() };
        }
        throw new Error(errorData.error || 'Failed to remove warning');
      }

      const data = await response.json();

      // Update local state immediately
      setUsers(prev => prev.map(u => 
        u.user_id === userId 
          ? { ...u, warnings: data.warnings_remaining } 
          : u
      ));

      // Update selected user if it's the same one
      if (selectedUser && selectedUser.user_id === userId) {
        setSelectedUser(prev => prev ? { ...prev, warnings: data.warnings_remaining } : null);
      }

      // Log the action
      await logAdminAction('remove_warning', userId, { 
        warnings_remaining: data.warnings_remaining 
      });
      
      // Trigger a refresh of the profile data
      setRefreshTrigger(prev => !prev);
      
      // Show success message
      setSaveMessage('Warning removed successfully');
      setTimeout(() => setSaveMessage(null), 3000);
      
      setIsSaving(false);
    } catch (err) {
      console.error('Error removing warning:', err);
      setError('Failed to remove warning');
      setTimeout(() => setError(null), 3000);
      setIsSaving(false);
    }
  }, [ensureAuthenticatedFetch, selectedUser, logAdminAction]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const selectAllUsers = (userIds: string[]) => {
    setSelectedUserIds(userIds.filter(id => filteredUsers.some(user => user.user_id === id)));
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };

  const handleBulkBan = useCallback(async (selectedUserIds: string[], banned: boolean) => {
    if (!supabase) return;
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('user_id, banned')
        .in('user_id', selectedUserIds);

      if (usersError) throw usersError;

      const updateData: ProfileUpdate = { banned };
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .in('user_id', selectedUserIds);

      if (updateError) throw updateError;

      for (const userId of selectedUserIds) {
        await logAdminAction(banned ? 'ban' : 'unban', userId);
      }
      clearSelectedUsers();
      await fetchData();
    } catch (err) {
      console.error('Error in bulk ban:', err);
      setError(err instanceof Error ? err.message : 'failed to update ban status');
    }
  }, [supabase, selectedUserIds, logAdminAction, fetchData]);

  const handleBulkWarning = useCallback(async () => {
    if (!bulkWarningReason.trim() || selectedUserIds.length === 0) return;
    try {
      // Process each user one by one using our API endpoint
      for (const userId of selectedUserIds) {
        await ensureAuthenticatedFetch('/api/warnings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            reason: bulkWarningReason.trim()
          }),
        });
      }

      clearSelectedUsers();
      await fetchData();
    } catch (err) {
      console.error('Error in bulk warning:', err);
      setError(err instanceof Error ? err.message : 'failed to add warnings');
    }
  }, [selectedUserIds, bulkWarningReason, clearSelectedUsers, fetchData, ensureAuthenticatedFetch]);

  const handleReportStatusChange = useCallback(async (reportId: string, status: string, adminNotes?: string) => {
    if (!supabase || !user) return;

    try {
      setIsSaving(true);
      setSaveMessage(null);

      // Update the report status directly using Supabase
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          admin_notes: adminNotes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      // Update the report in the local state
      setReports(prev => prev.map(r => r.id === reportId ? { 
        ...r, 
        status, 
        admin_notes: adminNotes || r.admin_notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      } : r));

      // Log the action
      await logAdminAction('update_report_status', reportId, { 
        reportId,
        status,
        adminNotes
      });

      // Show success message
      setSaveMessage(`Report status updated to ${status}`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error updating report status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update report status');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [supabase, user, logAdminAction]);

  const handleDeleteReport = useCallback(async (reportId: string) => {
    if (!supabase || !user) return;

    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      // Delete the report directly using Supabase
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      // Remove the deleted report from local state
      setReports(prev => prev.filter(r => r.id !== reportId));

      // Log the action
      await logAdminAction('delete_report', reportId, { 
        reportId,
        status: reports.find(r => r.id === reportId)?.status
      });

      // Show success message
      setSaveMessage('Report deleted successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting report:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete report');
      setTimeout(() => setError(null), 3000);
    }
  }, [supabase, user, reports, logAdminAction]);

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

  // Filter reports based on status
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter(report => 
      reportStatus === 'all' || report.status === reportStatus
    );
  }, [reports, reportStatus]);

  // Add function to handle admin status changes
  const handleAdminStatusChange = useCallback(async (userId: string, newAdminStatus: boolean) => {
    if (!supabase || !user) return;
    try {
      const { error } = await supabase.rpc('set_admin_status', {
        target_user_id: userId,
        new_admin_status: newAdminStatus,
        admin_user_id: user?.id
      });

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, is_admin: newAdminStatus } : u
      ));

      // Log the action
      await logAdminAction(newAdminStatus ? 'grant_admin' : 'revoke_admin', userId, {});

      // Show success message
      setSaveMessage(`Admin status ${newAdminStatus ? 'granted' : 'revoked'}`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error updating admin status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update admin status');
      setTimeout(() => setError(null), 3000);
    }
  }, [supabase, user, logAdminAction]);

  // Add a helper function to convert ProfileData to Profile
  const profileDataToProfile = (data: ProfileData): Profile => {
    return {
      id: data.user_id,
      user_id: data.user_id,
      username: data.username || null,
      avatar_url: data.avatar_url || null,
      bio: data.bio || null,
      is_private: data.is_private || false,
      email: data.email || null,
      full_name: data.full_name || null,
      is_admin: data.is_admin || false,
      warnings: data.warnings || 0,
      banned: data.banned || false,
      ban_type: (data.ban_type as "temporary" | "permanent" | "warning" | null) ?? null,
      ban_reason: data.ban_reason || null,
      ban_expiry: data.ban_expiry || null,
      last_ban_date: data.last_ban_date || null,
      ban_count: data.ban_count || 0,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      show_email: data.show_email || false
    };
  };

  const handleOpenAdminNotesModal = (reportId: string, currentNotes: string = '') => {
    setSelectedReportId(reportId);
    setAdminNotes(currentNotes);
    setIsAdminNotesModalOpen(true);
  };

  const handleCloseAdminNotesModal = () => {
    setIsAdminNotesModalOpen(false);
    setSelectedReportId(null);
    setAdminNotes('');
  };

  const handleSaveAdminNotes = async () => {
    if (!selectedReportId || !supabase || !user) return;

    try {
      // Update the report with admin notes directly using Supabase
      const { error } = await supabase
        .from('reports')
        .update({
          admin_notes: adminNotes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedReportId);

      if (error) throw error;

      // Update the reports in the local state
      setReports(prev => prev.map(r => 
        r.id === selectedReportId ? { 
          ...r, 
          admin_notes: adminNotes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        } : r
      ));

      // Log the action
      await logAdminAction('update_report_notes', selectedReportId, { 
        reportId: selectedReportId,
        notes: adminNotes
      });

      // Close the modal and show success message
      handleCloseAdminNotesModal();
      setSaveMessage('Admin notes updated successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error updating admin notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to update admin notes');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div>
      <Head>
        <title>{toLower('admin panel')}</title>
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-8 rounded-2xl">
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
                className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isSaving ? toLower('saving...') : toLower('save changes')}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex flex-col items-center gap-4 p-8 border border-outline bg-transparent dark:bg-red-900/10 shadow-md">
              <span className="text-6xl">⚠️</span>
              <h2 className="text-2xl font-bold">{toLower('error')}</h2>
              <p className="text-lg text-center">{toLower(error)}</p>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <div className="tabs flex flex-wrap">
              <button
                className={`group tab tab-bordered ${tab === 'users' ? 'tab-active' : ''} px-4 py-2 mx-1 transition-all duration-200 flex items-center active:scale-95 rounded-t-lg`}
                style={{ background: tab === 'users' ? 'var(--background)' : 'transparent', color: 'var(--foreground)' }}
                onClick={() => setTab('users')}
              >
                <span className="mr-2 transform transition-transform group-hover:scale-110">👤</span>
                <span className="group-hover:text-gray-500 transition-colors">{toLower('users')}</span>
              </button>
              <button
                className={`group tab tab-bordered ${tab === 'recipes' ? 'tab-active' : ''} px-4 py-2 mx-1 transition-all duration-200 flex items-center active:scale-95 rounded-t-lg`}
                style={{ background: tab === 'recipes' ? 'var(--background)' : 'transparent', color: 'var(--foreground)' }}
                onClick={() => setTab('recipes')}
              >
                <span className="mr-2 transform transition-transform group-hover:scale-110">📝</span>
                <span className="group-hover:text-gray-500 transition-colors">{toLower('recipes')}</span>
              </button>
              <button
                className={`group tab tab-bordered ${tab === 'reports' ? 'tab-active' : ''} px-4 py-2 mx-1 transition-all duration-200 flex items-center active:scale-95 rounded-t-lg`}
                style={{ background: tab === 'reports' ? 'var(--background)' : 'transparent', color: 'var(--foreground)' }}
                onClick={() => setTab('reports')}
              >
                <span className="mr-2 transform transition-transform group-hover:scale-110">🚩</span>
                <span className="group-hover:text-gray-500 transition-colors">{toLower('reports')}</span>
              </button>
              <button
                className={`group tab tab-bordered ${tab === 'audit' ? 'tab-active' : ''} px-4 py-2 mx-1 transition-all duration-200 flex items-center active:scale-95 rounded-t-lg`}
                style={{ background: tab === 'audit' ? 'var(--background)' : 'transparent', color: 'var(--foreground)' }}
                onClick={() => setTab('audit')}
              >
                <span className="mr-2 transform transition-transform group-hover:scale-110">📊</span>
                <span className="group-hover:text-gray-500 transition-colors">{toLower('audit log')}</span>
              </button>
            </div>
          </div>

          {tab === 'reports' && (
          <div>
            <h2 className="text-xl mb-4 font-medium flex items-center">
              <span className="mr-2">🚩</span>
              {toLower('reports')}
            </h2>
            <div className="flex gap-4 mb-4">
              <select 
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value as 'under review' | 'resolved' | 'all')}
                className="px-3 py-2 border border-outline bg-transparent rounded-lg"
              >
                <option value="all">{toLower('all reports')}</option>
                <option value="under review">{toLower('under review')}</option>
                <option value="resolved">{toLower('resolved')}</option>
              </select>
            </div>
            <div className="space-y-4">
              {filteredReports.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-outline shadow-md rounded-xl" style={{ background: 'var(--background)' }}>
                  <span className="text-6xl">📝</span>
                  <h2 className="text-2xl font-bold">{toLower('no reports found')}</h2>
                  <p className="text-lg text-center">{toLower('there are no reports matching the current filter')}</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 border flex flex-col gap-4 shadow-sm rounded-xl" style={{ background: 'var(--background)', borderColor: 'var(--outline)' }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 overflow-hidden rounded-full flex items-center justify-center" style={{ background: 'var(--background)' }}>
                          <Avatar 
                            avatar_url={report.reporter_avatar_url} 
                            username={report.reporter_username} 
                            size={48} 
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">
                            <span>
                              {report.report_type === 'user' && (
                                <>
                                  {toLower('reported user')}: {toLower(report.reported_username || 'unknown')}
                                  <br />
                                  <span className="mt-1 text-xs text-gray-400">
                                    user: {report.reported_user_id}
                                  </span>
                                </>
                              )}
                              {report.report_type === 'recipe' && (
                                <>
                                  {toLower('reported recipe')}: {report.recipe_id} ({toLower(report.recipe_type || 'unknown')})
                                  <br />
                                  <span className="mt-1 text-xs text-gray-400">
                                    user: {report.recipe_user_id}
                                  </span>
                                </>
                              )}
                              {report.report_type === 'message' && (
                                <>
                                  {toLower('reported message')}: {report.message_id}
                                  <br />
                                  <span className="mt-1 text-xs text-gray-400">
                                    user: {report.reported_user_id}
                                  </span>
                                  {report.message_content && (
                                    <div className="mt-2 text-sm text-gray-300">
                                      <span className="font-medium">{toLower('message details')}:</span>
                                      <div className="p-2 border border-outline rounded bg-gray-900/30 mt-1">
                                        {report.message_content}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {toLower('type')}: {toLower(report.report_type)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {toLower('reported by')}: {toLower(report.reporter_username || 'anonymous')}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(report.created_at).toLocaleString()}
                          </div>
                          {report.reviewed_by && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {toLower('reviewed by')}: {toLower(report.reviewer_username || 'unknown')}
                              {report.reviewed_at && ` (${new Date(report.reviewed_at).toLocaleString()})`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          report.status === 'under review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        }`}>{toLower(report.status)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">{toLower('reason')}:</div>
                      <div className="text-sm p-3 rounded-xl border border-outline" style={{ background: 'var(--background)' }}>{toLower(report.reason)}</div>
                      {report.details && (
                        <>
                          <div className="font-medium">{toLower('details')}:</div>
                          <div className="text-sm p-3 rounded-xl border border-outline" style={{ background: 'var(--background)' }}>{toLower(report.details)}</div>
                        </>
                      )}
                      {report.admin_notes && (
                        <>
                          <div className="font-medium">{toLower('admin notes')}:</div>
                          <div className="text-sm p-3 rounded-xl border border-outline" style={{ background: 'var(--background)' }}>{toLower(report.admin_notes)}</div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => handleOpenAdminNotesModal(report.id, report.admin_notes || '')}
                        className="px-5 py-3 rounded-xl text-sm border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity"
                      >
                        {report.admin_notes ? toLower('edit notes') : toLower('add notes')}
                      </button>
                      {report.status !== 'resolved' && (
                        <button
                          onClick={() => handleReportStatusChange(report.id, 'resolved')}
                          className="px-5 py-3 rounded-xl text-sm border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity"
                        >
                          {toLower('mark as resolved')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="px-5 py-3 rounded-xl text-sm border text-red-500 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/10 transition-opacity"
                      >
                        {toLower('delete')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {tab === 'users' && (
          <div>
            <div className="mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-medium flex items-center">
                  <span className="mr-2">👤</span>
                  {toLower('users')}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push('/admin/init-warnings')}
                    className="px-3 py-1 text-sm border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    Initialize Warnings System
                  </button>
                  {selectedUserIds.length > 0 && (
                    <button
                      onClick={openBulkWarningModal}
                      className="px-3 py-1 text-sm border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {toLower(`Add Warning (${selectedUserIds.length})`)}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder={toLower('search by username or email...')}
                onChange={e => debouncedSearch(e.target.value)}
                className="px-3 py-2 border border-outline bg-transparent rounded-lg"
              />
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'banned' | 'warned')}
                className="px-3 py-2 border border-outline bg-transparent rounded-lg"
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
                  <div className="ml-4 flex gap-3 items-center rounded-lg" style={{ background: 'var(--background)', border: '1px solid var(--outline)', color: 'var(--foreground)' }}>
                    <span className="font-semibold">{toLower('bulk actions:')}</span>
                    <button onClick={() => handleBulkBan(selectedUserIds, true)} className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50" style={{ color: 'var(--danger)', background: 'var(--background)' }}>{toLower('ban')}</button>
                    <button onClick={() => handleBulkBan(selectedUserIds, false)} className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50" style={{ color: 'var(--accent)', background: 'var(--background)' }}>{toLower('unban')}</button>
                    <button onClick={openBulkWarningModal} className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50" style={{ color: 'var(--warning)', background: 'var(--background)' }}>{toLower('+ warning')}</button>
                    <button onClick={clearSelectedUsers} className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50" style={{ color: 'var(--foreground)', background: 'var(--background)' }}>{toLower('clear')}</button>
                  </div>
                )}
              </div>
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-outline bg-transparent dark:bg-gray-900/10 shadow-md rounded-xl">
                  <span className="text-6xl">🔍</span>
                  <h2 className="text-2xl font-bold">{toLower('no users found')}</h2>
                  <p className="text-lg text-center">{toLower('try adjusting your search or filter criteria')}</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className={`p-4 border flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 shadow-sm rounded-xl`}
                    style={{ background: 'var(--background)', borderColor: user.banned ? 'var(--danger)' : 'var(--outline)', color: 'var(--foreground)' }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.user_id)}
                        onChange={() => toggleUserSelection(user.user_id)}
                      />
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => openUserModal(user)}>
                        <div className="w-12 h-12 overflow-hidden rounded-full flex items-center justify-center" style={{ background: 'var(--background)' }}>
                          <Avatar avatar_url={user.avatar_url} username={user.username} size={48} />
                        </div>
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {toLower(user.username || '[recipes] user')}
                            {user.is_admin && <span className="text-gray-400 text-xs font-bold border border-gray-400 px-1">{toLower('admin')}</span>}
                            {user.banned && <span className="text-red-400 text-xl ml-1">🔒</span>}
                            {user.warnings && user.warnings > 0 && <span className="text-yellow-400 text-xl ml-1">⚠️</span>}
                          </div>
                          <div className="text-sm text-gray-500">{toLower(user.email || user.user_id)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdminStatusChange(user.user_id, !user.is_admin)}
                        className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        {toLower(user.is_admin ? 'revoke admin' : 'make admin')}
                      </button>
                      <button
                        onClick={() => handleBanToggle(user.user_id, !!user.banned)}
                        className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
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
                          className="px-3 py-2 border border-outline bg-transparent rounded-lg"
                        />
                      </div>
                      <button
                        onClick={() => openWarningModal(user)}
                        className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
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
          )}

          {tab === 'recipes' && (
          <div>
            <h2 className="text-xl mb-4 font-medium flex items-center">
              <span className="mr-2">📝</span>
              {toLower('recipes')}
            </h2>
            <div className="space-y-4">
              {recipes.length === 0 ? (
                <div className="flex flex-col items-center gap-4 p-8 border border-outline shadow-md rounded-xl" style={{ background: 'var(--background)' }}>
                  <span className="text-6xl">📋</span>
                  <h2 className="text-2xl font-bold">{toLower('no recipes found')}</h2>
                  <p className="text-lg text-center">{toLower('there are no recipes in the system yet')}</p>
                </div>
              ) : (
                recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="p-4 border border-outline flex justify-between items-center rounded-xl" style={{ background: 'var(--background)' }}>
                    <div>
                      <p className="font-medium">{toLower(recipe.title)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {toLower('id')}: {recipe.id}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(recipe.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRecipe(recipe.id)}
                      className="px-3 py-2 border border-outline bg-transparent rounded-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {toLower('delete')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {tab === 'audit' && (
          <div>
            <h2 className="text-xl mb-4 font-medium flex items-center">
              <span className="mr-2">📊</span>
              {toLower('audit log')}
            </h2>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder={toLower('search audit log...')}
                onChange={e => setAuditSearch(e.target.value)}
                className="px-3 py-2 border border-outline bg-transparent rounded-lg"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAuditLog.length === 0 ? (
              <div className="flex flex-col items-center gap-4 p-8 border border-outline bg-transparent dark:bg-gray-900/10 shadow-md rounded-xl" style={{ background: 'var(--background)' }}>
                <span className="text-6xl">📜</span>
                <h2 className="text-2xl font-bold">{toLower('no audit logs')}</h2>
                <p className="text-lg text-center">{toLower('no audit logs found for the current search')}</p>
              </div>
            ) : (
              filteredAuditLog.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border border-outline transition-colors rounded-xl" style={{ background: 'var(--background)' }}
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
          )}
        </div>
      </main>

      <ModalWrapper />
      <Suspense fallback={null}>
        {userModalOpen && selectedUser && selectedUser.user_id && (
          <UserModal
            isOpen={userModalOpen}
            onClose={() => setUserModalOpen(false)}
            user={{
              id: selectedUser.id ?? selectedUser.user_id,
              user_id: selectedUser.user_id,
              username: selectedUser.username ?? '',
              full_name: selectedUser.full_name ?? '',
              avatar_url: selectedUser.avatar_url ?? '',
              bio: selectedUser.bio ?? '',
              is_private: selectedUser.is_private ?? false,
              show_email: selectedUser.show_email ?? false,
              is_admin: selectedUser.is_admin ?? false,
              warnings: selectedUser.warnings ?? 0,
              banned: selectedUser.banned ?? false,
              ban_type: (selectedUser.ban_type as "temporary" | "permanent" | "warning" | null) ?? null,
              ban_reason: selectedUser.ban_reason ?? null,
              ban_expiry: selectedUser.ban_expiry ?? null,
              last_ban_date: selectedUser.last_ban_date ?? null,
              ban_count: selectedUser.ban_count ?? 0,
              created_at: selectedUser.created_at ?? new Date().toISOString(),
              updated_at: selectedUser.updated_at ?? new Date().toISOString(),
              email: selectedUser.email ?? null
            }}
            warnings={userWarnings}
            activity={userActivity}
            onRemoveWarning={handleRemoveWarning}
            isProcessing={isSaving}
          />
        )}
        {showWarningModal && warningTargetUser && (
          <WarningModal
            isOpen={showWarningModal}
            user={warningTargetUser as unknown as Profile}
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

      {/* Admin Notes Modal */}
      {isAdminNotesModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-xl p-8 rounded-2xl shadow-lg border border-outline" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-2xl mb-6">{toLower('Admin Notes')}</h2>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full min-h-[160px] px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none border border-outline bg-transparent"
              placeholder="Add private notes about this report..."
            />
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={handleCloseAdminNotesModal}
                className="px-5 py-3 rounded-xl text-base border border-outline bg-transparent hover:opacity-80 transition-opacity"
              >
                {toLower('cancel')}
              </button>
              <button
                onClick={handleSaveAdminNotes}
                className="px-5 py-3 rounded-xl text-base border border-outline bg-transparent hover:opacity-80 transition-opacity"
              >
                {toLower('save notes')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add RefreshWarnings component */}
      <RefreshWarnings triggerRefresh={refreshTrigger} />
    </div>
  );
}