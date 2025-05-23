import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useUser } from '@supabase/auth-helpers-react';
import { useBanInfo } from '@/lib/useBanInfo';

export default function Banned() {
  const router = useRouter();
  const user = useUser();
  const { banInfo } = useBanInfo();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>banned | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <h1 className="text-2xl mb-8">account banned</h1>
          
          <div className="space-y-4">
            <p>
              your account has been banned from [recipes].
            </p>

            {banInfo.banType === 'temporary' && banInfo.banExpiry && (
              <p>
                your ban will expire on {banInfo.banExpiry.toLocaleDateString()}.
              </p>
            )}

            {banInfo.banReason && (
              <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-500">reason: {banInfo.banReason}</p>
              </div>
            )}

            <p>
              if you believe this is a mistake, please contact us at{' '}
              <a href="mailto:support@recipes.com" className="underline hover:opacity-80 transition-opacity">
                support@recipes.com
              </a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}