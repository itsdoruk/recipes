import { useState, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import Avatar from './Avatar';
import { useProfile } from '@/hooks/useProfile';
import ReportButton from './ReportButton';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  recipe_id: string;
  recipe_type: 'local' | 'spoonacular';
  username: string | null;
  avatar_url: string | null;
}

interface CommentsProps {
  recipeId: string;
}

export default function Comments({ recipeId }: CommentsProps) {
  const user = useUser();
  const { profile: currentUserProfile } = useProfile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchComments = async () => {
    try {
      // First, get the comments with profile information
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments_with_profile')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('failed to load comments');
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
      setError('failed to post comment');
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
      setError('failed to delete comment');
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
      setError('failed to edit comment');
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
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Avatar avatar_url={currentUserProfile?.avatar_url} username={currentUserProfile?.username} size={40} />
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <span className="font-medium">{currentUserProfile?.username}</span>
              </div>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="write a comment..."
                className="w-full min-h-[100px] px-3 py-2 border border-outline bg-transparent focus:outline-none rounded-xl"
              />
              <button
                type="submit"
                disabled={isLoading || !newComment.trim()}
                className="mt-2 px-3 py-2 border border-outline hover:opacity-80 transition-opacity disabled:opacity-50 rounded-xl"
              >
                {isLoading ? 'posting...' : 'post comment'}
              </button>
            </div>
          </div>
          {error && (
            <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}
        </form>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">please log in to leave a comment.</p>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="p-4 border border-outline rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                <Avatar avatar_url={comment.avatar_url} username={comment.username} size={40} />
              </div>
              <div className="flex-1">
                <div className="mb-2">
                  <span className="font-medium">{comment.username}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                  <div className="ml-auto flex gap-2">
                    {user?.id === comment.user_id && (
                      <button
                        onClick={() => startEditing(comment)}
                        className="text-sm px-2 py-1 border border-outline hover:opacity-80 rounded-lg"
                      >
                        edit
                      </button>
                    )}
                    {(user?.id === comment.user_id || user?.user_metadata?.is_admin) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-sm px-2 py-1 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 rounded-lg"
                      >
                        delete
                      </button>
                    )}
                    <ReportButton
                      recipeId={comment.id}
                      recipeType="message"
                      className="text-sm px-2 py-1"
                    />
                  </div>
                </div>
                {editingComment === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 border border-outline bg-transparent focus:outline-none rounded-xl"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(comment.id)}
                        className="px-3 py-1 text-sm border border-outline hover:opacity-80 rounded-xl"
                      >
                        save
                      </button>
                      <button
                        onClick={() => {
                          setEditingComment(null);
                          setEditContent('');
                        }}
                        className="px-3 py-1 text-sm border border-outline hover:opacity-80 rounded-xl"
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