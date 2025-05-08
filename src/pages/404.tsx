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
          <h1 className="text-2xl">404: page not found</h1>
          <p className="text-gray-500 dark:text-gray-400">
            are you sure 'bout that? we didn't find a page like this.
          </p>
          <Link
            href="/"
            className="inline-block px-3 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity "
          >
            go home
          </Link>
        </div>
      </main>
    </>
  );
}