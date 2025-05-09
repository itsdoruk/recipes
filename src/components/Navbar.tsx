import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import NotificationsDropdown from './NotificationsDropdown';
import Image from 'next/image';

interface Profile {
  username: string | null;
  avatar_url: string | null;
  is_private: boolean;
  show_email: boolean;
}

export const NAVBAR_HEIGHT = 80; // px, matches h-20 in Tailwind for mobile, adjust if needed

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url, is_private, show_email')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('error signing out:', error);
    }
  };

  const isActive = (path: string) => router.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 dark:border-gray-800 shadow-md" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center h-20 md:h-16 py-2 md:py-0">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex justify-center w-full md:w-auto">
              <Link href="/" className="hover:opacity-80 transition-opacity text-lg">
                [recipes]
              </Link>
            </div>
            <div className="flex justify-center w-full md:w-auto gap-6 mt-2 md:mt-0">
              <Link href="/discover" className="hover:opacity-80 transition-opacity">
                discover
              </Link>
              <Link href="/timer" className="hover:opacity-80 transition-opacity">
                timer
              </Link>
              {user && (
                <Link href="/create" className="hover:opacity-80 transition-opacity">
                  create
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            {user ? (
              <>
                <NotificationsDropdown />
                <div className="relative">
                  <button
                    onClick={() => setShowSettings((v) => !v)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                      {profile?.avatar_url ? (
                        <Image
                          src={profile.avatar_url}
                          alt={profile.username || 'avatar'}
                          width={32}
                          height={32}
                          className="object-cover aspect-square"
                        />
                      ) : (
                        <span className="text-sm">{profile?.username?.[0]?.toLowerCase() || 'a'}</span>
                      )}
                    </div>
                  </button>
                  {showSettings && (
                    <div
                      className="absolute right-0 mt-2 w-64 border border-gray-200 dark:border-gray-800 shadow-lg z-50"
                      style={{ background: "var(--background)", color: "var(--foreground)" }}
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                          {profile?.username ? `@${profile.username.toLowerCase()}` : 'anonymous'}
                        </p>
                        {profile?.show_email && (
                          <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                            {user.email?.toLowerCase()}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/user/${user.id}`}
                        className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                        style={{ color: 'inherit', fontFamily: 'inherit' }}
                        onClick={() => setShowSettings(false)}
                      >
                        profile
                      </Link>
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                        style={{ color: 'inherit', fontFamily: 'inherit' }}
                        onClick={() => setShowSettings(false)}
                      >
                        account settings
                      </Link>
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                        style={{ color: 'inherit', fontFamily: 'inherit' }}
                        onClick={() => setShowSettings(false)}
                      >
                        app settings
                      </Link>
                      <button
                        onClick={() => {
                          setShowSettings(false);
                          handleSignOut();
                        }}
                        className="w-full text-left px-4 py-2 text-base font-normal text-red-500 hover:opacity-80 transition-opacity"
                        style={{ fontFamily: 'inherit' }}
                      >
                        sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login" className="hover:opacity-80 transition-opacity">
                login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}