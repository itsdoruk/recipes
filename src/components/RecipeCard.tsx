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
  cuisine_type?: string | null;
  cooking_time?: string | null;
  diet_type?: string | null;
  readyInMinutes?: number;
}

export default function RecipeCard({
  id,
  title,
  description,
  image_url,
  user_id,
  created_at,
  cuisine_type,
  cooking_time,
  diet_type,
  readyInMinutes,
}: RecipeCardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user_id === 'spoonacular') {
        setProfile({ username: 'spoonacular', avatar_url: null });
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user_id)
        .single();
      setProfile(data);
    };

    fetchProfile();
  }, [user_id]);

  // Format description text
  const formatDescription = (text: string | null | undefined) => {
    if (!text) return '';
    // Remove HTML tags if any
    const cleanText = text.replace(/<[^>]*>/g, '');
    // Limit to 150 characters
    return cleanText.length > 150 ? cleanText.substring(0, 150) + '...' : cleanText;
  };

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
      <h2 className="font-mono text-lg mb-2">{title}</h2>
      <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
        {formatDescription(description)}
      </p>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username || 'anonymous'}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {profile?.username?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          <Link
            href={`/user/${user_id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {profile?.username || 'anonymous'}
          </Link>
          <div className="flex items-center gap-2">
            {cooking_time && (
              <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                {cooking_time}
              </p>
            )}
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {new Date(created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}