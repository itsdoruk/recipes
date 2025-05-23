import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';

export default function MessageNotificationFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fixNotifications = async () => {
    setIsFixing(true);
    setResult(null);
    setError(null);
    
    try {
      const supabase = getBrowserClient();
      
      try {
        // First attempt: Call the sync_message_notifications function
        const { data, error } = await supabase.rpc('sync_message_notifications');
        
        if (error) {
          // If the function doesn't exist, try the direct query method
          if (error.message.includes('does not exist')) {
            console.log('sync_message_notifications function not found, trying direct method');
            throw error;
          }
        } else {
          setResult('Notifications have been fixed successfully! You should now see your unread messages.');
          return;
        }
      } catch (rpcError) {
        console.error('RPC error:', rpcError);
        
        try {
          // Execute fix directly
          // 1. First try to mark unread messages
          await supabase.from('messages')
            .update({ is_read: false })
            .is('is_read', null);
          
          // 2. Get all unread messages
          const { data: unreadMessages, error: messagesError } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, created_at')
            .eq('is_read', false);
            
          if (messagesError) throw messagesError;
          
          // 3. Get all conversations to identify recipients
          const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('id, user_id, other_user_id');
            
          if (convError) throw convError;
          
          const convsMap = (conversations || []).reduce((acc: Record<string, any>, conv: any) => {
            acc[conv.id] = conv;
            return acc;
          }, {});
          
          // 4. Generate notification records
          const notifications: any[] = [];
          for (const msg of (unreadMessages || [])) {
            const conv = convsMap[msg.conversation_id];
            if (!conv) continue;
            
            // Determine the recipient (the user who is not the sender)
            const recipientId = conv.user_id === msg.sender_id 
              ? conv.other_user_id 
              : conv.user_id;
              
            // Find or update notification for this recipient/conversation
            const existingNotif = notifications.find(
              n => n.user_id === recipientId && n.conversation_id === msg.conversation_id
            );
            
            if (existingNotif) {
              existingNotif.count++;
              if (new Date(msg.created_at) > new Date(existingNotif.last_message_at)) {
                existingNotif.last_message_at = msg.created_at;
              }
            } else {
              notifications.push({
                user_id: recipientId,
                conversation_id: msg.conversation_id,
                count: 1,
                last_message_at: msg.created_at
              });
            }
          }
          
          // 5. Delete existing notifications
          await supabase.from('message_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          
          // 6. Insert new notifications if we have any
          if (notifications.length > 0) {
            const { error: insertError } = await supabase
              .from('message_notifications')
              .insert(notifications);
              
            if (insertError) throw insertError;
          }
          
          setResult(`Notifications fixed manually! Created ${notifications.length} notification records.`);
        } catch (directError: any) {
          throw new Error(`Failed to fix notifications directly: ${directError.message}`);
        }
      }
    } catch (err: any) {
      console.error('Error fixing notifications:', err);
      setError(err.message || 'Failed to fix notifications');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent mt-4">
      <h3 className="font-medium mb-2">Not seeing message notifications?</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        If you're not seeing unread message notifications, click the button below to fix them.
      </p>
      
      <div className="flex flex-col space-y-3">
        <button
          onClick={fixNotifications}
          disabled={isFixing}
          className="px-4 py-2 border border-gray-200 dark:border-gray-800 bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50 rounded-lg text-sm"
        >
          {isFixing ? 'Fixing...' : 'Fix Notifications'}
        </button>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-gray-500 dark:text-gray-400 underline"
        >
          {showAdvanced ? 'Hide advanced info' : 'Show advanced info'}
        </button>
      </div>
      
      {showAdvanced && (
        <div className="mt-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs">
          <p>This tool tries to fix message notifications in two ways:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>First, it tries to call the <code>sync_message_notifications</code> database function</li>
            <li>If that fails, it tries to fix notifications directly by scanning messages and rebuilding notification records</li>
          </ol>
        </div>
      )}
      
      {result && (
        <div className="mt-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm">
          {result}
        </div>
      )}
      
      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
          Error: {error}
        </div>
      )}
    </div>
  );
} 