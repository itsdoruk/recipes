import React, { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase/client'

const UserActions = ({ user, onBlock }: { user: any; onBlock?: (isBlocked: boolean) => void }) => {
  const supabase = createClient()
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkBlockStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          console.log('No session found');
          return;
        }

        console.log('Current user:', session.user.id);
        console.log('Target user:', user.id);

        const { data, error } = await supabase
          .from('blocked_users')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('blocked_user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Error checking block status:', error);
          return;
        }

        console.log('Block status data:', data);
        setIsBlocked(!!data);
      } catch (error) {
        console.error('Error in checkBlockStatus:', error);
      }
    };

    checkBlockStatus();
  }, [user.id]);

  const handleBlock = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        console.error('No session found');
        return;
      }

      if (isBlocked) {
        // Unblock
        const { error } = await supabase
          .from('blocked_users')
          .delete()
          .eq('user_id', session.user.id)
          .eq('blocked_user_id', user.id);

        if (error) {
          console.error('Unblock error:', error);
          throw error;
        }
      } else {
        // Block
        const { error } = await supabase
          .from('blocked_users')
          .insert([
            { 
              user_id: session.user.id, 
              blocked_user_id: user.id 
            }
          ]);

        if (error) {
          console.error('Block error:', error);
          throw error;
        }
      }
      
      setIsBlocked(!isBlocked);
      onBlock?.(!isBlocked);
    } catch (error) {
      console.error('Error in handleBlock:', error);
      alert('Failed to update block status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={handleBlock}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : (isBlocked ? 'Unblock' : 'Block')}
      </button>
    </div>
  );
};

export default UserActions;
