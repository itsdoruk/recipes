import { PostgrestError } from '@supabase/supabase-js';

export async function followUser(supabase: any, followerId: string, followingId: string): Promise<{ error?: PostgrestError }> {
  const { error } = await supabase
    .from('follows')
    .insert({
      follower_id: followerId,
      following_id: followingId
    });
  return { error };
}

export async function unfollowUser(supabase: any, followerId: string, followingId: string): Promise<{ error?: PostgrestError }> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  return { error };
}

export async function sendFollowNotification(supabase: any, userId: string, actorId: string): Promise<{ error?: PostgrestError }> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'follow',
      actor_id: actorId
    });
  return { error };
} 