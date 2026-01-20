const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Performs a live, official validation of a TMDB API key or v4 token.
 * This function makes a real network call to the TMDB API and determines
 * the key's validity based on the HTTP response.
 *
 * @param apiKey - The TMDB v3 key or v4 Read Access Token.
 * @returns A promise resolving to a detailed test result object.
 */
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

  // 1) Detect key type
  const keyType = /^[a-f0-9]{32}$/.test(trimmedKey) ? 'v3' : 'v4';
  
  const baseUrl = `${TMDB_API_BASE_URL}/configuration`;
  let requestUrl;
  const options = {
    method: 'GET',
    headers: {},
  };

  // 2) Prepare the request based on key type
  if (keyType === 'v3') {
    requestUrl = `${baseUrl}?api_key=${trimmedKey}`;
  } else {
    requestUrl = baseUrl;
    options.headers = {
      'Authorization': `Bearer ${trimmedKey}`,
      'Content-Type': 'application/json;charset=utf-8',
    };
  }

  // 3) Set up timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  options.signal = controller.signal;

  try {
    const response = await fetch(requestUrl, options);
    clearTimeout(timeoutId);

    // 4) Map result from HTTP status code
    if (response.status === 200) {
      return {
        ok: true,
        status: 'VALID',
        type: keyType,
        httpStatus: response.status,
        message: `TMDB ${keyType.toUpperCase()} key is valid!`,
      };
    } else if (response.status === 401 || response.status === 403) {
      const data = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: 'INVALID',
        type: keyType,
        httpStatus: response.status,
        message: data.status_message || 'Invalid credentials.',
      };
    } else {
      return {
        ok: false,
        status: 'FAILED',
        type: keyType,
        httpStatus: response.status,
        message: `Test failed. TMDB returned HTTP ${response.status}.`,
      };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return {
        ok: false,
        status: 'FAILED',
        type: keyType,
        httpStatus: null,
        message: 'Test failed: Request timed out after 2 seconds.',
      };
    }
    return {
      ok: false,
      status: 'FAILED',
      type: keyType,
      httpStatus: null,
      message: 'Test failed: Network error or could not connect to TMDB.',
    };
  }
};

/**
 * Helper to perform TMDB search fetch
 */
const fetchTmdbSearch = async (endpoint, query, apiKey) => {
    if (!query || !apiKey) return [];
    
    const trimmedKey = apiKey.trim();
    const isV3 = /^[a-f0-9]{32}$/.test(trimmedKey);
    
    // Ensure endpoint doesn't start with / to prevent double slashes if base url ends with /
    const safeEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    let url = `${TMDB_API_BASE_URL}/${safeEndpoint}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    };

    if (isV3) {
        url += `&api_key=${trimmedKey}`;
    } else {
        options.headers['Authorization'] = `Bearer ${trimmedKey}`;
    }

    try {
        const res = await fetch(url, options);
        if (!res.ok) {
             const err = await res.json().catch(() => ({}));
             throw new Error(`TMDB API Error: ${res.status} ${err.status_message || res.statusText}`);
        }
        const data = await res.json();
        return data.results || [];
    } catch (error) {
        console.error(`Search failed for ${endpoint}`, error);
        throw error;
    }
};

/**
 * Searches for TV shows on TMDB using the provided API key.
 */
export const searchTvShows = async (query, apiKey) => {
    const results = await fetchTmdbSearch('search/tv', query, apiKey);
    return results.map(show => ({
        id: show.id,
        title: show.name, 
        year: show.first_air_date ? show.first_air_date.split('-')[0] : 'N/A',
        posterPath: show.poster_path,
        overview: show.overview
    }));
};

/**
 * Searches for Movies on TMDB using the provided API key.
 */
export const searchMovies = async (query, apiKey) => {
    const results = await fetchTmdbSearch('search/movie', query, apiKey);
    return results.map(movie => ({
        id: movie.id,
        title: movie.title, 
        year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A',
        posterPath: movie.poster_path,
        overview: movie.overview
    }));
};