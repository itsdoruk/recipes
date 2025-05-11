import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'follow' | 'follow_request' | 'recipe_like' | 'recipe_comment' | 'mention';
  content: string | null;
  read: boolean;
  created_at: string;
  actor_id: string;
  metadata: {
    username?: string;
    avatar_url?: string;
    recipe_id?: string;
    recipe_title?: string;
  };
}

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            actor:actor_id (
              username,
              avatar_url
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const formattedNotifications = data.map(notification => ({
          ...notification,
          metadata: {
            username: notification.actor?.username,
            avatar_url: notification.actor?.avatar_url,
            ...notification.metadata
          }
        }));

        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotification = payload.new as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        setUnreadCount(prev => Math.max(0, prev - 1));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFollowRequest = async (notificationId: string, actorId: string, action: 'accept' | 'reject') => {
    if (!user || !supabase) return;
    setProcessingRequest(notificationId);

    try {
      if (action === 'accept') {
        // Accept the follow request
        const { error: followError } = await supabase
          .from('follows')
          .insert({
            follower_id: actorId,
            following_id: user.id
          });

        if (followError) throw followError;

        // Send notification for accepted follow request
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: actorId,
            type: 'follow',
            actor_id: user.id
          });

        if (notificationError) throw notificationError;
      }

      // Delete the follow request
      const { error: deleteError } = await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', actorId)
        .eq('target_id', user.id);

      if (deleteError) throw deleteError;

      // Remove the notification
      const { error: removeError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (removeError) throw removeError;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error handling follow request:', error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user || !supabase) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

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

  const getNotificationContent = (notification: Notification) => {
    switch (notification.type) {
      case 'follow':
        return `${notification.metadata.username || 'Someone'} started following you`;
      case 'follow_request':
        return `${notification.metadata.username || 'Someone'} requested to follow you`;
      case 'recipe_like':
        return `${notification.metadata.username || 'Someone'} liked your recipe "${notification.metadata.recipe_title || ''}"`;
      case 'recipe_comment':
        return `${notification.metadata.username || 'Someone'} commented on your recipe "${notification.metadata.recipe_title || ''}"`;
      case 'mention':
        return `${notification.metadata.username || 'Someone'} mentioned you in a comment`;
      default:
        return notification.content || 'New notification';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'follow':
      case 'follow_request':
        return `/user/${notification.actor_id}`;
      case 'recipe_like':
      case 'recipe_comment':
        return `/recipe/${notification.metadata.recipe_id}`;
      default:
        return '#';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:opacity-80 transition-opacity rounded-lg border border-gray-200 dark:border-gray-800"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
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
                onClick={() => {
                  notifications.forEach(n => !n.read && markAsRead(n.id));
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:opacity-80 transition-opacity"
              >
                mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] md:max-h-96 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                no notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={getNotificationLink(notification)}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id);
                        }
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 flex-1"
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <Avatar
                          avatar_url={notification.metadata.avatar_url}
                          username={notification.metadata.username}
                          size={40}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-bold">{notification.metadata.username || '[recipes] user'}</span>
                          {' '}
                          {getNotificationContent(notification)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>

                    {notification.type === 'follow_request' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFollowRequest(notification.id, notification.actor_id, 'accept')}
                          disabled={processingRequest === notification.id}
                          className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
                        >
                          accept
                        </button>
                        <button
                          onClick={() => handleFollowRequest(notification.id, notification.actor_id, 'reject')}
                          disabled={processingRequest === notification.id}
                          className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity rounded-lg"
                        >
                          reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 