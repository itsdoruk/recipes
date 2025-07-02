import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useState, useEffect } from 'react';
import ReportModal from './ReportModal';
import { Database } from '@/types/supabase';
import UserCardSkeleton from './UserCardSkeleton';
import Avatar from '@/components/Avatar';

interface UserCardProps {
  user: {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
}

function UserCard({ user }: UserCardProps) {
  const { user: authUser, isAuthenticated } = useAuth();
  const supabase = useSupabaseClient<Database>();
  const currentUser = authUser || null;
  const [isBlocked, setIsBlocked] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!currentUser) return;
      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('blocked_user_id', user.user_id)
        .single();
      setIsBlocked(!!data);
    };

    checkBlockStatus();
  }, [currentUser, user.user_id, supabase]);

  if (isBlocked) {
    return (
      <div className="block border border-outline shadow-sm bg-white dark:bg-gray-900 p-4 w-full h-full rounded-xl opacity-50" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex items-center gap-4">
          <Avatar
            avatar_url={user.user_id === 'spoonacular' ? null : user.avatar_url}
            username={user.user_id === 'spoonacular' ? 'spoonacular' : user.username}
            size={48}
            className={user.user_id === 'spoonacular' ? 'bg-gray-800 text-gray-200 dark:bg-gray-700 dark:text-gray-200 font-bold' : 'bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200 font-bold'}
          />
          <div>
            <div className="font-semibold text-lg">{user.username || '[recipes] user'}</div>
            <div className="text-sm text-gray-500">blocked user</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="block border border-outline shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-xl p-4 w-full h-full rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex items-center justify-between">
          <Link href={`/user/${user.user_id}`} className="flex items-center gap-4 flex-1 group">
            <Avatar
              avatar_url={user.user_id === 'spoonacular' ? null : user.avatar_url}
              username={user.user_id === 'spoonacular' ? 'spoonacular' : user.username}
              size={48}
              className={user.user_id === 'spoonacular' ? 'bg-gray-800 text-gray-200 dark:bg-gray-700 dark:text-gray-200 font-bold' : 'bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200 font-bold'}
            />
            <div>
              <div className="font-semibold text-lg transition-colors duration-300 group-hover:text-blue-500 dark:group-hover:text-blue-400">{user.username || '[recipes] user'}</div>
              {user.bio && <div className="text-gray-500 text-sm mt-1">{user.bio}</div>}
            </div>
          </Link>
          {currentUser && currentUser.id !== user.user_id && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-sm px-2 py-1 border border-outline transition-all duration-300 hover:scale-110 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 rounded-lg"
            >
              report
            </button>
          )}
        </div>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onRequestClose={() => setIsReportModalOpen(false)}
        reportedUserId={user.user_id}
      />
    </>
  );
}

const UserCardExport = UserCard as any;
UserCardExport.Skeleton = UserCardSkeleton;
export default UserCardExport; 