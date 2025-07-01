import { getBrowserClient } from '@/lib/supabase/browserClient';

export interface NotificationData {
  user_id: string;
  type: string;
  actor_id: string;
  metadata?: any;
}

/**
 * Hook for sending follow notifications
 */
export const useFollowNotifications = () => {
  const supabase = getBrowserClient();

  const sendFollowNotification = async (userId: string, actorId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'follow',
          actor_id: actorId,
          created_at: new Date().toISOString(),
          read: false
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending follow notification:', error);
      return { error };
    }
  };

  return {
    sendFollowNotification
  };
};

/**
 * Hook for sending comment notifications
 */
export const useCommentNotifications = () => {
  const supabase = getBrowserClient();

  const sendCommentNotification = async (
    recipeOwnerId: string, 
    commenterId: string, 
    recipeId: string, 
    recipeType: 'user' | 'spoonacular' | 'ai',
    recipeTitle?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: recipeOwnerId,
          type: 'comment',
          actor_id: commenterId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            recipe_id: recipeId,
            recipe_type: recipeType,
            recipe_title: recipeTitle
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending comment notification:', error);
      return { error };
    }
  };

  const sendReplyNotification = async (
    commentOwnerId: string,
    replierId: string,
    recipeId: string,
    recipeType: 'user' | 'spoonacular' | 'ai',
    recipeTitle?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: commentOwnerId,
          type: 'comment_reply',
          actor_id: replierId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            recipe_id: recipeId,
            recipe_type: recipeType,
            recipe_title: recipeTitle
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending reply notification:', error);
      return { error };
    }
  };

  return {
    sendCommentNotification,
    sendReplyNotification
  };
};

/**
 * Hook for sending message notifications
 */
export const useMessageNotifications = () => {
  const supabase = getBrowserClient();

  const sendMessageNotification = async (
    recipientId: string,
    senderId: string,
    conversationId: string,
    messagePreview?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'message',
          actor_id: senderId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            conversation_id: conversationId,
            message_preview: messagePreview
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending message notification:', error);
      return { error };
    }
  };

  const sendRecipeShareNotification = async (
    recipientId: string,
    senderId: string,
    recipeId: string,
    recipeType: 'user' | 'spoonacular' | 'ai',
    recipeTitle: string,
    conversationId?: string,
    message?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'recipe_share',
          actor_id: senderId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            recipe_id: recipeId,
            recipe_type: recipeType,
            recipe_title: recipeTitle,
            conversation_id: conversationId,
            message: message
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending recipe share notification:', error);
      return { error };
    }
  };

  return {
    sendMessageNotification,
    sendRecipeShareNotification
  };
};

/**
 * Hook for sending recipe-related notifications
 */
export const useRecipeNotifications = () => {
  const supabase = getBrowserClient();

  const sendRecipeLikeNotification = async (
    recipeOwnerId: string,
    likerId: string,
    recipeId: string,
    recipeType: 'user' | 'spoonacular' | 'ai',
    recipeTitle?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: recipeOwnerId,
          type: 'recipe_like',
          actor_id: likerId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            recipe_id: recipeId,
            recipe_type: recipeType,
            recipe_title: recipeTitle
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending recipe like notification:', error);
      return { error };
    }
  };

  const sendRecipeStarNotification = async (
    recipeOwnerId: string,
    starerId: string,
    recipeId: string,
    recipeType: 'user' | 'spoonacular' | 'ai',
    recipeTitle?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: recipeOwnerId,
          type: 'recipe_star',
          actor_id: starerId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            recipe_id: recipeId,
            recipe_type: recipeType,
            recipe_title: recipeTitle
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending recipe star notification:', error);
      return { error };
    }
  };

  return {
    sendRecipeLikeNotification,
    sendRecipeStarNotification
  };
};

/**
 * Hook for sending system notifications
 */
export const useSystemNotifications = () => {
  const supabase = getBrowserClient();

  const sendWelcomeNotification = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'welcome',
          actor_id: 'system',
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            message: 'Welcome to [recipes]! Start exploring recipes and connecting with other food lovers.'
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending welcome notification:', error);
      return { error };
    }
  };

  const sendAccountVerificationNotification = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'account_verified',
          actor_id: 'system',
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            message: 'Your account has been verified successfully!'
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending account verification notification:', error);
      return { error };
    }
  };

  return {
    sendWelcomeNotification,
    sendAccountVerificationNotification
  };
};

/**
 * Hook for sending admin notifications
 */
export const useAdminNotifications = () => {
  const supabase = getBrowserClient();

  const sendWarningNotification = async (
    userId: string,
    adminId: string,
    reason: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'warning',
          actor_id: adminId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            reason: reason
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending warning notification:', error);
      return { error };
    }
  };

  const sendBanNotification = async (
    userId: string,
    adminId: string,
    reason: string,
    banType: 'temporary' | 'permanent',
    banExpiry?: string
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'ban',
          actor_id: adminId,
          created_at: new Date().toISOString(),
          read: false,
          metadata: {
            reason: reason,
            ban_type: banType,
            ban_expiry: banExpiry
          }
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending ban notification:', error);
      return { error };
    }
  };

  return {
    sendWarningNotification,
    sendBanNotification
  };
};

/**
 * Main notification hook that combines all notification types
 */
export const useNotifications = () => {
  const followNotifications = useFollowNotifications();
  const commentNotifications = useCommentNotifications();
  const messageNotifications = useMessageNotifications();
  const recipeNotifications = useRecipeNotifications();
  const systemNotifications = useSystemNotifications();
  const adminNotifications = useAdminNotifications();

  return {
    ...followNotifications,
    ...commentNotifications,
    ...messageNotifications,
    ...recipeNotifications,
    ...systemNotifications,
    ...adminNotifications
  };
};

/**
 * Utility function to get notification text based on type
 */
export const getNotificationText = (notification: any) => {
  const actorName = notification.actor_username || 'Someone';
  
  switch (notification.type) {
    case 'follow':
      return `${actorName} started following you`;
    case 'comment':
      return `${actorName} commented on your recipe`;
    case 'comment_reply':
      return `${actorName} replied to your comment`;
    case 'message':
      return `${actorName} sent you a message`;
    case 'recipe_share':
      return `${actorName} shared a recipe with you`;
    case 'recipe_like':
      return `${actorName} liked your recipe`;
    case 'recipe_star':
      return `${actorName} starred your recipe`;
    case 'welcome':
      return 'Welcome to [recipes]!';
    case 'account_verified':
      return 'Your account has been verified';
    case 'warning':
      return `You received a warning: ${notification.metadata?.reason}`;
    case 'ban':
      return `Your account has been ${notification.metadata?.ban_type === 'permanent' ? 'permanently banned' : 'temporarily banned'}`;
    default:
      return 'You have a new notification';
  }
};

/**
 * Utility function to get notification navigation path
 */
export const getNotificationPath = (notification: any) => {
  switch (notification.type) {
    case 'follow':
      return `/user/${notification.actor_id}`;
    case 'comment':
    case 'comment_reply':
    case 'recipe_like':
    case 'recipe_star':
      return `/recipe/${notification.metadata?.recipe_id}`;
    case 'message':
    case 'recipe_share':
      return notification.metadata?.conversation_id 
        ? `/messages/${notification.metadata.conversation_id}`
        : '/messages';
    default:
      return null;
  }
}; 