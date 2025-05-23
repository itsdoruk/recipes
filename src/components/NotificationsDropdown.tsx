import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { followUser, sendFollowNotification } from '@/lib/api/follow';
import { getBrowserClient, removeChannel } from '@/lib/supabase/browserClient';
import { Notification as DbNotification } from '@/types/supabase';
import { fetchProfilesByIds } from '@/lib/api/profile';

interface Notification {
  id: string;
  type: 'follow' | 'follow_request' | 'recipe_like' | 'recipe_comment' | 'mention' | 'message_request' | 'message' | 'recipe_share';
  content: string | null;
  read: boolean;
  created_at: string;
  actor_id: string;
  metadata: {
    username?: string;
    avatar_url?: string;
    recipe_id?: string;
    recipe_title?: string;
    message_request_id?: string;
    conversation_id?: string;
    count?: number;
    recipe_type?: 'user' | 'spoonacular' | 'ai';
    message?: string | null;
  };
}

interface MessageNotification {
  id: string;
  user_id: string;
  conversation_id: string;
  count: number;
  last_message_at: string;
  other_user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export default function NotificationsDropdown() {
  const user = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messageNotifications, setMessageNotifications] = useState<MessageNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsChannelRef = useRef<any>(null);
  const messageChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        // Fetch regular notifications
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Get all actor IDs to fetch their profiles using our profile service
        const actorIds = data.map(notification => notification.actor_id).filter(Boolean);
        
        // Fetch all profiles at once using our consistent profile service
        const profilesMap = await fetchProfilesByIds(actorIds);
        
        const formattedNotifications = data.map(notification => {
          // Get profile for this notification's actor
          const actorProfile = profilesMap[notification.actor_id];
          
          return {
            ...notification,
            metadata: {
              ...notification.metadata,
              username: actorProfile?.username || notification.actor_id?.substring(0, 8) || 'User',
              avatar_url: actorProfile?.avatar_url
            }
          };
        });

