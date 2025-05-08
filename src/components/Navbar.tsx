import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  username: string | null;
  avatar_url: string | null;
}

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user.id)
        .single();
      setProfile(data);
    };
    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center hover:opacity-80 transition-opacity"
            >
              [recipes]
            </Link>
            <div className="flex items-center hover:opacity-80 transition-opacity">
              <Link
                href="/welcome"
                className={`transition-opacity hover:opacity-80 ${router.pathname === '/welcome' ? 'opacity-80' : ''}`}
              >
                discover
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/create"
                  className="h-10 flex items-center px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                >
                  create new recipe
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setShowSettings((v) => !v)}
                    className="h-10 flex items-center hover:opacity-80 transition-opacity"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username || 'avatar'}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'A'}
                        </span>
                      </div>
                    )}
                  </button>
                  {showSettings && (
                    <div
                      className="absolute right-0 mt-2 w-64 border border-gray-200 dark:border-gray-800 shadow-lg z-50"
                      style={{ background: "var(--background)", color: "var(--foreground)" }}
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                          {profile?.username ? `@${profile.username}` : user.email}
                        </p>
                        {profile?.username && (
                          <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'inherit' }}>
                            {user.email}
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
              <Link
                href="/login"
                className="h-10 flex items-center px-3 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
              >
                sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}