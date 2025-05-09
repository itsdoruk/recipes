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
  link?: string; // Optional custom link
  loading?: boolean; // New prop
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
  link,
  loading = false,
}: RecipeCardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user_id === 'spoonacular' || user_id === 'internet') {
        setProfile({ username: user_id, avatar_url: null });
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

  const cardContent = (
    <div className="h-[400px] flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {image_url ? (
        <div className="relative w-full h-48 flex-shrink-0">
          <Image
            src={image_url}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 flex-shrink-0" style={{ background: "var(--background)" }} />
      )}
      <div className="flex-1 flex flex-col p-4">
        <h2 className="text-lg mb-2 line-clamp-1" style={{ color: "var(--foreground)" }}>{title}</h2>
        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--foreground)" }}>
          {formatDescription(description)}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--outline)" }}>
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username || 'anonymous'}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--background)", color: "var(--foreground)" }}>
              <span className="text-xs">
                {profile?.username?.[0]?.toUpperCase() || 'a'}
              </span>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <Link
              href={`/user/${user_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
              style={{ color: "var(--foreground)" }}
            >
              {profile?.username || 'anonymous'}
            </Link>
            <div className="flex items-center gap-2">
              {cooking_time && (
                <p className="text-xs" style={{ color: "var(--foreground)" }}>
                  {cooking_time}
                </p>
              )}
              <p className="text-xs" style={{ color: "var(--foreground)" }}>
                {new Date(created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const cardClass =
    "block border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity" +
    (loading ? " opacity-60 pointer-events-none select-none" : "");

  if (loading) {
    return <div className={cardClass}>{cardContent}</div>;
  }

  return link ? (
    <Link href={link} className={cardClass}>
      {cardContent}
    </Link>
  ) : (
    <Link href={`/recipe/${id}`} className={cardClass}>
      {cardContent}
    </Link>
  );
}