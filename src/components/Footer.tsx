import { useEffect, useState } from 'react';

export default function Footer() {
  const [commitHash, setCommitHash] = useState<string>('');

  useEffect(() => {
    const fetchCommitHash = async () => {
      try {
        const response = await fetch('/api/commit-hash');
        const data = await response.json();
        setCommitHash(data.hash);
      } catch (error) {
        console.error('Failed to fetch commit hash:', error);
      }
    };

    fetchCommitHash();
  }, []);

  return (
    <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
      <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
        made by{' '}
        <a
          href="https://dsplash.xyz/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          doruk sarp aydın
        </a>
        {' '}• commit: {commitHash || 'loading...'}
      </p>
    </footer>
  );
}