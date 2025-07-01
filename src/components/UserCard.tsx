import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useState, useEffect } from 'react';
import ReportModal from './ReportModal';
import { Database } from '@/types/supabase';
import UserCardSkeleton from './UserCardSkeleton';

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
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.username || 'user avatar'}
              width={48}
              height={48}
              className="object-cover rounded-full bg-gray-100 dark:bg-gray-800"
            />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xl font-bold select-none">
              {user.username?.[0]?.toUpperCase() || 'A'}
            </div>
          )}
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
      <div className="block border border-outline shadow-sm hover:shadow-md transition-shadow p-4 w-full h-full rounded-xl" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="flex items-center justify-between">
          <Link href={`/user/${user.user_id}`} className="flex items-center gap-4 flex-1">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.username || 'user avatar'}
                width={48}
                height={48}
                className="object-cover rounded-full bg-gray-100 dark:bg-gray-800"
              />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xl font-bold select-none">
                {user.username?.[0]?.toUpperCase() || 'A'}
              </div>
            )}
            <div>
              <div className="font-semibold text-lg">{user.username || '[recipes] user'}</div>
              {user.bio && <div className="text-gray-500 text-sm mt-1">{user.bio}</div>}
            </div>
          </Link>
          {currentUser && currentUser.id !== user.user_id && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-sm px-2 py-1 border border-outline hover:opacity-80 rounded-lg"
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