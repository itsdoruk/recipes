import { useState, useEffect, useRef } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Avatar from './Avatar';
import { useProfile } from '@/hooks/useProfile';
import ReportButton from './ReportButton';
import { marked } from 'marked';
import { useCommentNotifications } from '@/hooks/useNotifications';

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

// Markdown formatting functions
const insertMarkdown = (text: string, start: number, end: number, before: string, after: string = '') => {
  const beforeText = text.substring(0, start);
  const selectedText = text.substring(start, end);
  const afterText = text.substring(end);
  return beforeText + before + selectedText + after + afterText;
};

export default function Comments({ recipeId }: CommentsProps) {
  const user = useUser();
  const { profile: currentUserProfile } = useProfile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const supabase = getBrowserClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendCommentNotification } = useCommentNotifications();

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

      // Send notification to recipe owner (if not commenting on own recipe)
      try {
        // Get recipe owner ID
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('user_id, title')
          .eq('id', recipeId)
          .single();

        if (recipeData && recipeData.user_id !== user.id) {
          await sendCommentNotification(
            recipeData.user_id,
            user.id,
            recipeId,
            recipeType as 'user' | 'spoonacular' | 'ai',
            recipeData.title
          );
        }
      } catch (notificationError) {
        console.error('Error sending comment notification:', notificationError);
        // Don't fail the comment submission if notification fails
      }

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

  // Markdown formatting functions
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
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          newText = insertMarkdown(currentText, start, end, `[${currentText.substring(start, end) || 'link text'}](${url})`);
        } else {
          return;
        }
        break;
      case 'image':
        const imageUrl = prompt('Enter image URL:');
        if (imageUrl) {
          const altText = prompt('Enter alt text (optional):') || 'image';
          newText = insertMarkdown(currentText, start, end, `![${altText}](${imageUrl})`);
        } else {
          return;
        }
        break;
      case 'list':
        newText = insertMarkdown(currentText, start, end, '- ');
        break;
      case 'quote':
        newText = insertMarkdown(currentText, start, end, '> ');
        break;
    }
    
    setContent(newText);
    
    // Set cursor position after formatting
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

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    
    setImageUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `comment-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath);

      // Insert image markdown at cursor position
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const currentText = textarea.value;
        const newText = currentText.substring(0, start) + `![image](${publicUrl})` + currentText.substring(start);
        setNewComment(newText);
        
        // Set cursor after the image markdown
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + `![image](${publicUrl})`.length, start + `![image](${publicUrl})`.length);
        }, 0);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const MarkdownToolbar = ({ textarea, setContent }: { textarea: HTMLTextAreaElement | null, setContent: (value: string) => void }) => (
    <div className="flex flex-wrap gap-2 mb-2 p-3 border border-outline rounded-lg bg-transparent">
      <button
        type="button"
        onClick={() => formatText('bold', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm font-bold"
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => formatText('italic', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm italic"
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => formatText('code', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm font-mono"
        title="Code"
      >
        {'</>'}
      </button>
      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button
        type="button"
        onClick={() => formatText('link', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm"
        title="Link"
      >
        🔗
      </button>
      <button
        type="button"
        onClick={() => formatText('image', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm"
        title="Image URL"
      >
        🖼️
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm disabled:opacity-50"
        title="Upload Image"
        disabled={imageUploading}
      >
        {imageUploading ? '⏳' : '📤'}
      </button>
      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button
        type="button"
        onClick={() => formatText('list', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm"
        title="list"
      >
        • list
      </button>
      <button
        type="button"
        onClick={() => formatText('quote', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg text-sm"
        title="quote"
      >
        " quote
      </button>
    </div>
  );

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
              <MarkdownToolbar textarea={textareaRef.current} setContent={setNewComment} />
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="write a comment... (supports markdown formatting)"
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
                        className="p-2 bg-transparent border-none shadow-none outline-none hover:opacity-80 transition-opacity flex items-center"
                        aria-label="Edit comment"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M4 13.5V16h2.5l7.06-7.06-2.5-2.5L4 13.5z"/><path d="M14.06 6.94a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0l-1.06 1.06 4 4 1.06-1.06z"/></svg>
                      </button>
                    )}
                    {(user?.id === comment.user_id || user?.user_metadata?.is_admin) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-2 bg-transparent border-none shadow-none outline-none text-red-500 hover:opacity-80 transition-opacity flex items-center"
                        aria-label="Delete comment"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20"><path d="M6 6v8m4-8v8m4-8v8M3 6h14M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
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
                    <MarkdownToolbar textarea={editTextareaRef.current} setContent={setEditContent} />
                    <textarea
                      ref={editTextareaRef}
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
                  <div 
                    className="mt-1 text-sm prose prose-sm max-w-none prose-invert"
                    dangerouslySetInnerHTML={{ __html: marked(comment.content) }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file);
          }
          e.target.value = ''; // Reset input
        }}
        className="hidden"
      />
    </div>
  );
} 