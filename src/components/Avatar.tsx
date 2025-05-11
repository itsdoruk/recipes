import Image from 'next/image';
import React from 'react';

interface AvatarProps {
  avatar_url?: string | null;
  username?: string | null;
  alt?: string;
  size?: number; // px
  className?: string;
}

export default function Avatar({ avatar_url, username, alt, size = 48, className = '' }: AvatarProps) {
  return avatar_url ? (
    <Image
      src={avatar_url}
      alt={alt || username || 'user avatar'}
      width={size}
      height={size}
      className={`object-cover rounded-full aspect-square bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={`flex items-center justify-center rounded-full aspect-square bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold select-none ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {username?.[0]?.toUpperCase() || 'A'}
    </div>
  );
} 