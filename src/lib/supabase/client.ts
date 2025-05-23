'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Flag to prevent recursive cookie operations
let isHandlingCookie = false;

// Helper function to validate JWT token
const validateJWT = (token: string | null): boolean => {
  if (!token) return false;
  
  try {
    let payload;
    try {
      payload = JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      console.error('Failed to parse JWT payload:', e, token);
      payload = null;
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    if (payload?.exp < now) {
      console.warn('[Auth] Token is expired');
      return false;
    }
    
    // Check if token expiration is too far in the future (more than 24 hours)
    const maxExpiration = now + (24 * 60 * 60); // 24 hours from now
    if (payload?.exp > maxExpiration) {
      console.warn('[Auth] Token expiration is too far in the future');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Auth] Error validating JWT:', error);
    return false;
  }
};

// Cookie utility functions
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

const setCookie = (name: string, value: string, options: { path?: string; maxAge?: number; sameSite?: 'lax' | 'strict' | 'none'; secure?: boolean } = {}) => {
  let cookie = `${name}=${value}`;
  if (options.path) cookie += `; path=${options.path}`;
  if (options.maxAge) cookie += `; max-age=${options.maxAge}`;
  if (options.sameSite) cookie += `; samesite=${options.sameSite}`;
  if (options.secure) cookie += '; secure';
  document.cookie = cookie;
};

const removeCookie = (name: string) => {
  document.cookie = `${name}=; path=/; max-age=0`;
};

// Custom storage implementation with better error handling
const customStorage = {
  getItem: (key: string) => {
    try {
      const cookie = getCookie(key);
      if (!cookie) return null;
      
      // Parse and validate the JWT token
      let data;
      try {
        data = JSON.parse(cookie);
      } catch (e) {
        console.error('Failed to parse cookie as JSON:', e, cookie);
        data = null;
      }
      
      if (!data?.access_token) return null;
      
      // Check if token is expired
      let payload2;
      try {
        payload2 = JSON.parse(atob(data.access_token.split('.')[1]));
      } catch (e) {
        console.error('Failed to parse access_token payload:', e, data?.access_token);
        payload2 = null;
      }
      
      const expiresAt = payload2?.exp;
      const now = Math.floor(Date.now() / 1000);
      
      if (expiresAt < now) {
        // Token is expired, remove it
        removeCookie(key);
        return null;
      }
      
      return cookie;
    } catch (error) {
      console.error('Error in customStorage.getItem:', error);
      return null;
    }
  },
  
  setItem: (key: string, value: string) => {
    try {
      // Only set if value is different from current
      const current = getCookie(key);
      if (current === value) return;
      
      setCookie(key, value, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
    } catch (error) {
      console.error('Error in customStorage.setItem:', error);
    }
  },
  
  removeItem: (key: string) => {
    try {
      removeCookie(key);
    } catch (error) {
      console.error('Error in customStorage.removeItem:', error);
    }
  }
};

// Initialize Supabase client with modified configuration
let supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: customStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    global: {
      headers: {
        'X-Client-Info': 'my-neighborhood-app'
      }
    }
  }
);

// Helper function to force a clean auth state
export const forceCleanAuthState = async () => {
  if (isHandlingCookie) return;
  
  try {
    isHandlingCookie = true;
    await supabase.auth.signOut();
    
    // Clear localStorage
    localStorage.removeItem('supabase.auth.token');
    
    // Clear sessionStorage
    sessionStorage.removeItem('supabase.auth.token');
    
    // Clear cookies in a single operation
    const cookies = document.cookie.split(';');
    const cookieNames = cookies
      .map(cookie => cookie.trim())
      .filter(cookie => cookie.startsWith('sb-'))
      .map(cookie => cookie.split('=')[0]);
    
    // Remove all Supabase cookies at once
    cookieNames.forEach(name => {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
    
    window.location.href = '/login';
  } catch (error) {
    console.error('[Token Debug] Error cleaning auth state:', error);
  } finally {
    isHandlingCookie = false;
  }
};

// For backward compatibility
export const browserClient = supabase;

// Helper function to clear all realtime channels
export const clearAllChannels = () => {
  supabase.removeAllChannels();
};

// Helper function to remove a specific channel
export const removeChannel = (name: string) => {
  const channel = supabase.channel(name);
  channel.unsubscribe();
}; 