const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Tests a TMDB API key using the backend proxy to avoid CORS errors.
 */
export const testTmdbApiKey = async (apiKey) => {
  const trimmedKey = apiKey?.trim();

  if (!trimmedKey) {
    return {
      ok: false,
      status: 'INVALID',
      type: null,
      httpStatus: null,
      message: 'Key cannot be empty.',
    };
  }

  try {
    // CALL THE BACKEND PROXY instead of TMDB directly
    const response = await fetch(`/api/tmdb/test?key=${encodeURIComponent(trimmedKey)}`);
    
    // Check if the response is actually JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response. Check server logs.");
    }

    const data = await response.json();

    if (response.ok) {
      return {
        ok: true,
        status: 'VALID',
        type: 'v3',
        httpStatus: response.status,
        message: 'Success! TMDB Connected.',
      };
    } else {
      return {
        ok: false,
        status: 'INVALID',
        type: null,
        httpStatus: response.status,
        message: data.status_message || data.message || 'Invalid API Key.',
      };
    }

  } catch (error) {
    console.error("TMDB Test Error:", error);
    return {
        ok: false,
        status: 'FAILED',
        type: null,
        httpStatus: 0,
        message: error.message || 'Connection Error. Is the backend running?',
    };
  }
};

export const searchTvShows = async (query, apiKey) => {
    if (!query || !apiKey) return [];
    
    try {
        const response = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${apiKey}&language=en-US&page=1&include_adult=false&query=${encodeURIComponent(query)}`);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.results || []).map((item) => ({
            id: item.id,
            title: item.name,
            year: item.first_air_date ? parseInt(item.first_air_date.substring(0, 4)) : 0,
            posterPath: item.poster_path,
            overview: item.overview || 'No overview available.'
        }));
    } catch (e) {
        console.error("Search TV Error:", e);
        return [];
    }
}

export const searchMovies = async (query, apiKey) => {
    if (!query || !apiKey) return [];

    try {
        const response = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&language=en-US&page=1&include_adult=false&query=${encodeURIComponent(query)}`);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.results || []).map((item) => ({
            id: item.id,
            title: item.title,
            year: item.release_date ? parseInt(item.release_date.substring(0, 4)) : 0,
            posterPath: item.poster_path,
            overview: item.overview || 'No overview available.'
        }));
    } catch (e) {
        console.error("Search Movies Error:", e);
        return [];
    }
}
