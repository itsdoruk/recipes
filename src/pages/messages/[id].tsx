import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getBrowserClient, removeChannel } from '@/lib/supabase/browserClient';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import Image from 'next/image';
import Link from 'next/link';
import MessageRecipeCard from '@/components/MessageRecipeCard';
import ReportButton from '@/components/ReportButton';
import { Message, Conversation, ExtendedConversation } from '@/types/supabase';
import Avatar from '@/components/Avatar';

export default function MessagePage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, user, loading: sessionLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ExtendedConversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [supabase, setSupabase] = useState<any>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Supabase client on the client side
  useEffect(() => {
    const initSupabase = async () => {
      try {
        setSupabase(getBrowserClient());
      } catch (error) {
        console.error('Error initializing Supabase:', error);
        setConversationError('Failed to initialize database connection');
      }
    };
    initSupabase();
  }, []);

  // Wait for router to be ready before proceeding
  useEffect(() => {
    if (!router.isReady) return;

    if (sessionLoading || !supabase) {
      console.log('Waiting for dependencies:', { sessionLoading, hasSupabase: !!supabase });
      return;
    }
    
    if (sessionLoading || profileLoading) return;
    if (!session) {
      const redirectPath = id ? `/login?redirectTo=/messages/${id}` : '/login';
      router.push(redirectPath);
      return;
    }

    console.log('Starting to fetch messages for conversation:', id);

    // Set a timeout for loading - increased to 30 seconds
    loadingTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.log('Loading timed out after 30 seconds');
        setLoading(false);
        setConversationError('Loading timed out. Please refresh the page.');
      }
    }, 30000); // 30 second timeout

    // Load conversation first, then messages
    const loadData = async () => {
      try {
        await fetchConversation();
        await fetchMessages();
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };
    
    loadData();
    
    // Mark conversation as read when viewing
    if (session && id) {
      markConversationAsRead();
    }

    // Clean up existing subscription if it exists
    if (subscriptionRef.current) {
      console.log('Cleaning up existing subscription');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    // Set up realtime subscription with retry logic
    const setupSubscription = async () => {
      try {
        const channelName = `messages:${id}`;
        console.log('Setting up subscription for channel:', channelName);
        
        subscriptionRef.current = supabase
          .channel(channelName)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${id}` 
          }, (payload: any) => {
            console.log('Real-time message received:', payload);
            // Ensure we're getting the complete message data
            if (payload.new) {
              // Fetch the complete message data to ensure we have all fields
              supabase
                .from('messages')
                .select('id, content, created_at, sender_id, conversation_id, recipe_id, recipe_type')
                .eq('id', payload.new.id)
                .single()
                .then(({ data, error }: { data: any; error: any }) => {
                  if (error) {
                    console.error('Error fetching complete message data:', error);
                    handleNewMessage(payload); // Fall back to original payload
                  } else if (data) {
                    console.log('Fetched complete message data:', data);
                    // Create a new payload with the complete data
                    const completePayload = { ...payload, new: data };
                    handleNewMessage(completePayload);
                  }
                })
                .catch((error: Error) => {
                  console.error('Error in message data fetch:', error);
                  handleNewMessage(payload); // Fall back to original payload
                });
            } else {
              handleNewMessage(payload);
            }
          })
          .subscribe((status: any) => {
            console.log('Subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('Successfully subscribed to channel:', channelName);
            } else if (status === 'CLOSED') {
              console.log('Subscription closed, attempting to reconnect...');
              // Attempt to reconnect after a delay
              setTimeout(() => {
                if (subscriptionRef.current) {
                  console.log('Reconnecting subscription...');
                  setupSubscription();
                }
              }, 1000);
            }
          });
      } catch (error) {
        console.error('Error setting up subscription:', error);
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (subscriptionRef.current) {
            console.log('Retrying subscription setup...');
            setupSubscription();
          }
        }, 1000);
      }
    };

    setupSubscription();

    return () => {
      console.log('Cleaning up subscription and timeout');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [router.isReady, id, supabase, sessionLoading, profileLoading, session, router]);

  // Add an effect to mark conversation as read when messages change
  useEffect(() => {
    if (session && id && supabase && messages.length > 0 && !loading) {
      markConversationAsRead();
    }
  }, [messages, id, session, supabase, loading]);

  const fetchConversation = async () => {
    if (!session || !id || !user) {
      console.log('Cannot fetch conversation:', { hasUser: !!session, id });
      return;
    }
    try {
      console.log('Starting to fetch conversation:', { id, userId: user?.id });
      setConversationError(null);
      
      // Try to fetch the conversation directly first
      console.log('Fetching conversation directly');
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, user_id, other_user_id, created_at, updated_at, last_message_at, last_message')
        .eq('id', id)
        .single();
      
      console.log('Direct conversation query result:', { data: conversationData, error: conversationError });
      
      if (conversationError) {
        console.error('Error fetching conversation:', conversationError);
        throw conversationError;
      }
      
      if (!conversationData) {
        console.log('Conversation not found');
        throw new Error('Conversation not found');
      }
      
      // Verify that the current user is either the initiator or recipient
      if (conversationData.user_id !== user.id && conversationData.other_user_id !== user.id) {
        console.log('User is not part of this conversation');
        throw new Error('You do not have access to this conversation');
      }
      
      // Determine which user is the "other" user
      const otherUserId = conversationData.user_id === user.id 
        ? conversationData.other_user_id 
        : conversationData.user_id;
      
      console.log('Fetching profile for other user:', otherUserId);
      
      // Fetch the profile data of other user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .eq('user_id', otherUserId)
        .single();
      
      console.log('Profile fetch result:', { data: profileData, error: profileError });
      
      // Create a conversation object with the required fields
      const conversation: ExtendedConversation = {
        id: conversationData.id,
        user1_id: conversationData.user_id,
        user2_id: conversationData.other_user_id,
        created_at: conversationData.created_at,
        updated_at: conversationData.updated_at,
        last_message_at: conversationData.last_message_at,
        other_user: {
          id: profileData?.user_id || otherUserId,
          username: profileData?.username || 'Unknown',
          avatar_url: profileData?.avatar_url || null
        },
        last_message: conversationData.last_message
      };
      
      console.log('Setting conversation:', conversation);
      setConversation(conversation);
    } catch (error) {
      console.error('Error in fetchConversation:', error);
      setConversationError('Failed to load conversation. Please try again.');
      // If we can't load the conversation, redirect back to messages
      router.push('/messages');
    }
  };

  const fetchMessages = async () => {
    if (!user) return;
    try {
      console.log('fetchMessages called with id:', id);
      if (!id) {
        console.log('No conversation ID available');
        return;
      }
      setMessagesError(null);

      // Fetch messages first
      console.log('Fetching messages from Supabase');
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, conversation_id, recipe_id, recipe_type')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        throw messagesError;
      }

      console.log('Messages fetched:', messagesData?.length || 0);

      // If there are no messages, just set empty array and return
      if (!messagesData || messagesData.length === 0) {
        console.log('No messages found');
        setMessages([]);
        setLoading(false);
        return;
      }

      // Get unique sender IDs to fetch profiles
      const senderIds = Array.from(new Set(messagesData.map((msg: any) => msg.sender_id)));
      console.log('Fetching profiles for senders:', senderIds);
      
      // Fetch all relevant profiles in a single query
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', senderIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('Profiles fetched:', profilesData?.length || 0);

      // Map profiles to a lookup object
      const profilesMap = (profilesData || []).reduce((acc: Record<string, any>, profile: any) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      // Combine messages with profile data
      const messagesWithProfiles = messagesData.map((msg: any) => ({
        ...msg,
        sender: profilesMap[msg.sender_id] || { 
          username: msg.sender_id === user.id ? 'You' : 'Unknown', 
          avatar_url: null
        }
      }));

      console.log('Setting messages with profiles:', messagesWithProfiles.length);
      setMessages(messagesWithProfiles);
      
      // Scroll to bottom after fetching messages
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setMessagesError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = async (payload: any) => {
    if (!user) return;
    console.log('New message payload:', payload);
    console.log('Recipe data in payload:', {
      recipe_id: payload.new.recipe_id,
      recipe_type: payload.new.recipe_type
    });
    
    // Get sender profile data
    const { data: profileData } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('user_id', payload.new.sender_id)
      .single();
    
    const senderInfo = profileData || { 
      username: payload.new.sender_id === user.id ? 'You' : 'Unknown', 
      avatar_url: null
    };
    
    // Make sure we include recipe_id and recipe_type if they exist
    const newMessage = {
      ...payload.new,
      recipe_id: payload.new.recipe_id || null,
      recipe_type: payload.new.recipe_type || null,
      sender: senderInfo
    };
    
    console.log('Processed new message with recipe data:', newMessage);
    
    setMessages(prev => {
      // Check if message already exists to avoid duplicates
      const exists = prev.some(msg => msg.id === newMessage.id);
      if (exists) {
        console.log('Message already exists in state, not adding duplicate');
        return prev;
      }
      
      const updated = [...prev, newMessage];
      console.log('Updated messages state with new message');
      return updated;
    });
    
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isRecipeUrl = (content: string) => {
    // Early return for empty content or non-string content
    if (!content || typeof content !== 'string') return null;

    // Trim the content to ensure clean matching
    const trimmedContent = content.trim();
    
    // Extract recipe IDs from full URLs or relative paths
    // Match patterns like:
    // - /recipe/3427a19a-d823-433c-a683-ac7864e264a1
    // - https://example.com/recipe/3427a19a-d823-433c-a683-ac7864e264a1
    
    // First, try to match the full URL pattern
    const fullUrlMatch = trimmedContent.match(/(?:https?:\/\/[^\/]+)?\/recipe\/([0-9a-f-]+)/i);
    if (fullUrlMatch) {
      console.log('Matched recipe URL:', fullUrlMatch[1]);
      return { id: fullUrlMatch[1], type: 'user' as const };
    }
    
    // Then try to match internet recipes
    const internetRecipeMatch = trimmedContent.match(/(?:https?:\/\/[^\/]+)?\/internet-recipe\/([0-9a-f-]+)/i);
    if (internetRecipeMatch) {
      console.log('Matched internet recipe URL:', internetRecipeMatch[1]);
      return { id: internetRecipeMatch[1], type: 'ai' as const };
    }
    
    return null;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    if (!user || !newMessage.trim() || !session || !id || !supabase) {
      const errorMessage = !newMessage.trim() ? 'Please enter a message' : 
                           !session ? 'User not authenticated' : 
                           !id ? 'Missing conversation ID' : 
                           !supabase ? 'Supabase client not initialized' : 
                           'Missing required information';
      setSendError(errorMessage);
      return;
    }
    console.log('sendMessage called', { newMessage, session, id, supabase });
    
    // Check if the message contains a recipe URL
    const recipeInfo = isRecipeUrl(newMessage.trim());
    console.log('Recipe URL check result:', recipeInfo);

    const messageData: any = {
      conversation_id: id,
      content: newMessage.trim(),
      sender_id: user.id,
      is_read: false // Explicitly set as unread
    };

    // If the message contains a recipe URL, add recipe_id and recipe_type
    if (recipeInfo) {
      messageData.recipe_id = recipeInfo.id;
      messageData.recipe_type = recipeInfo.type;
      console.log('Added recipe data to message:', { recipe_id: recipeInfo.id, recipe_type: recipeInfo.type });
    }

    try {
      console.log('Sending message data:', messageData);
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select();

      if (error) throw error;
      
      console.log('Message sent successfully:', data);
      
      // Add the message to the local state immediately for better UX
      if (data && data.length > 0) {
        const sentMessage = {
          ...data[0],
          sender: {
            username: (session && 'username' in session ? session.username : 'You'),
            avatar_url: (session && 'avatar_url' in session ? session.avatar_url : null)
          }
        };
        
        setMessages(prev => [...prev, sentMessage]);
        scrollToBottom();
      }
      
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      setSendError(error.message || 'Failed to send message.');
    }
  };

  // Share a recipe by sending its URL as a message
  const shareRecipe = async (recipeId: string, recipeType: 'user' | 'ai' | 'spoonacular') => {
    if (!session || !id || !user) return;

    try {
      // Instead of putting the recipe URL in the content, use the dedicated fields
      const messageData = {
        conversation_id: id,
        content: newMessage.trim(), // Use the actual message text
        sender_id: user.id,
        recipe_id: recipeId, // Store recipe ID in dedicated field
        recipe_type: recipeType, // Store recipe type in dedicated field
        is_read: false
      };

      console.log('Sending recipe message:', messageData);
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select();

      if (error) throw error;
      
      console.log('Recipe message sent successfully:', data);
      
      // Add the message to the local state immediately for better UX
      if (data && data.length > 0) {
        const sentMessage = {
          ...data[0],
          sender: {
            username: (session && 'username' in session ? session.username : 'You'),
            avatar_url: (session && 'avatar_url' in session ? session.avatar_url : null)
          }
        };
        
        console.log('Adding recipe message to local state:', sentMessage);
        setMessages(prev => [...prev, sentMessage]);
        scrollToBottom();
      }
      
      setNewMessage(''); // Clear the input field
    } catch (error: any) {
      console.error('Error sharing recipe:', error);
      setSendError(error.message || 'Failed to share recipe.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    if (!session) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      alert('Failed to delete message.');
    }
  };

  const markConversationAsRead = async () => {
    if (!session || !id || !supabase || !user) return;
    
    try {
      console.log('Marking conversation as read:', id);
      
      // Call the RPC function to mark the conversation as read
      const { error } = await supabase
        .rpc('mark_conversation_read', {
          p_conversation_id: id,
          p_user_id: user.id
        });
      
      if (error) {
        console.error('Error marking conversation as read:', error);
      } else {
        console.log('Conversation marked as read successfully');
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  // Helper function to render each message
  const renderMessage = (message: any) => {
    const isCurrentUser = user && message.sender_id === user.id;
    
    // Check for recipe data
    const hasRecipe = Boolean(message.recipe_id && message.recipe_type);
    console.log('Rendering message:', { 
      id: message.id, 
      content: message.content,
      hasRecipe,
      recipe_id: message.recipe_id,
      recipe_type: message.recipe_type 
    });

    return (
      <div 
        key={message.id} 
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} relative group`}
      >
        <div
          className={`relative ${hasRecipe ? 'w-full max-w-md' : 'max-w-[65%]'} px-3 py-2 rounded-lg ${
            isCurrentUser 
              ? 'border border-outline bg-transparent' 
              : 'border border-outline bg-transparent'
          }`}
        >
          {hasRecipe && (
            <div className="mb-2">
              <MessageRecipeCard
                key={`recipe-${message.id}-${message.recipe_id}`}
                recipeId={message.recipe_id}
                recipeType={message.recipe_type}
              />
            </div>
          )}
          
          {/* Always show the message content, whether there's a recipe or not */}
          {message.content && message.content.trim() && (
            <p className="break-words">{message.content}</p>
          )}
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex justify-between items-center gap-2 pt-1 border-t border-outline dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="inline-block text-xs">{message.sender?.username || 'unknown'}</span>
              <span className="inline-block text-xs">{new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            
            <div className="flex gap-1 hidden group-hover:flex">
              <ReportButton recipeId={message.id} recipeType="message" />
              {user && message.sender_id === user.id && (
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="px-1.5 py-0.5 rounded-lg text-red-500 text-xs hover:opacity-80 transition-opacity flex items-center"
                  aria-label="Delete message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M6 6v8m4-8v8m4-8v8M3 6h14M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (sessionLoading || profileLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
      </div>
    );
  }

  if (!session || !user) {
    return null;
  }

  if (conversationError || messagesError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[80vh] items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-center">
          <p className="text-red-500 mb-4">{conversationError || messagesError}</p>
          <Link href="/messages" className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg inline-block">
            ← back to messages
          </Link>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[80vh] items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-center">
          <p className="mb-4">Conversation not found</p>
          <Link href="/messages" className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg inline-block">
            ← back to messages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[80vh]" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="mb-6">
        <Link href="/messages" className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg inline-block">
          ← back to messages
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <div className="relative w-12 h-12" style={{ background: "var(--background)", color: "var(--foreground)" }}>
            {conversation.other_user && (
              <Avatar 
                avatar_url={conversation.other_user.avatar_url} 
                username={conversation.other_user.username} 
                size={48}
              />
            )}
          </div>
          <h1 className="text-xl font-semibold">
            {conversation.other_user ? conversation.other_user.username : 'unknown user'}
          </h1>
        </div>
      </div>

      {/* Chatbot-style scrollable messages area */}
      <div className="flex-1 overflow-y-auto p-4 border border-outline mb-4 rounded-lg" style={{ minHeight: '0' }}>
        {loading ? (
          <div className="text-center py-8">loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            no messages yet. start the conversation!
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {messages.map((message) => renderMessage(message))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input stays at the bottom */}
      <form id="message-form" onSubmit={sendMessage} className="flex gap-2 mt-auto">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="type a message..."
          className="flex-1 px-4 py-3 border border-outline bg-transparent rounded-lg"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="px-5 py-3 border border-outline bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg"
        >
          send
        </button>
      </form>
      {sendError && (
        <div className="text-red-500 text-sm mt-2">{sendError}</div>
      )}
    </div>
  );
} 