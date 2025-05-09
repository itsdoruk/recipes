import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { toLower } from '@/utils/text';

export default function BannedPage() {
  const { banInfo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!banInfo.banned) {
      router.replace('/');
    }
  }, [banInfo.banned, router]);

  if (!banInfo.banned) return null;

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const getBanTypeDisplay = (type: string | null) => {
    switch (type) {
      case 'temporary':
        return 'Temporary Ban';
      case 'permanent':
        return 'Permanent Ban';
      case 'warning':
        return 'Warning';
      default:
        return 'Unknown';
    }
  };

  return (
    <>
      <Head>
        <title>Banned | [recipes]</title>
      </Head>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-4 p-8 border border-red-400 bg-red-50 dark:bg-red-900/20 shadow-md">
            <span className="text-6xl">🔒</span>
            <h2 className="text-2xl font-bold">account banned</h2>
            <p className="text-lg text-center">{toLower('your account has been banned. if you believe this is a mistake, please contact support.')}</p>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-800" style={{ background: 'var(--background)' }}>
            <h2 className="text-xl font-semibold mb-4">ban details</h2>
            <div className="space-y-2">
              <p><span className="font-medium">type:</span> {toLower(getBanTypeDisplay(banInfo.banType))}</p>
              {banInfo.banReason && (
                <p><span className="font-medium">reason:</span> {toLower(banInfo.banReason)}</p>
              )}
              {banInfo.banExpiry && (
                <p><span className="font-medium">expires:</span> {formatDate(banInfo.banExpiry)}</p>
              )}
              <p><span className="font-medium">ban count:</span> {banInfo.banCount}</p>
              {banInfo.lastBanDate && (
                <p><span className="font-medium">last ban:</span> {formatDate(banInfo.lastBanDate)}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}