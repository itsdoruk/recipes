import { getSupabaseClient } from '@/lib/supabase';

export async function blockUser(blockedId: string) {
  const { data, error } = await supabase
    .from('blocked_users')
    .insert({
      blocker_id: (await getSupabaseClient().auth.getUser()).data.user?.id,
      blocked_user_id: blockedId
    });

  if (error) throw error;
  return data;
}

export async function unblockUser(blockedId: string) {
  const { data, error } = await supabase
    .from('blocked_users')
    .delete()
    .match({
      blocker_id: (await getSupabaseClient().auth.getUser()).data.user?.id,
      blocked_user_id: blockedId
    });

  if (error) throw error;
  return data;
}

export async function getBlockedUsers() {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_user_id')
    .eq('blocker_id', (await getSupabaseClient().auth.getUser()).data.user?.id);

  if (error) throw error;
  return data.map((block: { blocked_user_id: string }) => block.blocked_user_id);
}

export async function isUserBlocked(userId: string) {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('id')
    .match({
      blocker_id: (await getSupabaseClient().auth.getUser()).data.user?.id,
      blocked_user_id: userId
    });

  if (error) throw error;
  return data.length > 0;
}
