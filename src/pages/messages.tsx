import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import Avatar from '@/components/Avatar';
import { FaSearch, FaComments, FaUserPlus, FaBell, FaTrash } from 'react-icons/fa';

interface ConversationData {
  id: string;
  last_message: string;
  last_message_at: string;
  other_user: Array<{
    user_id: string;
    username: string;
    avatar_url: string;
  }>;
  unread_count: Array<{ count: number }>;
}

interface FormattedConversation {
  id: string;
  last_message: string;
  last_message_at: string;
  other_user: {
    id: string;
    username: string;
    avatar_url: string;
  };
  unread_count: number;
}

const MESSAGE_BACKGROUNDS = [
  'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
  'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
  'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20',
  'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
  'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20',
];

export default function MessagesPage() {
  const router = useRouter();
  const { session, user, loading: sessionLoading } = useAuth();
  const [conversations, setConversations] = useState<FormattedConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState(() => getBrowserClient());
  const [animateIn, setAnimateIn] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const conversationsChannelRef = useRef<any>(null);
  const messagesChannelRef = useRef<any>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    
    // Trigger animations after component mounts
    setTimeout(() => {
      setAnimateIn(true);
    }, 100);
  }, []);

  // Authentication logic (match account page)
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/login?redirectTo=/messages');
      return;
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (!session || !user || !supabase) return;
    fetchConversations();
    
    // Clean up existing subscriptions if they exist
    if (conversationsChannelRef.current) {
      conversationsChannelRef.current.unsubscribe();
      conversationsChannelRef.current = null;
    }
    
    if (messagesChannelRef.current) {
      messagesChannelRef.current.unsubscribe();
      messagesChannelRef.current = null;
    }
    
    // Set up real-time subscription for conversations updates
    conversationsChannelRef.current = supabase
      .channel('public:conversations')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'conversations'
      }, (payload: any) => {
        console.log('Conversation updated:', payload);
        // Refetch conversations when there's an update
        fetchConversations();
      });
    
    conversationsChannelRef.current.subscribe();
      
    // Set up real-time subscription for new messages
    messagesChannelRef.current = supabase
      .channel('public:messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload: any) => {
        console.log('New message:', payload);
        // Refetch conversations when there's a new message
        fetchConversations();
      });
    
    messagesChannelRef.current.subscribe();
      
    // Cleanup function
    return () => {
      if (conversationsChannelRef.current) {
        conversationsChannelRef.current.unsubscribe();
        conversationsChannelRef.current = null;
      }
      
      if (messagesChannelRef.current) {
        messagesChannelRef.current.unsubscribe();
        messagesChannelRef.current = null;
      }
    };
  }, [session, user, supabase, sessionLoading]);

  // Add loading timeout effect
  useEffect(() => {
    if (loading) {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => {
        if (loading) {
          setLoadingError('Loading timed out. Please try again.');
          setLoading(false);
        }
      }, 20000); // 20 seconds
    }
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [loading]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      // First, fetch conversations where user is the initiator (user_id)
      const { data: conversationsAsUser, error: conversationsAsUserError } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message,
          last_message_at,
          other_user_id,
          user_id
        `)
        .eq('user_id', user?.id)
        .order('last_message_at', { ascending: false });

      if (conversationsAsUserError) throw conversationsAsUserError;
      
      // Second, fetch conversations where user is the recipient (other_user_id)
      const { data: conversationsAsOtherUser, error: conversationsAsOtherUserError } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message,
          last_message_at,
          other_user_id,
          user_id
        `)
        .eq('other_user_id', user?.id)
        .order('last_message_at', { ascending: false });

      if (conversationsAsOtherUserError) throw conversationsAsOtherUserError;
      
      // Combine both sets of conversations
      const combinedConversations = [...(conversationsAsUser || []), ...(conversationsAsOtherUser || [])];
      // Sort by last_message_at (most recent first)
      combinedConversations.sort((a, b) => {
        const dateA = new Date(a.last_message_at || 0);
        const dateB = new Date(b.last_message_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      // Deduplicate by user pair (sorted), keeping only the most recent
      const uniqueMap = new Map();
      for (const conv of combinedConversations) {
        const pairKey = [conv.user_id, conv.other_user_id].sort().join('-');
        if (!uniqueMap.has(pairKey)) {
          uniqueMap.set(pairKey, conv);
        }
      }
      const dedupedConversations = Array.from(uniqueMap.values());
      if (!dedupedConversations || dedupedConversations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Get all conversation IDs to fetch notifications
      const conversationIds = dedupedConversations.map(conv => conv.id);
      console.log('Conversation IDs for notification lookup:', conversationIds);
      
      // Fetch unread message counts for each conversation
      const { data: notificationData, error: notificationError } = await supabase
        .from('message_notifications')
        .select('conversation_id, count')
        .in('conversation_id', conversationIds)
        .eq('user_id', user?.id)
        .eq('read', false);

      if (notificationError) {
        console.error('Error fetching notifications:', notificationError);
      }

      // Create a map of conversation_id to unread count
      const unreadCountMap = new Map();
      if (notificationData) {
        notificationData.forEach((notification: any) => {
          unreadCountMap.set(notification.conversation_id, notification.count);
        });
      }

      // Get all unique user IDs from conversations
      const allUserIds = new Set();
      dedupedConversations.forEach(conv => {
        if (conv.user_id !== user?.id) allUserIds.add(conv.user_id);
        if (conv.other_user_id !== user?.id) allUserIds.add(conv.other_user_id);
      });

      // Fetch user profiles for all participants
      const { data: userProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', Array.from(allUserIds));

      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError);
        setLoading(false);
        return;
      }

      // Create a map of user_id to profile
      const profileMap = new Map();
      userProfiles?.forEach((profile: any) => {
        profileMap.set(profile.user_id, profile);
      });

      // Format conversations with user data and unread counts
      const formattedConversations: FormattedConversation[] = dedupedConversations.map(conv => {
        const otherUserId = conv.user_id === user?.id ? conv.other_user_id : conv.user_id;
        const otherUserProfile = profileMap.get(otherUserId);
        
        return {
          id: conv.id,
          last_message: conv.last_message || 'No messages yet',
          last_message_at: conv.last_message_at || new Date().toISOString(),
          other_user: {
            id: otherUserId,
            username: otherUserProfile?.username || 'Unknown User',
            avatar_url: otherUserProfile?.avatar_url || null,
          },
          unread_count: unreadCountMap.get(conv.id) || 0,
        };
      });

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim() || !supabase) {
      setSearchResults([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, bio')
        .ilike('username', `%${query}%`)
        .neq('user_id', user?.id)
        .limit(10);
      if (error) throw error;
      // Deduplicate by username (case-insensitive)
      type UserProfile = { user_id: string; username: string; avatar_url: string | null; bio?: string };
      const uniqueUsersMap = new Map<string, UserProfile>();
      (data || []).forEach((u: UserProfile) => {
        const uname = u.username.toLowerCase();
        if (!uniqueUsersMap.has(uname)) {
          uniqueUsersMap.set(uname, u);
        }
      });
      const uniqueUsers = Array.from(uniqueUsersMap.values());
      setSearchResults(uniqueUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    }
  };

  const startConversation = async (userId: string) => {
    if (!user || !supabase) return;

    try {
      // Check if conversation already exists
      const { data: existingConversation, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user_id.eq.${user.id},other_user_id.eq.${userId}),and(user_id.eq.${userId},other_user_id.eq.${user.id})`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingConversation) {
        // Navigate to existing conversation
        router.push(`/messages/${existingConversation.id}`);
        return;
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          other_user_id: userId,
          last_message: 'Conversation started',
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;

      // Navigate to new conversation
      router.push(`/messages/${newConversation.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user || !supabase) return;

    try {
      setDeletingConversation(conversationId);
      
      // Delete all messages in the conversation first
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) {
        console.error('Error deleting messages:', messagesError);
        throw new Error('Failed to delete messages');
      }

      // Delete message notifications for this conversation
      const { error: notificationsError } = await supabase
        .from('message_notifications')
        .delete()
        .eq('conversation_id', conversationId);

      if (notificationsError) {
        console.error('Error deleting notifications:', notificationsError);
        // Don't throw here as this is not critical
      }

      // Delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (conversationError) {
        console.error('Error deleting conversation:', conversationError);
        throw new Error('Failed to delete conversation');
      }

      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Close confirmation dialog
      setShowDeleteConfirm(null);
      
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeletingConversation(null);
    }
  };

  const confirmDelete = (conversationId: string) => {
    setShowDeleteConfirm(conversationId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  // Show loading state while auth or profile is loading
  if (sessionLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting to login
  if (!session) {
    return null;
  }

  const getRandomBackground = (index: number) => {
    return MESSAGE_BACKGROUNDS[index % MESSAGE_BACKGROUNDS.length];
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  if (loadingError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <p className="text-red-500 mb-4">{loadingError}</p>
          <button
            onClick={() => { setLoadingError(null); setLoading(true); fetchConversations(); }}
            className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>messages | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-3xl mb-8 lowercase">messages</h1>
          
          {/* Search Section */}
          <div className="mb-8">
            <label className="block mb-2 text-[var(--foreground)] lowercase"></label>
            <div className="relative">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none transition-all duration-150 group-hover:text-blue-500 group-hover:scale-110 group-hover:opacity-80" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="search users to start a conversation..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                    className="w-full pl-12 pr-4 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent group"
                  />
                </div>
              </div>
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-[var(--background)] border border-outline rounded-xl shadow-xl overflow-hidden z-10">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2">
                      search results
                    </div>
                    {searchResults.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => startConversation(user.user_id)}
                        className="w-full px-4 py-3 bg-[var(--background)] hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl flex items-center gap-3 transition-all duration-200 group"
                      >
                        <div className="flex-shrink-0">
                          <Avatar
                            avatar_url={user.avatar_url}
                            username={user.username}
                            size={48}
                          />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {user.username}
                          </div>
                          {user.bio && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                              {user.bio}
                            </div>
                          )}
                        </div>
                        <FaUserPlus className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unread Count */}
          {totalUnread > 0 && (
            <div className="mb-8 p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <div className="flex items-center gap-2">
                <FaBell className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {totalUnread} unread message{totalUnread !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">conversations</h2>
              <div className="space-y-4">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl overflow-hidden border border-outline p-4 bg-transparent">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12 flex-shrink-0"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-1/3"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-2/3"></div>
                      </div>
                      <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-8 w-8"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && conversations.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-outline">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <FaComments className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">no conversations yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                  start connecting with your neighbors by searching for users above
                </p>
                <button 
                  onClick={() => searchInputRef.current?.focus()}
                  className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base flex items-center gap-2 mx-auto"
                >
                  <FaUserPlus className="w-4 h-4" />
                  find neighbors
                </button>
              </div>
            </div>
          ) : (
            /* Conversations List */
            !loading && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">conversations</h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {conversations.map((conversation) => (
                    <div key={conversation.id} className="relative group">
                      <Link
                        href={`/messages/${conversation.id}`}
                        className="block rounded-xl overflow-hidden p-4 border border-outline hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 relative">
                            <Avatar
                              avatar_url={conversation.other_user.avatar_url}
                              username={conversation.other_user.username}
                              size={48}
                            />
                            {conversation.unread_count > 0 && (
                              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[1.5rem] h-6 flex items-center justify-center border-2 border-white dark:border-gray-900">
                                {conversation.unread_count}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-base truncate">
                                {conversation.other_user.username}
                              </h3>
                              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-3">
                                {formatTimeAgo(conversation.last_message_at)}
                              </span>
                            </div>
                            <p className={`text-sm truncate ${conversation.unread_count > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                              {conversation.last_message}
                            </p>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Delete Button - appears on hover at the bottom */}
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            confirmDelete(conversation.id);
                          }}
                          className="p-2 text-red-500 rounded-lg hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 pointer-events-auto"
                          title="Delete conversation"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-md p-8 rounded-2xl shadow-lg border border-outline" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
            <h2 className="text-2xl mb-6 lowercase">delete conversation</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              are you sure you want to delete this conversation? this action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={cancelDelete}
                className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deletingConversation === showDeleteConfirm}
              >
                cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(showDeleteConfirm)}
                disabled={deletingConversation === showDeleteConfirm}
                className="px-6 py-3 border border-red-200 dark:border-red-800 text-red-500 bg-transparent hover:opacity-80 hover:bg-red-50 dark:hover:bg-red-900/20 hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingConversation === showDeleteConfirm ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                    deleting...
                  </>
                ) : (
                  <>
                    <FaTrash className="w-4 h-4" />
                    delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}