
export const testTmdbApiKey = async (apiKey) => {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    return { ok: false, status: 'INVALID', message: 'Key cannot be empty.' };
  }

  try {
    const response = await fetch(`/api/tmdb/test?key=${encodeURIComponent(trimmedKey)}`);
    
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.warn("Backend returned non-JSON:", text);
        return { 
            ok: false, 
            status: 'FAILED', 
            httpStatus: response.status,
            message: `Server Error: ${response.status} - Ensure the backend is running.` 
        };
    }

    const data = await response.json();

    if (response.ok) {
      return { ok: true, status: 'VALID', type: 'v3', httpStatus: response.status, message: 'Success! TMDB Connected.' };
    } else {
      return { ok: false, status: 'INVALID', httpStatus: response.status, message: data.message || 'Invalid API Key.' };
    }
  } catch (error) {
    console.error("TMDB Test Error:", error);
    return { ok: false, status: 'FAILED', message: error.message || 'Connection Error' };
  }
};

export const searchTvShows = async (query, apiKey) => {
    if (!query || !apiKey) return [];
    try {
        const response = await fetch(`/api/tmdb/search?type=tv&key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}`);
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             console.warn("Search API returned non-JSON");
             return [];
        }

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
        const response = await fetch(`/api/tmdb/search?type=movie&key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}`);
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             console.warn("Search API returned non-JSON");
             return [];
        }

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
