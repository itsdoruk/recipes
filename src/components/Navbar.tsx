import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useRef } from 'react';
import Avatar from './Avatar';
import { useProfile } from '@/hooks/useProfile';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useWarningBanner } from '@/hooks/useWarningBanner';

export const NAVBAR_HEIGHT = 80; // px, matches h-20 in Tailwind for mobile, adjust if needed
export const WARNING_BANNER_HEIGHT = 32; // px, for the warning banner

export default function Navbar() {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const { profile, isLoading } = useProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [userResults, setUserResults] = useState<{ user_id: string; username: string | null; avatar_url: string | null }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const { warnings, shouldShowBanner, dismissBanner } = useWarningBanner();

  // Set CSS variable for warning banner visibility
  useEffect(() => {
    // Set CSS variable for warning banner visibility
    document.documentElement.style.setProperty(
      '--warning-banner-height', 
      shouldShowBanner ? `${WARNING_BANNER_HEIGHT}px` : '0px'
    );
  }, [shouldShowBanner]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (path: string) => router.pathname === path;

  const handleUserSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-outline shadow-md" style={{ background: "var(--background)", color: "var(--foreground)" }}>
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
                {session && (
                  <>
                    <Link href="/create" className="hover:opacity-80 transition-opacity">
                      create
                    </Link>
                    <Link href="/messages" className="hover:opacity-80 transition-opacity">
                      messages
                    </Link>
                  </>
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
              {session ? (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings((v) => !v)}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>
                        <Avatar 
                          avatar_url={profile?.avatar_url || null} 
                          username={profile?.username || 'User'} 
                          size={32} 
                        />
                      </div>
                    </button>
                    {showSettings && (
                      <div
                        className="absolute right-0 mt-2 w-64 border border-outline shadow-lg z-50 rounded-xl"
                        style={{ background: "var(--background)", color: "var(--foreground)" }}
                      >
                        <div className="px-4 py-3 border-b border-outline">
                          <p className="text-sm" style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}>
                            {profile?.username && profile.username !== 'anonymous'
                              ? `@${profile.username.toLowerCase()}`
                              : '[recipes] user'}
                          </p>
                        </div>
                        <Link
                          href={`/user/${session.user.id}`}
                          className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
                          onClick={() => setShowSettings(false)}
                        >
                          profile
                        </Link>
                        <Link
                          href="/account"
                          className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
                          onClick={() => setShowSettings(false)}
                        >
                          account settings
                        </Link>
                        <Link
                          href="/settings"
                          className="block px-4 py-2 text-base font-normal hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--foreground)', fontFamily: 'inherit' }}
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
            <div className="md:hidden border-t border-outline py-4">
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
                {session && (
                  <>
                    <Link
                      href="/create"
                      className="hover:opacity-80 transition-opacity"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      create
                    </Link>
                    <Link
                      href="/messages"
                      className="hover:opacity-80 transition-opacity"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      messages
                    </Link>
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/user/${session.user.id}`}
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
      
      {/* Warning Banner - Separate from navbar */}
      {shouldShowBanner && (
        <div 
          className="fixed left-0 right-0 w-full bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 text-center shadow-md z-40 flex items-center justify-center"
          style={{ 
            top: `${NAVBAR_HEIGHT}px`,
            minHeight: `${WARNING_BANNER_HEIGHT}px`,
          }}
        >
          <div className="py-2 px-4 flex items-center justify-between max-w-7xl w-full">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span>You have {warnings} warning{warnings > 1 ? 's' : ''} on your account. Please follow the community guidelines.</span>
            </div>
            <button 
              onClick={dismissBanner}
              className="text-yellow-900 dark:text-yellow-100 hover:opacity-80 transition-opacity"
              aria-label="Dismiss warning"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}