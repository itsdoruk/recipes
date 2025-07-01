import { NextPageContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  const getErrorMessage = () => {
    switch (statusCode) {
      case 404:
        return {
          title: 'page not found',
          message: 'the page you are looking for does not exist.',
          icon: '🔍'
        };
      case 500:
        return {
          title: 'server error',
          message: 'something went wrong on our end. please try again later.',
          icon: '⚠️'
        };
      default:
        return {
          title: 'something went wrong',
          message: 'an unexpected error occurred. please try refreshing the page.',
          icon: '❌'
        };
    }
  };

  const errorInfo = getErrorMessage();

  return (
    <>
      <Head>
        <title>{errorInfo.title} | [recipes]</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">{errorInfo.icon}</div>
            <h1 className="text-2xl font-bold mb-2">{errorInfo.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {errorInfo.message}
            </p>
            {statusCode && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
                error code: {statusCode}
              </p>
            )}
          </div>
          <div className="space-y-4">
            <Link
              href="/"
              className="block w-full px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
            >
              go home
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-lg"
            >
              refresh page
            </button>
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

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error; 