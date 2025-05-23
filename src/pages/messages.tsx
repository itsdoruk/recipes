import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import Image from 'next/image';
import Link from 'next/link';
import Head from 'next/head';
import Avatar from '@/components/Avatar';

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
  'bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-900/30 dark:to-gray-800/20',
  'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20',
  'bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20',
  'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20',
  'bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-800/20',
];

export default function MessagesPage() {
  const router = useRouter();
  const { session, user, loading: sessionLoading } = useAuth();
  const [conversations, setConversations] = useState<FormattedConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState(() => getSupabaseClient());
  const [animateIn, setAnimateIn] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const conversationsChannelRef = useRef<any>(null);
  const messagesChannelRef = useRef<any>(null);

  // Initialize Supabase client on the client side
  useEffect(() => {
    const initSupabase = async () => {
      try {
        setSupabase(getSupabaseClient());
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
      
      if (!combinedConversations || combinedConversations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Get all conversation IDs to fetch notifications
      const conversationIds = combinedConversations.map(conv => conv.id);
      console.log('Conversation IDs for notification lookup:', conversationIds);
      
      // Fetch message notifications for the current user
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('message_notifications')
        .select('conversation_id, count')
        .eq('user_id', user?.id)
        .in('conversation_id', conversationIds);
        
      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError);
      } else {
        console.log('Fetched notifications:', notificationsData);
      }
      
      // Create a lookup map for notifications
      const notificationsMap = (notificationsData || []).reduce((acc: Record<string, number>, notification: any) => {
        acc[notification.conversation_id] = notification.count;
        return acc;
      }, {});
      
      // Collect all user IDs that need profile data
      const userIds = combinedConversations.map((conv: any) => {
        // If current user is the initiator, we need the other user's profile
        // If current user is the recipient, we need the initiator's profile
        return conv.user_id === user?.id ? conv.other_user_id : conv.user_id;
      });
      
      // Fetch profiles for all users in one query
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);
        
      if (profilesError) throw profilesError;
      
      // Create a lookup map for profiles
      const profilesMap = (profilesData || []).reduce((acc: Record<string, any>, profile: any) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});
      
      // Format the conversations with user info
      let formattedConversations: FormattedConversation[] = combinedConversations.map((conv: any) => {
        // Determine which user is the "other" user in this conversation
        const otherUserId = conv.user_id === user?.id ? conv.other_user_id : conv.user_id;
        
        return {
          id: conv.id,
          last_message: conv.last_message,
          last_message_at: conv.last_message_at,
          other_user: {
            id: otherUserId,
            username: profilesMap[otherUserId]?.username || 'Unknown User',
            avatar_url: profilesMap[otherUserId]?.avatar_url || null
          },
          unread_count: notificationsMap[conv.id] || 0
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
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, bio')
        .ilike('username', `%${query}%`)
        .neq('user_id', user?.id)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const startConversation = async (userId: string) => {
    if (!session || !supabase) {
      router.push('/login');
      return;
    }

    try {
      // First check if conversation already exists 
      // Check for existing conversations where both users are involved
      const { data: existingConversations, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user_id.eq.${user?.id},other_user_id.eq.${userId}),and(user_id.eq.${userId},other_user_id.eq.${user?.id})`);
      
      if (existingError) throw existingError;
      
      if (existingConversations && existingConversations.length > 0) {
        // Conversation already exists, navigate to it
        router.push(`/messages/${existingConversations[0].id}`);
        return;
      }
      
      // If no existing conversation, create a new one
      const { data, error } = await supabase
        .rpc('create_conversation', {
          p_other_user_id: userId,
          p_other_username: searchResults.find(u => u.user_id === userId)?.username || 'User'
        });

      if (error) throw error;
      router.push(`/messages/${data}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
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

  return (
    <>
      <Head>
        <title>messages | [recipes]</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">messages</h1>
          </div>

          {/* Unread messages banner */}
          {!loading && conversations.some(conv => conv.unread_count > 0) && (
            <div className="rounded-xl p-4 border border-outline bg-transparent space-y-2">
              <h3 className="font-medium">unread messages</h3>
              {conversations
                .filter(conv => conv.unread_count > 0)
                .map(conv => (
                  <div key={`notification-${conv.id}`} className="flex justify-between items-center">
                    <Link 
                      href={`/messages/${conv.id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <Avatar
                        avatar_url={conv.other_user.avatar_url}
                        username={conv.other_user.username}
                        size={32}
                      />
                      <span>
                        <span className="font-medium">{conv.unread_count}</span> unread {conv.unread_count === 1 ? 'message' : 'messages'} from{' '}
                        <span className="font-medium">{conv.other_user.username}</span>
                      </span>
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(conv.last_message_at)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div className="relative">
            <div className="flex gap-2">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="search users to start a conversation..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 px-4 py-3 border border-outline bg-transparent rounded-lg"
              />
              <button
                onClick={() => handleSearch(searchQuery)}
                className="px-5 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
              >
                search
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-transparent rounded-xl shadow-lg border border-outline overflow-hidden z-10">
                {searchResults.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => startConversation(user.user_id)}
                    className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <Avatar
                        avatar_url={user.avatar_url}
                        username={user.username}
                        size={40}
                      />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block">{user.username}</span>
                      {user.bio && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate block max-w-xs">{user.bio}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className="grid grid-cols-1 gap-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl overflow-hidden border border-outline p-4 bg-transparent">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-1/2"></div>
                    </div>
                    <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-6 w-6"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && conversations.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-outline bg-transparent">
              <h3 className="text-xl font-semibold mb-2">no conversations yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                start a new conversation by searching for a user above
              </p>
              <button 
                onClick={() => searchInputRef.current?.focus()}
                className="px-5 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
              >
                find neighbors
              </button>
            </div>
          ) : (
            !loading && (
              <div className="space-y-4">
                <h2 className="text-xl">conversations</h2>
                <div className="grid grid-cols-1 gap-4">
                  {conversations.map((conversation, index) => (
                    <Link
                      key={conversation.id}
                      href={`/messages/${conversation.id}`}
                      className="group rounded-xl overflow-hidden p-4 flex items-center gap-4 bg-transparent border border-outline"
                    >
                      <div className="flex-shrink-0">
                        <Avatar
                          avatar_url={conversation.other_user.avatar_url}
                          username={conversation.other_user.username}
                          size={48}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold truncate">
                            {conversation.other_user.username}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2 opacity-80">
                            {formatTimeAgo(conversation.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-sm truncate mt-1 ${conversation.unread_count > 0 ? 'font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                          {conversation.last_message}
                        </p>
                      </div>
                      {conversation.unread_count > 0 && (
                        <div className="border border-outline text-xs font-bold px-2 py-1 rounded-full min-w-[1.5rem] h-6 flex items-center justify-center">
                          {conversation.unread_count}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </main>
    </>
  );
}