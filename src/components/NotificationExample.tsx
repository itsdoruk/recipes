import { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Example component demonstrating how to use notification hooks
 * This is for demonstration purposes - you can remove this file in production
 */
export default function NotificationExample() {
  const user = useUser();
  const [targetUserId, setTargetUserId] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [recipeTitle, setRecipeTitle] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const {
    sendFollowNotification,
    sendCommentNotification,
    sendMessageNotification,
    sendRecipeShareNotification,
    sendRecipeLikeNotification,
    sendRecipeStarNotification,
    sendWelcomeNotification,
    sendWarningNotification
  } = useNotifications();

  const handleFollowNotification = async () => {
    if (!user || !targetUserId) return;
    
    try {
      const result = await sendFollowNotification(targetUserId, user.id);
      if (result.success) {
        setResult('Follow notification sent successfully!');
      } else {
        setResult('Failed to send follow notification');
      }
    } catch (error) {
      setResult('Error sending follow notification');
    }
  };

  const handleCommentNotification = async () => {
    if (!user || !targetUserId || !recipeId) return;
    
    try {
      const result = await sendCommentNotification(
        targetUserId,
        user.id,
        recipeId,
        'user',
        recipeTitle
      );
      if (result.success) {
        setResult('Comment notification sent successfully!');
      } else {
        setResult('Failed to send comment notification');
      }
    } catch (error) {
      setResult('Error sending comment notification');
    }
  };

  const handleMessageNotification = async () => {
    if (!user || !targetUserId) return;
    
    try {
      const result = await sendMessageNotification(
        targetUserId,
        user.id,
        'conversation-id',
        message
      );
      if (result.success) {
        setResult('Message notification sent successfully!');
      } else {
        setResult('Failed to send message notification');
      }
    } catch (error) {
      setResult('Error sending message notification');
    }
  };

  const handleRecipeShareNotification = async () => {
    if (!user || !targetUserId || !recipeId || !recipeTitle) return;
    
    try {
      const result = await sendRecipeShareNotification(
        targetUserId,
        user.id,
        recipeId,
        'user',
        recipeTitle,
        'conversation-id',
        message
      );
      if (result.success) {
        setResult('Recipe share notification sent successfully!');
      } else {
        setResult('Failed to send recipe share notification');
      }
    } catch (error) {
      setResult('Error sending recipe share notification');
    }
  };

  const handleRecipeLikeNotification = async () => {
    if (!user || !targetUserId || !recipeId) return;
    
    try {
      const result = await sendRecipeLikeNotification(
        targetUserId,
        user.id,
        recipeId,
        'user',
        recipeTitle
      );
      if (result.success) {
        setResult('Recipe like notification sent successfully!');
      } else {
        setResult('Failed to send recipe like notification');
      }
    } catch (error) {
      setResult('Error sending recipe like notification');
    }
  };

  const handleWelcomeNotification = async () => {
    if (!user) return;
    
    try {
      const result = await sendWelcomeNotification(user.id);
      if (result.success) {
        setResult('Welcome notification sent successfully!');
      } else {
        setResult('Failed to send welcome notification');
      }
    } catch (error) {
      setResult('Error sending welcome notification');
    }
  };

  if (!user) {
    return <div className="p-4">Please log in to test notifications</div>;
  }

  return (
    <div className="p-6 space-y-6 border border-outline rounded-xl">
      <h2 className="text-xl font-medium">Notification Hooks Example</h2>
      <p className="text-sm text-gray-500">
        This component demonstrates how to use the notification hooks for various social interactions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Target User ID:</label>
          <input
            type="text"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Enter user ID to send notification to"
            className="w-full px-3 py-2 border border-outline rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Recipe ID:</label>
          <input
            type="text"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            placeholder="Enter recipe ID"
            className="w-full px-3 py-2 border border-outline rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Recipe Title:</label>
          <input
            type="text"
            value={recipeTitle}
            onChange={(e) => setRecipeTitle(e.target.value)}
            placeholder="Enter recipe title"
            className="w-full px-3 py-2 border border-outline rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Message:</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message content"
            className="w-full px-3 py-2 border border-outline rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        <button
          onClick={handleFollowNotification}
          className="px-3 py-2 text-sm border border-outline rounded-lg hover:opacity-80 transition-opacity"
        >
          Follow
        </button>
        <button
          onClick={handleCommentNotification}
          className="px-3 py-2 text-sm border border-outline rounded-lg hover:opacity-80 transition-opacity"
        >
          Comment
        </button>
        <button
          onClick={handleMessageNotification}
          className="px-3 py-2 text-sm border border-outline rounded-lg hover:opacity-80 transition-opacity"
        >
          Message
        </button>
        <button
          onClick={handleRecipeShareNotification}
          className="px-3 py-2 text-sm border border-outline rounded-lg hover:opacity-80 transition-opacity"
        >
          Recipe Share
        </button>
        <button
          onClick={handleRecipeLikeNotification}
          className="px-3 py-2 text-sm border border-outline rounded-lg hover:opacity-80 transition-opacity"
        >
          Recipe Like
        </button>
        <button
          onClick={handleWelcomeNotification}
          className="px-3 py-2 text-sm border border-outline rounded-lg hover:opacity-80 transition-opacity"
        >
          Welcome
        </button>
      </div>

      {result && (
        <div className="p-3 border border-outline rounded-lg bg-gray-50 dark:bg-gray-800">
          <p className="text-sm">{result}</p>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Usage Examples:</strong></p>
        <p>• <strong>Follow:</strong> When someone follows a public account</p>
        <p>• <strong>Comment:</strong> When someone comments on a recipe</p>
        <p>• <strong>Message:</strong> When someone sends a direct message</p>
        <p>• <strong>Recipe Share:</strong> When someone shares a recipe with you</p>
        <p>• <strong>Recipe Like:</strong> When someone likes your recipe</p>
        <p>• <strong>Welcome:</strong> System notification for new users</p>
      </div>
    </div>
  );
} 