import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseStorageUrl = supabaseUrl.replace('https://', '');

const nextConfig: NextConfig = {
  images: {
    domains: [
      'img.spoonacular.com',
      supabaseStorageUrl,
      `${supabaseStorageUrl}.supabase.co`
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;