// Backend Handler for GET /api/tmdb/test

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export default async function handler(req: any, res: any) {
  // Extract key from query string (assuming query.key or similar structure)
  // Note: Adjust specific request extraction based on the actual server framework (Next.js, Express, etc.)
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const apiKey = url.searchParams.get('key');

  if (!apiKey) {
    return new Response(JSON.stringify({
      success: false,
      status_code: 400,
      message: 'Missing API Key'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
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

    const data = await response.json();

    if (response.ok) {
      return new Response(JSON.stringify({
        success: true,
        status_code: response.status,
        message: 'Connection Successful'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({
        success: false,
        status_code: response.status,
        message: data.status_message || 'Invalid API Key'
      }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Backend TMDB Error:', error);
    return new Response(JSON.stringify({
      success: false,
      status_code: 500,
      message: 'Internal Server Error: Unable to reach TMDB'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// Keep the named export for environments that prefer it
export const handleTmdbTest = handler;
