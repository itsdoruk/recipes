import Head from 'next/head';
import { Settings } from '@/components/Settings';

export default function SettingsPage() {
  return (
    <>
      <Head>
        <title>{String('settings')}</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8" style={{ background: String('var(--background)'), color: String('var(--foreground)') }}>
        <Settings />
      </main>
    </>
  );
} 