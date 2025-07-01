import Image from 'next/image';
import React, { useState } from 'react';

interface AvatarProps {
  avatar_url?: string | null;
  username?: string | null;
  alt?: string;
  size?: number; // px
  className?: string;
}

export default function Avatar({ avatar_url, username, alt, size = 48, className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  if (!avatar_url || imageError) {
    return (
      <div
        className={`flex items-center justify-center rounded-full aspect-square bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200 font-bold select-none transition-transform duration-300 hover:scale-125 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {username?.[0]?.toUpperCase() || 'A'}
      </div>
    );
  }

  return (
    <Image
      src={avatar_url}
      alt={alt || username || 'user avatar'}
      width={size}
      height={size}
      className={`object-cover rounded-full aspect-square bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-200 transition-transform duration-300 hover:scale-125 ${className}`}
      style={{ width: size, height: size }}
      onError={() => setImageError(true)}
      unoptimized={true}
      loading="lazy"
      priority={false}
    />
  );
} 