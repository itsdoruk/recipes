import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

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
          <div className="flex">
            <Link 
              href="/" 
              className="flex items-center font-mono hover:opacity-80 transition-opacity"
            >
              [recipes]
            </Link>
            <div className="flex items-center ml-8 space-x-4">
              <Link
                href="/welcome"
                className={`font-mono hover:opacity-80 transition-opacity ${
                  router.pathname === '/welcome' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                discover
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 font-mono hover:bg-[#222] bg-black text-white transition-colors"
              >
                settings
              </button>
              {showSettings && (
                <div className="absolute right-0 mt-2 w-48 bg-black border border-gray-800 shadow-lg z-50">
                  <Link
                    href="/account"
                    className="block px-4 py-2 font-mono text-white hover:bg-[#222] transition-colors"
                    onClick={() => setShowSettings(false)}
                  >
                    account
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 font-mono text-white hover:bg-[#222] transition-colors"
                    onClick={() => setShowSettings(false)}
                  >
                    app settings
                  </Link>
                </div>
              )}
            </div>
            {user ? (
              <>
                <Link
                  href="/create"
                  className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${
                    router.pathname === '/create' ? 'bg-gray-100 dark:bg-gray-900' : ''
                  }`}
                >
                  create new recipe
                </Link>
                <Link
                  href={user ? `/user/${user.id}` : '#'}
                  className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:bg-[#222] bg-black text-white transition-colors font-mono`}
                >
                  profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                >
                  sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${
                  router.pathname === '/login' ? 'bg-gray-100 dark:bg-gray-900' : ''
                }`}
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