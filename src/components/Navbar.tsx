import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useRef } from 'react';
import Avatar from './Avatar';
import { useProfile } from '@/hooks/useProfile';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useWarningBanner } from '@/hooks/useWarningBanner';
import { useAuth } from '@/lib/hooks/useAuth';

export const NAVBAR_HEIGHT = 80; // px, matches h-20 in Tailwind for mobile, adjust if needed
export const WARNING_BANNER_HEIGHT = 32; // px, for the warning banner

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
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
                {isAuthenticated && (
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
              {isAuthenticated ? (
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
                          href={`/user/${user?.id}`}
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
                <Link
                  href="/login"
                  className="hover:opacity-80 transition-opacity"
                >
                  sign in
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-outline">
              <div className="flex flex-col gap-4">
                <Link href="/discover" className="hover:opacity-80 transition-opacity">
                  discover
                </Link>
                <Link href="/timer" className="hover:opacity-80 transition-opacity">
                  timer
                </Link>
                {isAuthenticated ? (
                  <>
                    <Link href="/create" className="hover:opacity-80 transition-opacity">
                      create
                    </Link>
                    <Link href="/messages" className="hover:opacity-80 transition-opacity">
                      messages
                    </Link>
                    <Link href={`/user/${user?.id}`} className="hover:opacity-80 transition-opacity">
                      profile
                    </Link>
                    <Link href="/account" className="hover:opacity-80 transition-opacity">
                      account settings
                    </Link>
                    <Link href="/settings" className="hover:opacity-80 transition-opacity">
                      app settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="text-left text-red-500 hover:opacity-80 transition-opacity"
                    >
                      sign out
                    </button>
                  </>
                ) : (
                  <Link href="/login" className="hover:opacity-80 transition-opacity">
                    sign in
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Warning Banner */}
      {shouldShowBanner && (
        <div 
          className="fixed top-16 left-0 right-0 z-40 px-4 py-2 text-sm text-center"
          style={{ 
            background: 'var(--warning-bg, #fef3c7)', 
            color: 'var(--warning-text, #92400e)',
            borderBottom: '1px solid var(--warning-border, #f59e0b)'
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>You have {warnings} warning{warnings > 1 ? 's' : ''} on your account. Please follow the community guidelines.</span>
            <button
              onClick={dismissBanner}
              className="ml-4 hover:opacity-80 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}