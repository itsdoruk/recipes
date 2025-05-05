import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center font-mono">
              [recipes]
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/create"
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                >
                  create new recipe
                </Link>
                <Link
                  href="/profile"
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                >
                  profile
                </Link>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
                >
                  sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
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