import Link from 'next/link';

export default function EmptyStarredRecipes() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="w-16 h-16 text-gray-400 mb-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        No starred recipes yet
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
        Start exploring recipes and star your favorites to save them for later.
      </p>
      <div className="flex gap-4">
        <Link
          href="/discover"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Discover Recipes
        </Link>
        <Link
          href="/create"
          className="inline-flex items-center px-4 py-2 border border-outline text-sm font-medium rounded-md text-[var(--foreground)] bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Create Recipe
        </Link>
      </div>
    </div>
  );
} 