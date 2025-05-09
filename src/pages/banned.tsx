import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';

export default function BannedPage() {
  const { banned } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!banned) {
      router.replace('/');
    }
  }, [banned, router]);

  if (!banned) return null;

  return (
    <>
      <Head>
        <title>Banned | [recipes]</title>
      </Head>
      <main className="flex flex-col items-center justify-center min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="flex flex-col items-center gap-4 p-8 border border-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl shadow-md">
          <span className="text-6xl">🔒</span>
          <h1 className="text-3xl font-bold">Account Banned</h1>
          <p className="text-lg text-center">Your account has been banned. If you believe this is a mistake, please contact support.</p>
        </div>
      </main>
    </>
  );
}