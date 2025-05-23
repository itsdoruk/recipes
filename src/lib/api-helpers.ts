/**
 * Helper functions for making authenticated API requests
 */

/**
 * Makes an authenticated fetch request to the API
 * @param url API endpoint URL
 * @param options Fetch options
 * @returns Response from the API
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  console.log(`Making authenticated request to ${url}`);
  
  // Ensure credentials are included to send cookies
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include', // This is critical for sending cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  console.log('Request options:', {
    method: fetchOptions.method || 'GET',
    hasBody: !!fetchOptions.body,
    credentials: fetchOptions.credentials,
    headers: fetchOptions.headers
  });

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
      // Could redirect to login here if needed
      throw new Error('Unauthorized - Please log in');
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
  const response = await fetchWithAuth(url, {
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
  const response = await fetchWithAuth(url);
  
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
  const response = await fetchWithAuth(url, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Error ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
} 