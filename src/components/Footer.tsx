export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 font-mono">
          made by{' '}
          <a
            href="https://github.com/itsdoruk"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            doruk sarp aydın
          </a>
        </p>
      </div>
    </footer>
  );
}