import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  is_admin: boolean;
}

interface Recipe {
  id: string;
  title: string;
  image_url: string;
  created_at: string;
  user_id: string;
}

export default function AdminPanel() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    checkAdminStatus();
  }, [user, router]);

  const checkAdminStatus = async () => {
    try {
      console.log('Checking admin status for user:', user?.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')  // Select all fields for debugging
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      console.log('Profile data:', data);

      if (!data?.is_admin) {
        console.log('User is not an admin');
        router.push('/');
        return;
      }

      console.log('User is admin, proceeding to admin panel');
      setIsAdmin(true);
      fetchData();
    } catch (err) {
      console.error('Error checking admin status:', err);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch recipes
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (recipesError) throw recipesError;
      setRecipes(recipesData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      await fetchData();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;

      await fetchData();
    } catch (err) {
      console.error('Error deleting recipe:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="font-mono">loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Head>
        <title>admin panel</title>
      </Head>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl">admin panel</h1>
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">users</h2>
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border border-gray-200 dark:border-gray-800 flex justify-between items-center"
                >
                  <div>
                    <p className="font-mono">{user.username || 'anonymous'}</p>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      {user.user_id}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteUser(user.user_id)}
                    className="px-3 py-2 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 transition-opacity font-mono"
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4">recipes</h2>
            <div className="space-y-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="p-4 border border-gray-200 dark:border-gray-800 flex justify-between items-center"
                >
                  <div>
                    <p className="font-mono">{recipe.title}</p>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRecipe(recipe.id)}
                    className="px-3 py-2 border border-red-200 dark:border-red-800 text-red-500 hover:opacity-80 transition-opacity font-mono"
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}