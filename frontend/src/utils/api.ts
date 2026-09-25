/**
 * API requests use Vite's local proxy in development and the explicitly
 * configured backend URL in production. Do not hard-code a Render service:
 * service URLs can change and a stale URL makes every portal request fail.
 */
const DEFAULT_BACKEND_URL = 'https://srm-njvt.onrender.com';
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || DEFAULT_BACKEND_URL);
export const hasConfiguredApi = true;

export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, options);
}
