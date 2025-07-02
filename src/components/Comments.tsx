import { useState, useEffect, useRef } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Avatar from './Avatar';
import { useProfile } from '@/hooks/useProfile';
import ReportButton from './ReportButton';
import { marked } from 'marked';
import { useCommentNotifications } from '@/hooks/useNotifications';
import { MdEdit, MdDelete, MdReport } from 'react-icons/md';

// Add custom renderer for quotes to show | instead of >
const renderer = new marked.Renderer();
renderer.blockquote = (quote) => {
  return `<div class=\"border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2\">${quote}</div>`;
};
renderer.hr = () => {
  return '<hr class="my-4 border-t border-outline dark:border-gray-700" />';
};

// Configure marked to use the custom renderer
marked.setOptions({ renderer, breaks: true });

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
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = getBrowserClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendCommentNotification } = useCommentNotifications();

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }
      
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();
          
        if (!error && profileData?.is_admin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [user?.id, supabase]);

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
    
    // Find the comment to check ownership
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    // Only allow deletion if user is comment owner or admin
    if (comment.user_id !== user.id && !isAdmin) return;
    
    const confirmMessage = isAdmin && comment.user_id !== user.id 
      ? 'Are you sure you want to delete this user\'s comment as an admin?' 
      : 'Are you sure you want to delete this comment?';
    
    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      window.location.href = '/home';
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
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg text-sm font-bold"
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => formatText('italic', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg text-sm italic"
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => formatText('code', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg text-sm font-mono"
        title="Code"
      >
        {'</>'}
      </button>
      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button
        type="button"
        onClick={() => formatText('link', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 rounded-lg text-sm"
        title="Link"
      >
        🔗
      </button>
      <button
        type="button"
        onClick={() => formatText('image', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 rounded-lg text-sm"
        title="Image URL"
      >
        🖼️
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 rounded-lg text-sm disabled:opacity-50"
        title="Upload Image"
        disabled={imageUploading}
      >
        {imageUploading ? '⏳' : '📤'}
      </button>
      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button
        type="button"
        onClick={() => formatText('list', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg text-sm"
        title="list"
      >
        • list
      </button>
      <button
        type="button"
        onClick={() => formatText('quote', textarea, setContent)}
        className="px-3 py-2 border border-outline bg-transparent transition-all duration-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg text-sm"
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
                className="mt-2 px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="w-10 h-10 flex items-center justify-center bg-transparent text-yellow-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Edit comment"
                        title="Edit comment"
                      >
                        <MdEdit className="w-6 h-6" />
                      </button>
                    )}
                    {(user?.id === comment.user_id || isAdmin) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="w-10 h-10 flex items-center justify-center bg-transparent text-red-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Delete comment"
                        title={isAdmin && comment.user_id !== user?.id ? "Delete comment (admin)" : "Delete comment"}
                      >
                        <MdDelete className="w-6 h-6" />
                      </button>
                    )}
                    <ReportButton
                      recipeId={comment.id}
                      recipeType="message"
                      className="w-10 h-10 flex items-center justify-center bg-transparent text-yellow-500 hover:scale-125 hover:opacity-80 active:scale-95 transition-all duration-150 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="px-3 py-1 text-sm border border-outline transition-all duration-300 hover:scale-110 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 dark:hover:text-green-400 rounded-xl"
                      >
                        save
                      </button>
                      <button
                        onClick={() => {
                          setEditingComment(null);
                          setEditContent('');
                        }}
                        className="px-3 py-1 text-sm border border-outline transition-all duration-300 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 rounded-xl"
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