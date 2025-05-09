import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface UserCardProps {
  user: {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    bio?: string | null;
  };
}

export default function UserCard({ user }: UserCardProps) {
  return (
    <Link href={`/user/${user.user_id}`} className="block border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-900 p-4 w-full h-full" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
          <div className="font-semibold text-lg">{user.username || 'anonymous'}</div>
          {user.bio && <div className="text-gray-500 text-sm mt-1">{user.bio}</div>}
        </div>
      </div>
    </Link>
  );
} 