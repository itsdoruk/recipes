import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log('Auth callback triggered with query:', router.query);
      const { code, error: authError, next } = router.query;

      if (authError) {
        console.error('Auth error:', authError);
        setError('Authentication failed. Please try again.');
        return;
      }

      if (!code) {
        console.error('No code provided in query:', router.query);
        setError('No authentication code provided.');
        return;
      }

      try {
        console.log('Exchanging code for session...');
        const supabase = getSupabaseClient();
        
        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          setError('Failed to complete authentication. Please try again.');
          return;
        }

        console.log('Session exchange successful:', data);
        
        // Redirect immediately to the intended page or home
        const redirectPath = typeof next === 'string' ? next : '/';
        console.log('Redirecting to:', redirectPath);
        router.replace(redirectPath);
      } catch (err: any) {
        console.error('Unexpected error during auth callback:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };

    // Wait for router to be ready before processing
    if (router.isReady && (router.query.code || router.query.error)) {
      handleCallback();
    }
  }, [router.isReady, router.query]);

  // Show minimal loading state while waiting for router
  if (!router.isReady) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  // Show error if no auth params and router is ready
  if (router.isReady && !router.query.code && !router.query.error) {
    return (
      <>
        <Head>
          <title>Sign in error | [recipes]</title>
        </Head>
        <div className="flex justify-center items-center h-screen">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-2xl mb-4">sign in error</h1>
            <p className="mb-6 text-red-500">No authentication parameters found.</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
            >
              try again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Sign in error | [recipes]</title>
        </Head>
        <div className="flex justify-center items-center h-screen">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-2xl mb-4">sign in error</h1>
            <p className="mb-6 text-red-500">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 border border-outline hover:opacity-80 transition-opacity rounded-lg"
            >
              try again
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
} 