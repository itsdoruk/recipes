import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useRef } from 'react';
import Avatar from './Avatar';
import { useProfile } from '@/hooks/useProfile';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useWarningBanner } from '@/hooks/useWarningBanner';
import { useAuth } from '@/lib/hooks/useAuth';
import { getNotificationText, getNotificationPath } from '@/hooks/useNotifications';
import { useFollowNotifications } from '@/hooks/useNotifications';
import NotificationListSkeleton from './NotificationListSkeleton';

export const NAVBAR_HEIGHT = 80; // px, matches h-20 in Tailwind for mobile, adjust if needed
export const WARNING_BANNER_HEIGHT = 32; // px, for the warning banner

interface Notification {
  id: string;
  user_id: string;
  type: string;
  actor_id: string;
  created_at: string;
  read: boolean;
  metadata?: any;
  actor_username?: string;
  actor_avatar_url?: string;
}

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const supabase = useSupabaseClient();
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { profile, isLoading } = useProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [userResults, setUserResults] = useState<{ user_id: string; username: string | null; avatar_url: string | null }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const { warnings, shouldShowBanner, dismissBanner } = useWarningBanner();
  const supabaseClient = getBrowserClient();
  const { sendFollowNotification } = useFollowNotifications();
  const menuRef = useRef<HTMLDivElement>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Set CSS variable for warning banner visibility
  useEffect(() => {
    // Set CSS variable for warning banner visibility
    document.documentElement.style.setProperty(
      '--warning-banner-height', 
      shouldShowBanner ? `${WARNING_BANNER_HEIGHT}px` : '0px'
    );
  }, [shouldShowBanner]);

  // Fetch notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            id,
            user_id,
            type,
            actor_id,
            created_at,
            read,
            metadata,
            profiles!notifications_actor_id_fkey(username, avatar_url)
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const formattedNotifications = (data || []).map((notification: any) => ({
          ...notification,
          actor_username: notification.profiles?.username,
          actor_avatar_url: notification.profiles?.avatar_url
        }));

        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter((n: Notification) => !n.read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setNotificationsLoading(false);
      }
    };

    fetchNotifications();

    // Set up real-time subscription for new notifications
    const channel = supabase.channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, supabase]);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationDisplayText = (notification: Notification) => {
    return getNotificationText(notification);
  };

  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);
    setShowNotifications(false);

    // Use the utility function to get the navigation path
    const path = getNotificationPath(notification);
    if (path) {
      router.push(path);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => router.pathname === path;

  const handleUserSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length === 0) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .or(`username.ilike.%${value}%,email.ilike.%${value}%`)
        .limit(8);
      if (!error && data) {
        setUserResults(data);
        setShowUserDropdown(true);
      } else {
        setUserResults([]);
        setShowUserDropdown(false);
      }
    }, 300);
  };

  const handleAcceptFollowRequest = async (notification: Notification) => {
    // This function is no longer needed since all accounts are public
    console.log('[Follow Request] Follow requests are no longer supported - all accounts are public');
  };

  const handleRejectFollowRequest = async (notification: Notification) => {
    // This function is no longer needed since all accounts are public
    console.log('[Follow Request] Follow requests are no longer supported - all accounts are public');
  };

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isMenuOpen]);

  // Close menu on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isMenuOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-outline shadow-md" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Navigation Links */}
            <div className="flex items-center gap-6">
              <Link href="/" className="hover:opacity-80 transition-opacity text-lg">
                [recipes]
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link href="/home" className="hover:opacity-80 transition-opacity">
                  recipes
                </Link>
                <Link href="/discover" className="hover:opacity-80 transition-opacity">
                  discover
                </Link>
                <Link href="/timer" className="hover:opacity-80 transition-opacity">
                  timer
                </Link>
                {isAuthenticated && (
                  <>
                    <Link href="/create" className="hover:opacity-80 transition-opacity">
                      create
                    </Link>
                    <Link href="/messages" className="hover:opacity-80 transition-opacity">
                      messages
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="p-2 hover:opacity-80 transition-opacity"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  {/* Notification Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2 hover:opacity-80 transition-opacity"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                        />
                      </svg>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                    
                    {/* Notification Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 z-50">
                        {notificationsLoading ? (
                          <NotificationListSkeleton />
                        ) : (
                          <div
                            className="absolute right-0 mt-2 w-80 border border-outline shadow-lg z-50 rounded-xl max-h-96 overflow-y-auto"
                            style={{ background: "var(--background)", color: "var(--foreground)" }}
                          >
                            <div className="px-4 py-3 border-b border-outline flex justify-between items-center">
                              <h3 className="font-medium">notifications</h3>
                              {unreadCount > 0 && (
                                <button
                                  onClick={markAllNotificationsAsRead}
                                  className="text-sm text-blue-500 hover:opacity-80 transition-opacity"
                                >
                                  mark all read
                                </button>
                              )}
                            </div>
                            <div className="py-2">
                              {notifications.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-500">
                                  no notifications
                                </div>
                              ) : (
                                notifications.map((notification) => (
                                  <div 
                                    key={notification.id} 
                                    className={`relative w-full px-4 py-3 text-left hover:opacity-80 transition-opacity border-b border-outline last:border-b-0 ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                    style={{ cursor: notification.type === 'follow_request' ? 'default' : 'pointer' }}
                                    onClick={() => handleNotificationClick(notification)}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                        <Avatar
                                          avatar_url={notification.actor_avatar_url}
                                          username={notification.actor_username || 'User'}
                                          size={32}
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">
                                          {getNotificationDisplayText(notification)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {new Date(notification.created_at).toLocaleDateString()}
                                        </p>
                                      </div>
                                      {!notification.read && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowSettings((v) => !v)}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        <Avatar 
                          avatar_url={profile?.avatar_url || null} 
                          username={profile?.username || 'User'} 
                          size={32} 
                        />
                      </div>
                    </button>
                    {showSettings && (
                      <div
                        className="absolute right-0 mt-2 w-64 border border-outline shadow-lg z-50 rounded-xl"
                        style={{ background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <div className="px-4 py-3 border-b border-outline">
                          <p className="text-sm" style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}>
                            {profile?.username && profile.username !== 'anonymous'
                              ? `@${profile.username.toLowerCase()}`
                              : '[recipes] user'}
                          </p>
                        </div>
                        <Link
                          href={`/user/${user?.id}`}
                          className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
                          onClick={() => setShowSettings(false)}
                        >
                          profile
                        </Link>
                        <Link
                          href="/account"
                          className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
                          onClick={() => setShowSettings(false)}
                        >
                          account settings
                        </Link>
                        <Link
                          href="/settings"
                          className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
                          onClick={() => setShowSettings(false)}
                        >
                          app settings
                        </Link>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            handleSignOut();
                          }}
                          className="w-full text-left px-4 py-2 text-base font-normal text-red-500 hover:opacity-80 transition-opacity"
                          style={{ fontFamily: 'inherit' }}
                        >
                          sign out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  className="hover:opacity-80 transition-opacity"
                >
                  sign in
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black bg-opacity-40 transition-opacity duration-200"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu"
              />
              {/* Menu */}
              <div
                ref={menuRef}
                className="fixed top-0 left-0 right-0 z-50 md:hidden py-4 border-t border-outline bg-[var(--background)] animate-slide-down"
                style={{ animation: 'slideDown 0.2s cubic-bezier(0.4,0,0.2,1)' }}
              >
                <div className="flex flex-col gap-4 px-4">
                  <Link href="/home" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                    recipes
                  </Link>
                  <Link href="/discover" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                    discover
                  </Link>
                  <Link href="/timer" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                    timer
                  </Link>
                  {isAuthenticated ? (
                    <>
                      <Link href="/create" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                        create
                      </Link>
                      <Link href="/messages" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                        messages
                      </Link>
                      <Link href={`/user/${user?.id}`} className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                        profile
                      </Link>
                      <Link href="/account" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                        account settings
                      </Link>
                      <Link href="/settings" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                        app settings
                      </Link>
                      <button
                        onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                        className="py-3 text-lg text-left text-red-500 hover:opacity-80 transition-opacity"
                      >
                        sign out
                      </button>
                    </>
                  ) : (
                    <Link href="/login" className="py-3 text-lg hover:opacity-80 transition-opacity" onClick={() => setIsMenuOpen(false)}>
                      sign in
                    </Link>
                  )}
                </div>
              </div>
              <style jsx global>{`
                @keyframes slideDown {
                  0% { transform: translateY(-30px); opacity: 0; }
                  100% { transform: translateY(0); opacity: 1; }
                }
              `}</style>
            </>
          )}
        </div>
      </nav>

      {/* Warning Banner */}
      {shouldShowBanner && (
        <div 
          className="fixed top-16 left-0 right-0 z-40 px-4 py-2 text-sm text-center"
          style={{ 
            background: 'var(--warning-bg, #fef3c7)', 
            color: 'var(--warning-text, #92400e)',
            borderBottom: '1px solid var(--warning-border, #f59e0b)'
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>You have {warnings} warning{warnings > 1 ? 's' : ''} on your account. Please follow the community guidelines.</span>
            <button
              onClick={dismissBanner}
              className="ml-4 hover:opacity-80 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}