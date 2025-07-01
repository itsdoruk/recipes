import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabase';
import Modal from './Modal';
import Avatar from './Avatar';
import { useMessageNotifications } from '@/hooks/useNotifications';

interface ShareDialogProps {
  isOpen: boolean;
  onRequestClose: () => void;
  recipeId: string;
  recipeTitle: string;
  recipeType?: 'user' | 'spoonacular' | 'ai';
  onShareSubmitted?: () => void;
}

export default function ShareDialog({ 
  isOpen, 
  onRequestClose, 
  recipeId,
  recipeTitle,
  recipeType = 'user',
  onShareSubmitted
}: ShareDialogProps) {
  const { session } = useAuth();
  const user = session?.user || null;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{user_id: string, username: string, avatar_url: string | null}[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { sendRecipeShareNotification } = useMessageNotifications();

  // Search for users when the search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await getSupabaseClient()
          .from('profiles')
          .select('user_id, username, avatar_url')
          .ilike('username', `%${searchTerm}%`)
          .limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error searching users:', err);
        setError('failed to search users');
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchUsers();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the recipe URL
      const recipeUrl = recipeType === 'ai' 
        ? `/internet-recipe/${recipeId}` 
        : recipeType === 'spoonacular'
        ? `/recipe/spoonacular-${recipeId}`
        : `/recipe/${recipeId}`;
      
      // Format the message content
      const messageContent = message 
        ? `${message}\n\nshared recipe: ${recipeTitle}\n${window.location.origin}${recipeUrl}`
        : `shared recipe: ${recipeTitle}\n${window.location.origin}${recipeUrl}`;

      // First check if a conversation already exists between these users
      let conversationId = null;
      const { data: existingConversation, error: convError } = await getSupabaseClient()
        .from('conversations')
        .select('id')
        .or(`and(user_id.eq.${user.id},other_user_id.eq.${selectedUser}),and(user_id.eq.${selectedUser},other_user_id.eq.${user.id})`)
        .limit(1);
      
      if (convError) {
        console.error('Error checking for existing conversation:', convError);
        throw convError;
      }
      
      // If conversation exists, use it; otherwise create a new one
      if (existingConversation && existingConversation.length > 0) {
        conversationId = existingConversation[0].id;
      } else {
        // Create a new conversation
        const { data: newConversation, error: createConvError } = await getSupabaseClient()
          .from('conversations')
          .insert({
            user_id: user.id,
            other_user_id: selectedUser,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (createConvError) {
          console.error('Error creating conversation:', createConvError);
          throw createConvError;
        }
        
        conversationId = newConversation.id;
      }
      
      // Now send the message in this conversation
      if (conversationId) {
        const { error: messageError } = await getSupabaseClient()
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: messageContent,
            created_at: new Date().toISOString(),
            recipe_id: recipeId,
            recipe_type: recipeType
          });
        
        if (messageError) {
          console.error('Error sending message:', messageError);
          throw messageError;
        }
      }

      // Create a notification for the recipe share
      console.log('Creating notification for recipe share');
      await sendRecipeShareNotification(
        selectedUser, // recipient
        user.id, // sender
        recipeId,
        recipeType,
        recipeTitle,
        conversationId,
        message
      );
      
      console.log('Successfully created notification for recipe share');
      
      // Success handling
      setSuccess(true);
      if (onShareSubmitted) {
        onShareSubmitted();
      }
      setTimeout(() => {
        onRequestClose();
        // Reset form state
        setSearchTerm('');
        setSelectedUser(null);
        setMessage('');
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error sharing recipe:', err);
      setError(err.message || 'failed to share recipe. please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="share recipe"
      className="fixed inset-0 flex items-center justify-center z-50"
      overlayClassName="fixed inset-0 bg-black/50"
      ariaHideApp={false}
    >
      <div className="w-full max-w-xl p-8 rounded-2xl shadow-lg border border-outline" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <h2 className="text-2xl mb-6">
          share recipe
        </h2>
        
        {success ? (
          <div className="text-center py-4">
            <p className="text-green-600 mb-2">recipe shared successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedUser(null);
              }}
              placeholder="search for a user..."
              className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none border border-outline bg-transparent"
              disabled={isSubmitting}
            />
            
            {searchResults.length > 0 && !selectedUser && (
              <div className="w-full mt-1 bg-[var(--background)] border border-outline rounded-xl shadow-lg">
                {searchResults.map((user) => (
                  <div 
                    key={user.user_id} 
                    className="px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity border-b border-outline last:border-0"
                    onClick={() => {
                      setSelectedUser(user.user_id);
                      setSearchTerm(user.username || '');
                    }}
                  >
                    <div className="flex items-center">
                      <Avatar 
                        avatar_url={user.avatar_url} 
                        username={user.username} 
                        size={32}
                        className="mr-3"
                      />
                      <span>{user.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {selectedUser && (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full min-h-[160px] px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none border border-outline bg-transparent"
                placeholder="add a personal message (optional)"
                disabled={isSubmitting}
              />
            )}
            
            {error && (
              <div className="p-4 border border-outline bg-transparent rounded-xl mb-4">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={onRequestClose}
                className="px-5 py-3 rounded-xl text-base border border-outline bg-transparent hover:opacity-80 transition-opacity"
                disabled={isSubmitting}
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedUser}
                className="px-5 py-3 rounded-xl text-base border border-outline bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'sharing...' : 'share recipe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
} 