        // Fetch message notifications
        await processMessageNotifications(formattedNotifications);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Helper function to process message notifications
    const processMessageNotifications = async (formattedNotifications: any[]) => {
      // Fetch message notifications
      const { data: msgNotificationData, error: msgError } = await supabase
        .from('message_notifications')
        .select(`
          id,
          user_id,
          conversation_id,
          count,
          last_message_at
        `)
        .eq('user_id', user.id);

      if (msgError) {
        console.error('Error fetching message notifications:', msgError);
        // If we couldn't process message notifications, just use regular ones
        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
        return;
      } 
      
      if (!msgNotificationData || msgNotificationData.length === 0) {
        // No message notifications, just use regular ones
        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
        return;
      }
      
      // Fetch conversation info for message notifications
      const conversationIds = msgNotificationData.map((n: any) => n.conversation_id);
      
      // Get conversations
      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id, 
          user_id, 
          other_user_id
        `)
        .in('id', conversationIds);
        
      if (convError) {
        console.error('Error fetching conversations:', convError);
        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
        return;
      }
      
      // Get user IDs of the other participants
      const userIds = conversationsData.map((conv: any) => 
        conv.user_id === user.id ? conv.other_user_id : conv.user_id
      );
      
      // Get profiles of other users using our new profile service
      const profilesMap = await fetchProfilesByIds(userIds);
      
      // Map conversations to notifications
      const conversationsMap = (conversationsData || []).reduce((acc: Record<string, any>, conv: any) => {
        const otherUserId = conv.user_id === user.id ? conv.other_user_id : conv.user_id;
        const otherUserProfile = profilesMap[otherUserId];
        
        acc[conv.id] = {
          ...conv,
          other_user: otherUserProfile
            ? {
                id: otherUserId,
                username: otherUserProfile.username || otherUserId?.substring(0, 8) || 'User',
                avatar_url: otherUserProfile.avatar_url || null
              }
            : { id: otherUserId, username: otherUserId?.substring(0, 8) || 'User', avatar_url: null }
        };
        return acc;
      }, {});
      
      // Enhance message notifications with user info
      setMessageNotifications(
        msgNotificationData.map((notification: any) => ({
          ...notification,
          other_user: conversationsMap[notification.conversation_id]?.other_user
        }))
      );

      // Convert message notifications to regular notification format
      const messageNotificationsFormatted = msgNotificationData.map((notification: any) => {
        const conv = conversationsMap[notification.conversation_id];
        if (!conv) {
          return null;
        }
        
        return {
          id: `msg-${notification.id}`,
          type: 'message',
          content: null,
          read: false,
          created_at: notification.last_message_at,
          actor_id: conv?.other_user?.id || '',
          metadata: {
            username: conv?.other_user?.username || conv?.other_user?.id?.substring(0, 8) || 'User',
            avatar_url: conv?.other_user?.avatar_url || null,
            conversation_id: notification.conversation_id,
            count: notification.count
          }
        };
      }).filter(Boolean);

      // Combine both types of notifications
      setNotifications([...formattedNotifications, ...messageNotificationsFormatted].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      
      const totalUnread = formattedNotifications.filter(n => !n.read).length + messageNotificationsFormatted.length;
      setUnreadCount(totalUnread);
    };

    fetchNotifications();

    // Clean up any existing subscriptions first
    if (notificationsChannelRef.current) {
      notificationsChannelRef.current.unsubscribe();
      notificationsChannelRef.current = null;
    }
    
    if (messageChannelRef.current) {
      messageChannelRef.current.unsubscribe();
      messageChannelRef.current = null;
    }

    // Subscribe to real-time notifications
    notificationsChannelRef.current = supabase
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
      });
    
    notificationsChannelRef.current.subscribe();

    // Subscribe to message notifications
    messageChannelRef.current = supabase
      .channel('message_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        // When message notifications change, refetch all notifications
        fetchNotifications();
      });
    
    messageChannelRef.current.subscribe();

    return () => {
      // Clean up subscriptions
      if (notificationsChannelRef.current) {
        notificationsChannelRef.current.unsubscribe();
        notificationsChannelRef.current = null;
      }
      
      if (messageChannelRef.current) {
        messageChannelRef.current.unsubscribe();
        messageChannelRef.current = null;
      }
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
        // First check if there's already a follow relationship
        const { data: existingFollow, error: checkError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', actorId)
          .eq('following_id', user.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (!existingFollow) {
          // Accept the follow request using shared utility
          const { error: followError } = await followUser(supabase, actorId, user.id);
          if (followError) {
            console.error('Follow error details:', {
              error: followError,
              follower_id: actorId,
              following_id: user.id,
              auth_uid: user.id
            });
            throw followError;
          }

          // Send notification for accepted follow request using shared utility
          const { error: notificationError } = await sendFollowNotification(supabase, actorId, user.id);
          if (notificationError) throw notificationError;
        }
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
      // Add error handling UI feedback here if needed
    } finally {
      setProcessingRequest(null);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user || !supabase) return;

    try {
      // For message notifications, their ID starts with 'msg-'
      if (notificationId.startsWith('msg-')) {
        const actualId = notificationId.substring(4);
        const msgNotification = messageNotifications.find(n => n.id === actualId);
        
        if (msgNotification) {
          // Use the mark_conversation_read function to mark messages as read
          try {
            await getSupabaseClient().rpc('mark_conversation_read', {
              p_conversation_id: msgNotification.conversation_id,
              p_user_id: user.id
            });
          } catch (rpcError) {
            console.error('RPC error:', rpcError);
            
            // Fallback: delete directly
            await supabase
              .from('message_notifications')
              .delete()
              .eq('id', actualId);
          }
          
          // Only update local notification state, don't remove
          setNotifications(prev => prev.map(n => 
            n.id === notificationId 
              ? { ...n, read: true } 
              : n
          ));
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else {
        // For regular notifications
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
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNavigateToMessage = (notification: Notification) => {
    // Mark as read and navigate to conversation
    if (notification.type === 'message' && notification.metadata.conversation_id) {
      markAsRead(notification.id);
      return `/messages/${notification.metadata.conversation_id}`;
    }
    return '#';
  };

  const getNotificationContent = (notification: Notification) => {
    switch (notification.type) {
      case 'follow':
        return 'started following you';
      case 'follow_request':
        return 'requested to follow you';
      case 'recipe_like':
        return `liked your recipe "${notification.metadata.recipe_title || ''}"`;
      case 'recipe_comment':
        return `commented on your recipe "${notification.metadata.recipe_title || ''}"`;
      case 'recipe_share':
        return `shared a recipe with you: "${notification.metadata.recipe_title || ''}"`;
      case 'mention':
        return 'mentioned you in a comment';
      case 'message_request':
        return 'sent you a message request';
      case 'message':
        const count = notification.metadata.count || 0;
        return `sent you ${count} new ${count === 1 ? 'message' : 'messages'}`;
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
      case 'recipe_share':
        const recipeId = notification.metadata.recipe_id;
        const recipeType = notification.metadata.recipe_type || 'user';
        if (recipeType === 'ai') {
          return `/internet-recipe/${recipeId}`;
        } else if (recipeType === 'spoonacular') {
          return `/recipe/spoonacular-${recipeId}`;
        } else {
          return `/recipe/${recipeId}`;
        }
      case 'message':
        return `/messages/${notification.metadata.conversation_id}`;
      default:
        return '#';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:opacity-80 transition-opacity rounded-lg border border-outline"
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
          className="fixed md:absolute right-0 mt-2 w-[calc(100vw-2rem)] md:w-80 border border-outline shadow-lg z-50 rounded-xl"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        >
          <div className="px-4 py-3 border-b border-outline flex justify-between items-center">
            <h3 className="font-medium">notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  notifications.forEach(n => {
                    if ((n.type !== 'message' && !n.read) || n.type === 'message') {
                      markAsRead(n.id);
                    }
                  });
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:opacity-80 transition-opacity"
              >
                mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] md:max-h-96 overflow-y-auto divide-y divide-outline">
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
                    (notification.type !== 'message' && !notification.read) || notification.type === 'message' 
                      ? 'bg-gray-50 dark:bg-gray-900/20' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={getNotificationLink(notification)}
                      onClick={() => {
                        if ((notification.type !== 'message' && !notification.read) || notification.type === 'message') {
                          markAsRead(notification.id);
                        }
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                    >
                      <Avatar
                        avatar_url={notification.metadata.avatar_url}
                        username={notification.metadata.username}
                        size={32}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium">{notification.metadata.username}</span>
                          {notification.type === 'message' 
                            ? ` sent you ${notification.metadata.count || 0} new ${notification.metadata.count === 1 ? 'message' : 'messages'}`
                            : ` ${getNotificationContent(notification)}`
                          }
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
                          className="px-2 py-1 text-xs border border-outline hover:opacity-80 transition-opacity rounded-lg"
                        >
                          accept
                        </button>
                        <button
                          onClick={() => handleFollowRequest(notification.id, notification.actor_id, 'reject')}
                          disabled={processingRequest === notification.id}
                          className="px-2 py-1 text-xs border border-outline hover:opacity-80 transition-opacity rounded-lg"
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