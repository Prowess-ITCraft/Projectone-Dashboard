/*
  The one place that talks HTTP to the Project One API. The session lives in an httpOnly cookie the browser sends by
  itself; every request also carries X-Requested-With, which the API requires for changes made with that cookie.
  A failed request throws an ApiError with the API's code and plain message.
  When the session has ended (or a new password must be chosen first), `onAuthProblem` is told, so the screens can
  return to the sign-in page instead of showing a broken page.
*/
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const AUTH_CODES = new Set(['not_signed_in', 'session_expired', 'password_change_required']);

export function createClient({ baseUrl = '/api', fetchImpl = (...args) => fetch(...args), onAuthProblem = () => {} } = {}) {
  async function request(method, path, { body, background = false, raw = false } = {}) {
    const headers = { 'X-Requested-With': 'ProjectOne' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (background) headers['X-Background'] = '1';
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('The server could not be reached. Check the connection and try again.');
    }
    if (response.ok) {
      if (raw) return response;
      if (response.status === 204) return null;
      return response.json();
    }
    let problem = {};
    try {
      problem = await response.json();
    } catch {
      // not the API's error shape (a proxy page, for example)
    }
    const error = new ApiError(problem.message || 'Something went wrong. Try again.', {
      status: response.status,
      code: problem.code || 'http_error',
    });
    if (AUTH_CODES.has(error.code) && !path.startsWith('/auth/')) onAuthProblem(error);
    throw error;
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
    raw: (path) => request('GET', path, { raw: true }),
  };
}
