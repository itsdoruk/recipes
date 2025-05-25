import { getBrowserClient } from './supabase/browserClient';

/**
 * Helper functions for making authenticated API requests
 */

/**
 * Makes an authenticated fetch request to the API with automatic session refresh
 * @param url API endpoint URL
 * @param options Fetch options
 * @returns Response from the API
 */
export async function ensureAuthenticatedFetch(url: string, options: RequestInit = {}) {
  console.log(`Making authenticated request to ${url}`);
  
  // Get the current session
  const supabase = getBrowserClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error getting session:', sessionError);
    throw new Error('Authentication error - Please log in again');
  }
  
  if (!session) {
    console.error('No session found');
    throw new Error('No session found - Please log in');
  }
  
  // Check if the session is expired or about to expire (within 5 minutes)
  const expiresAt = session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;
  
  if (expiresAt && expiresAt - now < fiveMinutes) {
    console.log('Session is about to expire, refreshing...');
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('Error refreshing session:', refreshError);
      throw new Error('Session refresh failed - Please log in again');
    }
    
    if (!newSession) {
      console.error('No new session after refresh');
      throw new Error('Session refresh failed - Please log in again');
    }
  }
  
  // Make the authenticated request
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    
    console.log(`Response from ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    // Handle unauthorized responses
    if (response.status === 401) {
      console.error('Authentication error:', await response.text());
      throw new Error('Unauthorized - Please log in again');
    }
    
    return response;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * Makes a POST request to the API with authentication
 * @param url API endpoint URL
 * @param data Data to send in the request body
 * @returns Response data from the API
 */
export async function postWithAuth<T = any>(url: string, data: any): Promise<T> {
  const response = await ensureAuthenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Error ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Makes a GET request to the API with authentication
 * @param url API endpoint URL
 * @returns Response data from the API
 */
export async function getWithAuth<T = any>(url: string): Promise<T> {
  const response = await ensureAuthenticatedFetch(url);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Error ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Makes a DELETE request to the API with authentication
 * @param url API endpoint URL
 * @returns Response data from the API
 */
export async function deleteWithAuth<T = any>(url: string): Promise<T> {
  const response = await ensureAuthenticatedFetch(url, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Error ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
} 