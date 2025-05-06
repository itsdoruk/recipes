import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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

          <div className="flex items-center gap-4">
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
                  href="/profile"
                  className={`px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono ${
                    router.pathname === '/profile' ? 'bg-gray-100 dark:bg-gray-900' : ''
                  }`}
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