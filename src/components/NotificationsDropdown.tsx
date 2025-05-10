import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import Avatar from './Avatar';

interface Notification {
  id: string;
  user_id: string;
  type: 'follow' | 'follow_request' | 'recipe_like' | 'recipe_comment';
  actor_id: string;
  created_at: string;
  read: boolean;
  actor: {
    username: string | null;
    avatar_url: string | null;
  };
}

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles!notifications_actor_id_fkey(username, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        // Transform the data to match the expected format
        const transformedData = data.map(notification => ({
          ...notification,
          actor: {
            username: notification.profiles?.username || null,
            avatar_url: notification.profiles?.avatar_url || null
          }
        }));
        setNotifications(transformedData);
        setUnreadCount(transformedData.filter(n => !n.read).length);
      }
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, async (payload) => {
        // Fetch the actor's profile for the new notification
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('user_id', payload.new.actor_id)
          .single();

        const newNotification = {
          ...payload.new,
          actor: {
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null
          }
        };

        setNotifications(prev => [newNotification as Notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user?.id)
      .eq('read', false);
    
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="fixed md:absolute right-0 mt-2 w-[calc(100vw-2rem)] md:w-80 border border-gray-200 dark:border-gray-800 shadow-lg z-50 rounded-xl"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        >
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="font-medium">notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] md:max-h-96 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
            {notifications.length > 0 ? (
              notifications.map((notification) => {
                const isFollow = notification.type === 'follow';
                const isFollowRequest = notification.type === 'follow_request';
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${isFollowRequest ? 'border-l-4 border-yellow-400' : ''}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <Link
                      href={`/user/${notification.actor_id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <Avatar avatar_url={notification.actor.avatar_url} username={notification.actor.username} size={40} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium text-blue-600 dark:text-blue-400">{notification.actor.username || 'anonymous'}</span>
                          {' '}
                          {isFollow && <span>started following you</span>}
                          {isFollowRequest && <span className="text-yellow-600 dark:text-yellow-400">requested to follow you</span>}
                          {notification.type === 'recipe_like' && 'liked your recipe'}
                          {notification.type === 'recipe_comment' && 'commented on your recipe'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                no notifications yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 