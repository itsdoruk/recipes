import { getBrowserClient } from '@/lib/supabase/browserClient';

interface Block {
  blocked_user_id: string;
}

export async function getBlockedUsers(): Promise<string[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_user_id');

  if (error) throw error;
  return data.map((block: Block) => block.blocked_user_id);
}

export async function blockUser(userId: string, blockedUserId: string) {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('blocks')
    .insert({ user_id: userId, blocked_user_id: blockedUserId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unblockUser(userId: string, blockedUserId: string) {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('blocks')
    .delete()
    .eq('user_id', userId)
    .eq('blocked_user_id', blockedUserId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function isBlocked(userId: string, blockedUserId: string) {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('blocks')
    .select('id')
    .eq('user_id', userId)
    .eq('blocked_user_id', blockedUserId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}
