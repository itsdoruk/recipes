import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

interface RecipeCardProps {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
}

export default function RecipeCard({
  id,
  title,
  description,
  image_url,
  user_id,
  created_at,
}: RecipeCardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user_id)
        .single();
      setProfile(data);
    };

    fetchProfile();
  }, [user_id]);

  return (
    <Link
      href={`/recipe/${id}`}
      className="block p-4 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
    >
      {image_url && (
        <div className="relative w-full h-48 mb-4">
          <Image
            src={image_url}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <h3 className="font-mono text-lg">{title}</h3>
      <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mt-2">
        {description}
      </p>
      <div className="flex items-center gap-2 mt-4">
        {profile?.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.username || 'anonymous'}
            className="w-6 h-6 rounded-full"
          />
        )}
        <Link
          href={`/user/${user_id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          {profile?.username || 'anonymous'}
        </Link>
        <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
          • {new Date(created_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}