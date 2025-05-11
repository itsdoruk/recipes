import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { useTheme } from 'next-themes';
import NotificationsDropdown from './NotificationsDropdown';
import Image from 'next/image';
import { useRef } from 'react';
import Avatar from './Avatar';

interface Profile {
  username: string | null;
  avatar_url: string | null;
  is_private: boolean;
  show_email: boolean;
}

export const NAVBAR_HEIGHT = 80; // px, matches h-20 in Tailwind for mobile, adjust if needed

export default function Navbar() {
  const router = useRouter();
  const { user, signOut, warnings } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [userResults, setUserResults] = useState<{ user_id: string; username: string | null; avatar_url: string | null }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize Supabase client on the client side
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const { getBrowserClient } = await import('@/lib/supabase/browserClient');
        setSupabase(getBrowserClient());
      } catch (error) {
        console.error('Error initializing Supabase:', error);
      }
    };
    initSupabase();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !supabase) {
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
  }, [user, supabase]);

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

  const handleUserSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!supabase) return;
    
    const value = e.target.value;
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length === 0) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .or(`username.ilike.%${value}%,email.ilike.%${value}%`)
        .limit(8);
      if (!error && data) {
        setUserResults(data);
        setShowUserDropdown(true);
      } else {
        setUserResults([]);
        setShowUserDropdown(false);
      }
    }, 300);
  };

  return (
    <>
      {warnings > 0 && (
        <div className="w-full bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 text-center py-2 flex items-center justify-center gap-2">
          <span className="text-xl">⚠️</span>
          <span>You have {warnings} warning{warnings > 1 ? 's' : ''} on your account. Please follow the community guidelines.</span>
        </div>
      )}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 dark:border-gray-800 shadow-md" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Navigation Links */}
            <div className="flex items-center gap-6">
              <Link href="/" className="hover:opacity-80 transition-opacity text-lg">
                [recipes]
              </Link>
              <div className="hidden md:flex items-center gap-6">
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

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="p-2 hover:opacity-80 transition-opacity"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <NotificationsDropdown />
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings((v) => !v)}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        <Avatar avatar_url={profile?.avatar_url} username={profile?.username} size={32} />
                      </div>
                    </button>
                    {showSettings && (
                      <div
                        className="absolute right-0 mt-2 w-64 border border-gray-200 dark:border-gray-800 shadow-lg z-50 rounded-xl"
                        style={{ background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                          <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                            {profile?.username ? `@${profile.username.toLowerCase()}` : '[recipes] user'}
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

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-gray-800 py-4">
              <div className="flex flex-col gap-4">
                <Link
                  href="/discover"
                  className="hover:opacity-80 transition-opacity"
                  onClick={() => setIsMenuOpen(false)}
                >
                  discover
                </Link>
                <Link
                  href="/timer"
                  className="hover:opacity-80 transition-opacity"
                  onClick={() => setIsMenuOpen(false)}
                >
                  timer
                </Link>
                {user && (
                  <>
                    <Link
                      href="/create"
                      className="hover:opacity-80 transition-opacity"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      create
                    </Link>
                    <div className="flex items-center gap-4">
                      <NotificationsDropdown />
                      <Link
                        href={`/user/${user.id}`}
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        profile
                      </Link>
                      <Link
                        href="/account"
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        account
                      </Link>
                      <Link
                        href="/settings"
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        settings
                      </Link>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleSignOut();
                        }}
                        className="text-red-500 hover:opacity-80 transition-opacity"
                      >
                        sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}