import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  banned: boolean;
  warnings: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [banned, setBanned] = useState(false);
  const [warnings, setWarnings] = useState<number>(0);
  const router = useRouter();

  // Helper function to create profile with retries
  const createProfile = async (userId: string, username: string, retries = 3): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              user_id: userId,
              username: username,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);
        
        if (!profileError) return true;
        
        // If profile already exists, that's fine
        if (profileError.code === '23505') return true;
        
        console.error(`Profile creation attempt ${i + 1} failed:`, profileError);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
      } catch (err) {
        console.error(`Profile creation attempt ${i + 1} failed:`, err);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    return false;
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Only redirect if the user is on login or logout pages
      if (event === 'SIGNED_IN' && router.pathname === '/login') {
        router.push('/');
      } else if (event === 'SIGNED_OUT' && router.pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    // Ensure every authenticated user has a profile
    const ensureProfile = async () => {
      if (!user) return;
      setProfileLoading(true);
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('user_id, banned, warnings')
          .eq('user_id', user.id)
          .single();
        if (existingProfile) {
          setBanned(!!existingProfile.banned);
          setWarnings(existingProfile.warnings || 0);
          if (existingProfile.banned && router.pathname !== '/banned') {
            router.push('/banned');
          }
        }
        if (!existingProfile) {
          // Use email prefix as default username
          const emailPrefix = user.email ? user.email.split('@')[0] : 'user';
          const success = await createProfile(user.id, emailPrefix);
          if (!success) {
            console.error('Failed to create profile after multiple attempts');
          }
        }
      } catch (error) {
        console.error('Error checking/creating profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };
    ensureProfile();
  }, [user, router]);

  // Only render children after loading and profile creation are complete
  if (loading || profileLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      // First check if username is available
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingUser) {
        throw new Error('Username is already taken');
      }

      // Sign up the user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            username: username
          }
        }
      });
      
      if (signUpError) throw signUpError;
      if (!user) throw new Error('Failed to create user');
      
      // Create a profile for the new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            user_id: user.id,
            username: username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (profileError) {
        // If profile creation fails, delete the user
        await supabase.auth.admin.deleteUser(user.id);
        throw profileError;
      }
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signInWithOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      const { data: { user }, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      if (error) throw error;
      
      // Create a profile if one doesn't exist
      if (user) {
        setProfileLoading(true);
        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .single();

          if (!existingProfile) {
            const username = email.split('@')[0]; // Use part of email as username
            const success = await createProfile(user.id, username);
            if (!success) {
              throw new Error('Failed to create profile after multiple attempts');
            }
          }
        } finally {
          setProfileLoading(false);
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithOtp, verifyOtp, banned, warnings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};