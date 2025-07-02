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
    <footer className="max-w-2xl mx-auto px-4 py-8 text-center border-t" style={{ borderTopColor: 'var(--outline)', background: "var(--background)", color: "var(--foreground)" }}>
      <div className="flex flex-col items-center gap-1 text-sm md:flex-row md:justify-between md:gap-0">
        <span className="flex items-center gap-2">
          made with <span aria-label="love" role="img">❤️</span> by{' '}
        <a
            href="https://github.com/itsdoruk"
          target="_blank"
          rel="noopener noreferrer"
            className="hover:underline font-semibold"
        >
            @itsdoruk
          </a>
          {' '}• <a href="https://github.com/itsdoruk/recipes" target="_blank" rel="noopener noreferrer" className="hover:underline">[recipes]</a>
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-2 md:mt-0 md:ml-6 md:pl-6 border-l border-outline/20 md:border-l md:border-outline/20">
          commit: <span className="font-mono">{commitHash || 'loading...'}</span>
        </span>
      </div>
    </footer>
  );
}