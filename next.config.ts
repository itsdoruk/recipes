import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['img.spoonacular.com', process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || ''],
  },
  reactStrictMode: true,
};

export default nextConfig;