import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { supabase } from '@/lib/supabase';
import { useUser } from '@supabase/auth-helpers-react';

export default function Index() {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const user = useUser();

  const features = [
    {
      title: 'discover recipes',
      description: 'explore thousands of recipes from your community and around the world',
      icon: '🍳',
      color: 'bg-gray-200 dark:bg-gray-700'
    },
    {
      title: 'share your creations',
      description: 'upload and share your favorite recipes with the community',
      icon: '📸',
      color: 'bg-gray-200 dark:bg-gray-700'
    },
    {
      title: 'ai-powered suggestions',
      description: 'get personalized recipe recommendations based on your preferences',
      icon: '🤖',
      color: 'bg-gray-200 dark:bg-gray-700'
    },
    {
      title: 'connect with others',
      description: 'follow other food lovers and discover new culinary traditions',
      icon: '👥',
      color: 'bg-gray-200 dark:bg-gray-700'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch recipe count
    supabase.from('recipes').select('id', { count: 'exact', head: true })
      .then(({ count }: { count: number | null }) => setRecipeCount(count ?? 0));
    // Fetch user count
    supabase.from('profiles').select('user_id', { count: 'exact', head: true })
      .then(({ count }: { count: number | null }) => setUserCount(count ?? 0));
  }, []);

  return (
    <>
      <Head>
        <title>welcome to [recipes] | your recipe community</title>
        <meta name="description" content="discover, share, and connect through the joy of cooking with your recipe community" />
      </Head>
      <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center px-4 w-full pt-12 pb-16">
          <div className="mb-8">
            {/* Hero Visual */}
            <div className="mx-auto mb-8 flex items-center justify-center">
              <svg className="w-32 h-32 text-white drop-shadow-xl" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 48 48">
                <path d="M14 4v14a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 24v18a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V24" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="30" y="4" width="4" height="38" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Discover, Share, <br /> and <span className="text-red-500">Love</span> Recipes
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10">
              The home for food lovers. Find inspiration, share your creations, and join a global cooking community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/home">
                <button className="px-8 py-4 text-lg font-bold rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 active:bg-accent/80 transition flex items-center">
                  explore recipes
                </button>
              </Link>
              <Link href="/create">
                <button className="px-8 py-4 text-lg font-bold rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 active:bg-accent/80 transition">
                  share a recipe
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Showcase */}
        <section className="w-full max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">
            why [recipes]?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-xl border border-outline transition-all duration-300 bg-[var(--background)] ${
                  currentFeature === index ? 'scale-105 shadow-xl ring-2 ring-blue-400 z-10' : 'hover:scale-105 hover:shadow-lg'
                }`}
                style={{ zIndex: currentFeature === index ? 1 : 0 }}
              >
                <div
                  className={`w-12 h-12 rounded-full ${feature.color} flex items-center justify-center text-xl mb-4`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="w-full max-w-2xl mx-auto px-4 mt-12">
          <div className="py-8 border border-outline rounded-xl bg-[var(--background)]">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl md:text-3xl font-bold mb-1">
                  {recipeCount !== null ? recipeCount.toLocaleString() : '...'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  recipes shared*
                </div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold mb-1">
                  {userCount !== null ? userCount.toLocaleString() : '...'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  active users
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400 text-center">
              * including ai and spoonacular API recipes
            </div>
          </div>
        </section>

        {/* Final CTA */}
        {!user && (
          <section className="w-full max-w-2xl mx-auto px-4 mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">
              ready to start cooking?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
              join the community and discover your next favorite recipe
            </p>
            <Link href="/login">
              <button
                className="px-3 py-2 border border-outline rounded-lg bg-transparent text-black dark:text-white font-normal"
              >
                join [recipes] today
              </button>
            </Link>
          </section>
        )}
      </main>
    </>
  );
} 