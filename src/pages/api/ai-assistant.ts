import { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '@/lib/supabase/serverClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = getServerClient();
    
    // Get the session to check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { message, preferences } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Create a system message that includes user preferences
    const systemMessage = preferences ? 
      `You are a helpful cooking assistant. The user has the following preferences:
- Cuisine: ${preferences.cuisine || 'any'}
- Diet: ${preferences.diet || 'any'}
- Cooking Time: ${preferences.cookingTime || 'any'} minutes

Provide personalized cooking advice, recipe suggestions, and tips that match these preferences. Be friendly and encouraging. Format your responses in markdown for better readability. Include specific measurements and cooking times when relevant.` :
      `You are a helpful cooking assistant. You can help with recipe suggestions, cooking tips, ingredient substitutions, and general cooking advice. Always be friendly and encouraging. Format your responses in markdown for better readability.`;

    // Call the AI API
    const response = await fetch('https://ai.hackclub.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    console.error('Error in AI assistant:', error);
    return res.status(500).json({ message: 'Failed to get AI response' });
  }
} 