import Head from 'next/head';
import Link from 'next/link';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>page not found | [recipes]</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-2xl font-bold mb-2">page not found</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              the page you are looking for does not exist.
            </p>
          </div>
          <div className="space-y-4">
            <Link
              href="/"
              className="block w-full px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
            >
              go home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
            >
              go back
            </button>
          </div>
        </div>
      </div>
    </>
  );
}