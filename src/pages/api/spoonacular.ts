import { NextApiRequest, NextApiResponse } from 'next';

const SPOONACULAR_API_KEY = process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY;
const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SPOONACULAR_API_KEY) {
    return res.status(500).json({ error: 'Spoonacular API key not configured' });
  }

  try {
    const { endpoint, params } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    const queryParams = new URLSearchParams({
      apiKey: SPOONACULAR_API_KEY,
      ...params
    });

    const response = await fetch(`${SPOONACULAR_API_URL}/${endpoint}?${queryParams}`);
    
    if (!response.ok) {
      if (response.status === 402) {
        return res.status(402).json({ error: 'Spoonacular API quota exceeded' });
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching from Spoonacular:', error);
    res.status(500).json({ error: 'Failed to fetch from Spoonacular API', details: error instanceof Error ? error.message : String(error) });
  }
} 