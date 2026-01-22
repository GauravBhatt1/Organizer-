const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const testTmdbApiKey = async (apiKey) => {
  const trimmedKey = apiKey.trim();

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
    // Direct call to TMDB using the api_key query parameter
    const url = `${TMDB_BASE_URL}/configuration?api_key=${trimmedKey}`;
    
    const response = await fetch(url);
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
        message: data.status_message || 'Invalid API Key.',
      };
    }

  } catch (error) {
    console.error("TMDB Error:", error);
    return {
        ok: false,
        status: 'FAILED',
        type: null,
        httpStatus: 0,
        message: 'Network Error. Check internet or disable AdBlock.',
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