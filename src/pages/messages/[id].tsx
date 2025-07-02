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
import { useUser } from '@supabase/auth-helpers-react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useMessageNotifications } from '@/hooks/useNotifications';
import { FaSearch, FaTimes, FaChevronUp, FaChevronDown, FaArrowLeft, FaPaperPlane, FaTrash } from 'react-icons/fa';
import { MdEdit, MdDelete, MdSave, MdCancel } from 'react-icons/md';
import { marked } from 'marked';

// Add custom renderer for quotes to show | instead of >
const renderer = new marked.Renderer();
renderer.blockquote = (quote) => {
  return `<div class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2">${quote}</div>`;
};
renderer.hr = () => {
  return '<hr class="my-4 border-t border-outline dark:border-gray-700" />';
};

// Configure marked to use the custom renderer
marked.setOptions({ renderer, breaks: true });

// Add markdown formatting functions after the imports and before the component
const insertMarkdown = (text: string, start: number, end: number, before: string, after: string = '') => {
  const beforeText = text.substring(0, start);
  const selectedText = text.substring(start, end);
  const afterText = text.substring(end);
  return beforeText + before + selectedText + after + afterText;
};

export default function MessagePage() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  const { session, loading: sessionLoading } = useAuth();
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
  const { sendMessageNotification } = useMessageNotifications();
  
  // Find in conversation state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);

  // Add ref for the edit textarea
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Add markdown formatting function
  const formatText = (format: string, textarea: HTMLTextAreaElement | null, setContent: (value: string) => void) => {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    let newText = '';
    switch (format) {
      case 'bold':
        newText = insertMarkdown(currentText, start, end, '**', '**');
        break;
      case 'italic':
        newText = insertMarkdown(currentText, start, end, '*', '*');
        break;
      case 'code':
        newText = insertMarkdown(currentText, start, end, '`', '`');
        break;
      case 'link': {
        const url = prompt('Enter URL:');
        if (!url) return; // If cancelled, do nothing
        newText = insertMarkdown(currentText, start, end, `[${currentText.substring(start, end) || 'link text'}](${url})`);
        break;
      }
      case 'image': {
        const imageUrl = prompt('Enter image URL:');
        if (!imageUrl) return; // If cancelled, do nothing
        const altText = prompt('Enter alt text (optional):') || 'image';
        newText = insertMarkdown(currentText, start, end, `![${altText}](${imageUrl})`);
        break;
      }
      case 'list':
        if (start === end) {
          // No selection: insert a single bullet
          const insert = '- list item';
          setContent(currentText.substring(0, start) + insert + currentText.substring(end));
          setTimeout(() => {
            if (textarea) textarea.setSelectionRange(start + 2, start + 11); // select 'list item'
          }, 0);
          return;
        } else {
          // Prefix each selected line with '- '
          const selectedText = currentText.substring(start, end);
          const lines = selectedText.split('\n');
          const bulleted = lines
            .map(line => {
              const trimmed = line.trim();
              if (!trimmed) return ''; // Skip empty lines
              // Remove existing bullets if present
              const cleanLine = trimmed.replace(/^[-*]\s*/, '');
              return `- ${cleanLine}`;
            })
            .filter(line => line !== '') // Remove empty lines
            .join('\n');
          
          const newText = currentText.substring(0, start) + bulleted + currentText.substring(end);
          setContent(newText);
          setTimeout(() => {
            if (textarea) textarea.setSelectionRange(start, start + bulleted.length);
          }, 0);
          return;
        }
        break;
      case 'quote':
        if (start === end) {
          // No selection: insert a single quote
          const insert = '> quote text';
          setContent(currentText.substring(0, start) + insert + currentText.substring(end));
          setTimeout(() => {
            if (textarea) textarea.setSelectionRange(start + 2, start + 12); // select 'quote text'
          }, 0);
          return;
        } else {
          // Prefix each selected line with '> '
          const selectedText = currentText.substring(start, end);
          const lines = selectedText.split('\n');
          const quoted = lines
            .map(line => {
              const trimmed = line.trim();
              if (!trimmed) return ''; // Skip empty lines
              // Remove existing quote prefix if present
              const cleanLine = trimmed.replace(/^>\s*/, '');
              return `> ${cleanLine}`;
            })
            .filter(line => line !== '') // Remove empty lines
            .join('\n');
          
          const newText = currentText.substring(0, start) + quoted + currentText.substring(end);
          setContent(newText);
          setTimeout(() => {
            if (textarea) textarea.setSelectionRange(start, start + quoted.length);
          }, 0);
          return;
        }
        break;
    }
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      if (format === 'link' || format === 'image') {
        textarea.setSelectionRange(start, start);
      } else {
        const newStart = start + (format === 'bold' || format === 'italic' || format === 'code' ? 2 : 0);
        const newEnd = end + (format === 'bold' || format === 'italic' || format === 'code' ? 2 : 0);
        textarea.setSelectionRange(newStart, newEnd);
      }
    }, 0);
  };

  // Add MarkdownToolbar component
  const MarkdownToolbar = ({ textarea, setContent }: { textarea: HTMLTextAreaElement | null, setContent: (value: string) => void }) => (
    <div className="flex flex-wrap gap-2 mb-2 p-3 border border-outline rounded-lg bg-transparent">
      <button
        type="button"
        onClick={() => formatText('bold', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm font-bold"
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => formatText('italic', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm italic"
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => formatText('code', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm font-mono"
        title="Code"
      >
        {'</>'}
      </button>
      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button
        type="button"
        onClick={() => formatText('list', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm"
        title="list"
      >
        • list
      </button>
      <button
        type="button"
        onClick={() => formatText('quote', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm"
        title="quote"
      >
        " quote
      </button>
    </div>
  );

  // Add ref for the message input textarea
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

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
        setLoading(false);
        setConversationError('Loading timed out. Please try again.');
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
                .select('id, content, created_at, updated_at, sender_id, conversation_id, recipe_id, recipe_type')
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

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    
    messages.forEach((message, index) => {
      if (message.content && message.content.toLowerCase().includes(query)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, messages]);

  // Scroll to current search result
  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults.length > 0) {
      const messageIndex = searchResults[currentSearchIndex];
      const messageId = messages[messageIndex]?.id;
      const messageElement = messageRefs.current[messageId];
      
      if (messageElement) {
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        // Add highlight effect
        messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
        }, 2000);
      }
    }
  }, [currentSearchIndex, searchResults, messages]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearch(false);
    setSearchResults([]);
    setCurrentSearchIndex(0);
  };

  const nextSearchResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((prev) => 
      prev < searchResults.length - 1 ? prev + 1 : 0
    );
  };

  const previousSearchResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex((prev) => 
      prev > 0 ? prev - 1 : searchResults.length - 1
    );
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  const fetchConversation = async () => {
    if (!session || !id || !user) {
      console.log('Cannot fetch conversation:', { hasUser: !!session, id });
      setLoading(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      return;
    }
    try {
      console.log('Starting to fetch conversation:', { id, userId: user?.id });
      setConversationError(null);
      
      // Fetch conversation details
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select(`
          id,
          user_id,
          other_user_id,
          last_message,
          last_message_at
        `)
        .eq('id', id)
        .single();
      
      if (conversationError) {
        console.error('Error fetching conversation:', conversationError);
        setConversationError('Failed to load conversation');
        setLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        return;
      }
      
      if (!conversationData) {
        setConversationError('Conversation not found');
        setLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        return;
      }
      
      // Determine which user is the "other" user
      const otherUserId = conversationData.user_id === user.id 
        ? conversationData.other_user_id 
        : conversationData.user_id;
      
      // Fetch the other user's profile
      const { data: otherUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .eq('user_id', otherUserId)
        .single();
      
      if (profileError) {
        console.error('Error fetching other user profile:', profileError);
      }

      const extendedConversation: ExtendedConversation = {
        ...conversationData,
        other_user: otherUserProfile || {
          user_id: otherUserId,
          username: 'Unknown User',
          avatar_url: null
        }
      };

      setConversation(extendedConversation);
      console.log('Conversation loaded:', extendedConversation);
    } catch (error) {
      console.error('Error in fetchConversation:', error);
      setConversationError('Failed to load conversation');
      setLoading(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    }
  };

  const fetchMessages = async () => {
    if (!session || !id || !user) {
      console.log('Cannot fetch messages:', { hasUser: !!session, id });
      setLoading(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      return;
    }
    
    try {
      console.log('Starting to fetch messages for conversation:', id);
      setMessagesError(null);

      // Fetch messages with sender information
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          updated_at,
          sender_id,
          conversation_id,
          recipe_id,
          recipe_type
        `)
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setMessagesError('Failed to load messages');
        setLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        return;
      }

      if (!messagesData) {
        setMessages([]);
        setLoading(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        return;
      }

      // Fetch sender profiles for all messages
      const senderIds = Array.from(new Set(messagesData.map((msg: any) => msg.sender_id)));
      const { data: senderProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', senderIds);

      if (profilesError) {
        console.error('Error fetching sender profiles:', profilesError);
      }

      // Create a map of sender_id to profile
      const profileMap = new Map();
      senderProfiles?.forEach((profile: any) => {
        profileMap.set(profile.user_id, profile);
      });

      // Add sender information to messages
      const messagesWithSenders = messagesData.map((message: any) => ({
        ...message,
        sender: profileMap.get(message.sender_id) || {
          user_id: message.sender_id,
          username: 'Unknown User',
          avatar_url: null
        }
      }));

      setMessages(messagesWithSenders);
      console.log('Messages loaded:', messagesWithSenders.length);
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setMessagesError('Failed to load messages');
      setLoading(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    } finally {
      setLoading(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    }
  };

  const handleNewMessage = async (payload: any) => {
    console.log('Handling new message:', payload);
    
    if (payload.new && payload.new.conversation_id === id) {
      try {
        // Fetch the complete message with sender information
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            updated_at,
            sender_id,
            conversation_id,
            recipe_id,
            recipe_type
          `)
          .eq('id', payload.new.id)
          .single();

        if (messageError) {
          console.error('Error fetching new message data:', messageError);
          return;
        }

        // Fetch sender profile
        const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
          .select('user_id, username, avatar_url')
          .eq('user_id', messageData.sender_id)
      .single();
    
        if (profileError) {
          console.error('Error fetching sender profile:', profileError);
        }

        const messageWithSender = {
          ...messageData,
          sender: senderProfile || {
            user_id: messageData.sender_id,
      avatar_url: null
          }
        };

        setMessages(prev => [...prev, messageWithSender]);
        
        // Instead, send notification to the other user in the conversation
        const recipientId = conversation
          ? (conversation.user_id === messageData.sender_id
              ? conversation.other_user_id
              : conversation.user_id)
          : undefined;
        if (recipientId && recipientId !== user?.id) {
          sendMessageNotification(recipientId, messageData.sender_id, id as string, messageData.content);
        }
        
        // Scroll to bottom after a short delay
        setTimeout(() => {
    scrollToBottom();
        }, 100);
      } catch (error) {
        console.error('Error handling new message:', error);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isRecipeUrl = (content: string) => {
    // Check if the content contains a recipe URL pattern
    const recipeUrlPattern = /\/recipe\/[a-zA-Z0-9-]+/;
    return recipeUrlPattern.test(content);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // If loading is still true, clear it and the timeout (user is interacting)
    if (loading) {
      setLoading(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }
    if (!newMessage.trim() || !session || !id || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSendError(null);

    try {
    // Check if the message contains a recipe URL
      if (isRecipeUrl(messageContent)) {
        // Extract recipe ID and type from URL
        const recipeMatch = messageContent.match(/\/recipe\/([a-zA-Z0-9-]+)/);
        if (recipeMatch) {
          const recipeId = recipeMatch[1];
          
          // Determine recipe type (this is a simplified approach)
          let recipeType: 'user' | 'ai' | 'spoonacular' = 'user';
          if (recipeId.startsWith('ai-')) {
            recipeType = 'ai';
          } else if (recipeId.startsWith('spoonacular-')) {
            recipeType = 'spoonacular';
          }

          // Create message with recipe data
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .insert({
              content: messageContent,
      conversation_id: id,
      sender_id: user.id,
              recipe_id: recipeId,
              recipe_type: recipeType
            })
            .select()
            .single();

          if (messageError) throw messageError;

          // Update conversation's last message
          await supabase
            .from('conversations')
            .update({
              last_message: messageContent,
              last_message_at: new Date().toISOString()
            })
            .eq('id', id);

          // Add message to local state
          const messageWithSender = {
            ...messageData,
            sender: {
              user_id: user.id,
              username: profile?.username || 'You',
              avatar_url: profile?.avatar_url || null
            }
          };

          setMessages(prev => [...prev, messageWithSender]);

          // Send notification to the other user
          const recipientId = conversation
            ? (conversation.user_id === user.id
                ? conversation.other_user_id
                : conversation.user_id)
            : undefined;
          if (recipientId && recipientId !== user.id) {
            sendMessageNotification(recipientId, user.id, id as string, messageContent);
          }

          // Scroll to bottom
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      } else {
        // Regular text message
        const { data: messageData, error: messageError } = await supabase
        .from('messages')
          .insert({
            content: messageContent,
            conversation_id: id,
            sender_id: user.id
          })
          .select()
          .single();

        if (messageError) throw messageError;

        // Update conversation's last message
        await supabase
          .from('conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString()
          })
          .eq('id', id);

        // Add message to local state
        const messageWithSender = {
          ...messageData,
          sender: {
            user_id: user.id,
            username: profile?.username || 'You',
            avatar_url: profile?.avatar_url || null
          }
        };

        setMessages(prev => [...prev, messageWithSender]);

        // Send notification to the other user
        const recipientId = conversation
          ? (conversation.user_id === user.id
              ? conversation.other_user_id
              : conversation.user_id)
          : undefined;
        if (recipientId && recipientId !== user.id) {
          sendMessageNotification(recipientId, user.id, id as string, messageContent);
        }

        // Scroll to bottom
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSendError('Failed to send message');
    }
  };

  const shareRecipe = async (recipeId: string, recipeType: 'user' | 'ai' | 'spoonacular') => {
    if (!session || !id || !user) return;

    try {
      const recipeUrl = `${window.location.origin}/recipe/${recipeId}`;
      
      // Create message with recipe data
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: `Check out this recipe: ${recipeUrl}`,
        conversation_id: id,
        sender_id: user.id,
          recipe_id: recipeId,
          recipe_type: recipeType
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Update conversation's last message
      await supabase
        .from('conversations')
        .update({
          last_message: `Check out this recipe: ${recipeUrl}`,
          last_message_at: new Date().toISOString()
        })
        .eq('id', id);

      // Add message to local state
      const messageWithSender = {
        ...messageData,
          sender: {
          user_id: user.id,
          username: profile?.username || 'You',
          avatar_url: profile?.avatar_url || null
        }
      };

      setMessages(prev => [...prev, messageWithSender]);
      
      // Send notification to the other user
      const recipientId = conversation
        ? (conversation.user_id === user.id
            ? conversation.other_user_id
            : conversation.user_id)
        : undefined;
      if (recipientId && recipientId !== user.id) {
        sendMessageNotification(recipientId, user.id, id as string, `Check out this recipe: ${recipeUrl}`);
      }

      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('Error sharing recipe:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
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

  const startEditMessage = (message: any) => {
    setEditingMessageId(message.id);
    setEditMessageContent(message.content || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditMessageContent('');
  };

  const saveEditMessage = async (messageId: string) => {
    if (!session || !editMessageContent.trim()) return;
    
    try {
      setIsUpdatingMessage(true);
      const { error } = await supabase
        .from('messages')
        .update({ content: editMessageContent.trim() })
        .eq('id', messageId);
      
      if (error) throw error;
      
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === messageId 
            ? { ...msg, content: editMessageContent.trim() }
            : msg
        )
      );
      
      setEditingMessageId(null);
      setEditMessageContent('');
    } catch (error) {
      console.error('Error updating message:', error);
      alert('Failed to update message.');
    } finally {
      setIsUpdatingMessage(false);
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
  const renderMessage = (message: any, index: number) => {
    const isCurrentUser = user && message.sender_id === user.id;
    const isEditing = editingMessageId === message.id;
    
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
        ref={(el) => { messageRefs.current[message.id] = el; }}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} gap-3 group`}
      >
        {/* Avatar for other user's messages */}
        {!isCurrentUser && (
          <div className="flex-shrink-0 mt-2">
            <Avatar
              avatar_url={message.sender?.avatar_url}
              username={message.sender?.username}
              size={40}
            />
          </div>
        )}
        
        <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} max-w-[70%]`}>
          {/* Username for other user's messages */}
          {!isCurrentUser && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">
              {message.sender?.username || 'unknown'}
            </span>
          )}
          
          <div
            className={`relative ${hasRecipe ? 'w-full max-w-md' : 'max-w-full'} px-4 py-3 rounded-xl border border-outline bg-transparent hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150`}
        >
          {hasRecipe && (
              <div className="mb-3">
              <MessageRecipeCard
                key={`recipe-${message.id}-${message.recipe_id}`}
                recipeId={message.recipe_id}
                recipeType={message.recipe_type}
              />
            </div>
          )}
          
            {/* Message content or edit form */}
            {isEditing ? (
              <div className="space-y-3">
                <MarkdownToolbar textarea={editTextareaRef.current} setContent={setEditMessageContent} />
                <textarea
                  ref={editTextareaRef}
                  value={editMessageContent}
                  onChange={(e) => setEditMessageContent(e.target.value)}
                  className="w-full px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Edit your message... (supports markdown formatting)"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={cancelEditMessage}
                    disabled={isUpdatingMessage}
                    className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <MdCancel className="w-4 h-4" />
                    cancel
                  </button>
                  <button
                    onClick={() => saveEditMessage(message.id)}
                    disabled={isUpdatingMessage || !editMessageContent.trim()}
                    className="px-3 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <MdSave className="w-4 h-4" />
                    {isUpdatingMessage ? 'saving...' : 'save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
          {/* Always show the message content, whether there's a recipe or not */}
          {message.content && message.content.trim() && (
                  <div className="break-words text-sm prose prose-sm max-w-none prose-invert">
                    {searchQuery.trim() ? (
                      <div dangerouslySetInnerHTML={{ __html: marked(message.content) }} />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: marked(message.content) }} />
                    )}
                    {message.updated_at && message.updated_at !== message.created_at && (
                      <span className="ml-2 text-xs text-gray-400 align-baseline">(edited)</span>
                    )}
            </div>
                )}
                
                {/* Message actions */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {user && message.sender_id !== user.id && (
              <ReportButton recipeId={message.id} recipeType="message" />
                    )}
              {user && message.sender_id === user.id && (
                      <>
                        <button
                          onClick={() => startEditMessage(message)}
                          className="p-2 bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl"
                          aria-label="Edit message"
                          title="Edit message"
                        >
                          <MdEdit className="w-4 h-4 text-yellow-500" />
                        </button>
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                          className="p-2 bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl"
                  aria-label="Delete message"
                          title="Delete message"
                        >
                          <MdDelete className="w-4 h-4 text-red-500" />
                        </button>
                      </>
                    )}
                    {/* Admins can delete any message */}
                    {user && profile?.is_admin && message.sender_id !== user.id && (
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="p-2 bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl"
                        aria-label="Delete message (admin)"
                        title="Delete message (admin)"
                      >
                        <MdDelete className="w-4 h-4 text-red-500" />
                </button>
              )}
            </div>
          </div>
              </>
            )}
        </div>
        </div>
        
        {/* Avatar for current user's messages */}
        {isCurrentUser && (
          <div className="flex-shrink-0 mt-2">
            <Avatar
              avatar_url={profile?.avatar_url}
              username={profile?.username}
              size={40}
            />
          </div>
        )}
      </div>
    );
  };

  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Add a retry handler
  const handleRetry = () => {
    setLoadingError(null);
    setLoading(true);
    setConversationError(null);
    setMessagesError(null);
    fetchConversation();
    fetchMessages();
  };

  if (sessionLoading || profileLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto" />
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return null;
  }

  if (conversationError || messagesError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-center">
          <p className="text-red-500 mb-4">{conversationError || messagesError}</p>
            <Link href="/messages" className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base inline-flex items-center gap-2">
              <FaArrowLeft className="w-4 h-4" />
              back to messages
          </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="text-center">
          <p className="mb-4">Conversation not found</p>
            <Link href="/messages" className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base inline-flex items-center gap-2">
              <FaArrowLeft className="w-4 h-4" />
              back to messages
          </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadingError) {
  return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <p className="text-red-500 mb-4">{loadingError}</p>
          <button
            onClick={handleRetry}
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
        <title>conversation with {conversation.other_user?.username || 'user'} | [recipes]</title>
      </Head>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <Link href="/messages" className="px-4 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm inline-flex items-center gap-2">
                <FaArrowLeft className="w-4 h-4" />
                back
        </Link>
              
              {/* Search Toggle Button */}
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  } else {
                    clearSearch();
                  }
                }}
                className="px-4 py-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-sm inline-flex items-center justify-center"
                title="Find in conversation"
              >
                <FaSearch className="w-4 h-4" />
              </button>
            </div>
            
            {/* Conversation Info */}
            <div className="flex items-center gap-4 p-4 border border-outline rounded-xl">
              <Avatar 
                avatar_url={conversation.other_user?.avatar_url} 
                username={conversation.other_user?.username} 
                size={48}
              />
              <div>
          <h1 className="text-xl font-semibold">
            {conversation.other_user ? conversation.other_user.username : 'unknown user'}
          </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              </div>
        </div>
      </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="mb-6">
              <label className="block mb-2 text-[var(--foreground)] lowercase">search in conversation</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="search in conversation..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {searchQuery && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {searchResults.length > 0 ? `${currentSearchIndex + 1} of ${searchResults.length}` : '0 results'}
                    </span>
                    
                    <button
                      onClick={previousSearchResult}
                      disabled={searchResults.length === 0}
                      className="p-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl disabled:opacity-50 inline-flex items-center justify-center"
                      title="Previous result"
                    >
                      <FaChevronUp className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={nextSearchResult}
                      disabled={searchResults.length === 0}
                      className="p-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl disabled:opacity-50 inline-flex items-center justify-center"
                      title="Next result"
                    >
                      <FaChevronDown className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={clearSearch}
                      className="p-2 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl inline-flex items-center justify-center"
                      title="Clear search"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="mb-6">
            <div className="h-[500px] overflow-y-auto p-4 border border-outline rounded-xl bg-transparent">
        {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            no messages yet. start the conversation!
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
                  {messages.map((message, index) => renderMessage(message, index))}
          </div>
        )}
        <div ref={messagesEndRef} />
            </div>
      </div>

          {/* Message Input */}
          <div>
            <form id="message-form" onSubmit={sendMessage} className="space-y-4">
              <MarkdownToolbar textarea={messageInputRef.current} setContent={setNewMessage} />
              <div className="flex gap-3 items-end">
                <textarea
                  ref={messageInputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="type a message... (supports markdown formatting)"
                  className="flex-1 px-4 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
                  className="w-12 h-12 flex items-center justify-center border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minWidth: '3rem', minHeight: '3rem', padding: 0 }}
        >
                  <FaPaperPlane className="w-5 h-5" />
        </button>
              </div>
      </form>
      {sendError && (
              <div className="mt-2 p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500 text-sm">{sendError}</p>
              </div>
      )}
    </div>
        </div>
      </main>
    </>
  );
} 