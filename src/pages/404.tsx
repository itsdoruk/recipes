import Head from 'next/head';
import Link from 'next/link';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 | [recipes]</title>
      </Head>

      <main className="max-w-sm mx-auto px-4 py-8">
        <div className="text-center space-y-8">
          <h1 className="font-mono text-2xl">404</h1>
          <p className="font-mono text-gray-500 dark:text-gray-400">
            page not found
          </p>
          <Link
            href="/"
            className="inline-block px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity font-mono"
          >
            go home
          </Link>
        </div>
      </main>
    </>
  );
}
