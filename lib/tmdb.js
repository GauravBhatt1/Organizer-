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
