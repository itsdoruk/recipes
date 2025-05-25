/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    return config;
  },
  // Disable static optimization for pages that use getServerSideProps
  experimental: {
    // This ensures that pages using getServerSideProps are not statically optimized
    isrMemoryCacheSize: 0,
  },
};

module.exports = nextConfig;
