import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Avatar from './Avatar';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  recipe_id: string;
  recipe_type: 'local' | 'spoonacular';
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface CommentsProps {
  recipeId: string;
}

export function Comments({ recipeId }: CommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchComments = async () => {
    try {
      // First, get the comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      // Then, get the profiles for all comments
      const userIds = commentsData?.map(comment => comment.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map(
        profilesData?.map(profile => [profile.user_id, profile]) || []
      );

      // Combine comments with profiles
      const transformedComments = (commentsData || []).map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || null
      }));

      setComments(transformedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments');
    }
  };

  useEffect(() => {
    if (recipeId) {
      fetchComments();
    }
  }, [recipeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const recipeType = recipeId.startsWith('spoonacular-') ? 'spoonacular' : 'local';
      
      const { error } = await supabase
        .from('comments')
        .insert({
          recipe_id: recipeId,
          recipe_type: recipeType,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Failed to post comment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId);

      if (error) throw error;

      setEditingComment(null);
      setEditContent('');
      fetchComments();
    } catch (error) {
      console.error('Error editing comment:', error);
      setError('Failed to edit comment');
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl">comments</h2>
      
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="write a comment..."
            className="w-full min-h-[100px] px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !newComment.trim()}
            className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isLoading ? 'posting...' : 'post comment'}
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">please log in to leave a comment.</p>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                <Avatar avatar_url={comment.profiles?.avatar_url} username={comment.profiles?.username} size={40} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {comment.profiles?.username || 'anonymous'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                  {(user?.id === comment.user_id || user?.user_metadata?.is_admin) && (
                    <div className="ml-auto flex gap-2">
                      {user?.id === comment.user_id && (
                        <button
                          onClick={() => startEditing(comment)}
                          className="text-sm px-2 py-1 border border-gray-200 dark:border-gray-800 hover:opacity-80"
                        >
                          edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-sm px-2 py-1 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80"
                      >
                        delete
                      </button>
                    </div>
                  )}
                </div>
                {editingComment === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(comment.id)}
                        className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-800 hover:opacity-80"
                      >
                        save
                      </button>
                      <button
                        onClick={() => {
                          setEditingComment(null);
                          setEditContent('');
                        }}
                        className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-800 hover:opacity-80"
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm">{comment.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 