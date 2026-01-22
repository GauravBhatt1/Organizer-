// Backend Handler for GET /api/tmdb/test
// This executes on the server side to avoid CORS issues and secure the API call.

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const handleTmdbTest = async (apiKey: string) => {
  if (!apiKey) {
    return {
      success: false,
      status_code: 400,
      message: 'Missing API Key'
    };
  }

  try {
    // REAL request to TMDB
    const response = await fetch(`${TMDB_BASE_URL}/configuration`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    // TMDB returns JSON even on error usually
    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        status_code: response.status,
        message: 'Connection Successful'
      };
    } else {
      return {
        success: false,
        status_code: response.status,
        message: data.status_message || 'Invalid API Key'
      };
    }
  } catch (error) {
    console.error('Backend TMDB Error:', error);
    return {
      success: false,
      status_code: 500,
      message: 'Internal Server Error: Unable to reach TMDB'
    };
  }
};
