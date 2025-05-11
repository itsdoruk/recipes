import { NextResponse } from "next/server";
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      console.error('No session found in API route');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId, action } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
    }

    if (action === 'block') {
      const { data, error } = await supabase
        .from('blocked_users')
        .insert([
          { 
            user_id: session.user.id, 
            blocked_user_id: targetUserId 
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase error during block:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    } else {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', session.user.id)
        .eq('blocked_user_id', targetUserId);

      if (error) {
        console.error('Supabase error during unblock:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }, { status: 500 });
  }
}
